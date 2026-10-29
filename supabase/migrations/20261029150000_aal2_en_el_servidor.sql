-- El servidor exige el segundo factor (ADR-0062). Hasta ahora solo lo pedía la app al entrar: un token `aal1` (código del
-- correo o GitHub, sin el de la app de códigos) leía y escribía todo por la API aunque la cuenta tuviera segundo factor.

-- Verdadera si la sesión ya pasó el segundo factor o si la cuenta no tiene ninguno confirmado. Sin usuario (service role,
-- cron) también lo es: esos no pasan por las políticas de `authenticated`.
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    or not exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = (select auth.uid())
        and f.status = 'verified'
    );
$$;

revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

-- Una política restrictiva en cada tabla con RLS: se suma (AND) a la de `owner_id`. Sin segundo factor activado no cambia
-- nada; con él, un token `aal1` no ve ni cambia ninguna fila. Las tablas nuevas la añaden a mano (checklist de gotchas/db).
do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format(
      'create policy require_mfa on public.%I as restrictive for all to authenticated '
      'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t
    );
  end loop;
end;
$$;

-- Lo mismo para los ficheros (imágenes de proyecto).
create policy require_mfa on storage.objects as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Las funciones `security definer` de sesiones (ADR-0061) se saltan el RLS: comprueban el segundo factor por su cuenta.
-- Sin esto, con un token `aal1` se podían ver y cerrar las sesiones buenas.
create or replace function public.list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  is_current boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.mfa_satisfied() then
    raise exception 'Falta el segundo factor' using errcode = '42501', hint = 'mfa_required';
  end if;
  return query
    select
      s.id,
      s.created_at,
      coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) as last_active_at,
      s.user_agent,
      host(s.ip) as ip,
      s.aal::text,
      s.id::text = (select auth.jwt() ->> 'session_id') as is_current
    from auth.sessions s
    where s.user_id = (select auth.uid())
      and (s.not_after is null or s.not_after > now())
    order by last_active_at desc;
end;
$$;

create or replace function public.revoke_my_session(session_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  if (select auth.uid()) is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  if not public.mfa_satisfied() then
    raise exception 'Falta el segundo factor' using errcode = '42501', hint = 'mfa_required';
  end if;
  delete from auth.sessions s
  where s.id = revoke_my_session.session_id
    and s.user_id = (select auth.uid());
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- Conectar GitHub (vincular un repo, que la sincronización usa para escribir issues) exige `aal2` siempre, tenga o no
-- segundo factor la cuenta. Quitar el repo no. La Edge Function `github` (service role) no pasa por aquí.
create or replace function public.require_aal2_for_github_repo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.github_repo is not null
    and (tg_op = 'INSERT' or new.github_repo is distinct from old.github_repo)
    and (select auth.role()) = 'authenticated'
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2'
  then
    raise exception 'Conectar GitHub requiere el segundo factor' using errcode = '42501', hint = 'mfa_required';
  end if;
  return new;
end;
$$;

create trigger projects_github_repo_aal2
  before insert or update of github_repo on public.projects
  for each row execute function public.require_aal2_for_github_repo();
