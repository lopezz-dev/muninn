-- Una app OAuth aprobada con el segundo factor cuenta como `aal2` (ADR-0064). El servidor OAuth de Supabase emite tokens
-- `aal1` aunque quien aprueba haya pasado el código, así que con el factor activado claude.ai no veía nada.

-- «Esta app la aprobé con el segundo factor». Solo la escribe `approve_oauth_client_mfa`; se lee y se borra con RLS
-- (quitar el acceso en Apps con acceso borra la fila). Sin factor no hace falta ninguna fila.
create table public.oauth_mfa_grants (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references auth.oauth_clients (id) on delete cascade,
  approved_at timestamptz not null default now(),
  primary key (owner_id, client_id)
);

alter table public.oauth_mfa_grants enable row level security;

create policy oauth_mfa_grants_select on public.oauth_mfa_grants
  for select to authenticated using (owner_id = (select auth.uid()));
create policy oauth_mfa_grants_delete on public.oauth_mfa_grants
  for delete to authenticated using (owner_id = (select auth.uid()));
create policy require_mfa on public.oauth_mfa_grants as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

revoke insert, update on public.oauth_mfa_grants from anon, authenticated;

-- El segundo factor de verdad: la sesión es `aal2` o la cuenta no tiene factor. Sin la excepción de las apps OAuth: la
-- usan las funciones de sesiones (una app no ve ni cierra sesiones aunque esté aprobada).
create function public.mfa_satisfied_strict()
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

revoke all on function public.mfa_satisfied_strict() from public, anon;
grant execute on function public.mfa_satisfied_strict() to authenticated;

-- Lo de siempre y, al final (solo con factor y `aal1`), si la sesión del JWT es de una app OAuth aprobada con el factor.
-- En plpgsql para que el orden sea este: lo normal no paga la consulta a `auth.sessions`. `security definer` con dueño
-- `postgres` (que se salta el RLS): leer `oauth_mfa_grants` no vuelve a evaluar `require_mfa`.
create or replace function public.mfa_satisfied()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  sid text := (select auth.jwt() ->> 'session_id');
begin
  if public.mfa_satisfied_strict() then
    return true;
  end if;
  if uid is null or sid is null or sid = '' then
    return false;
  end if;
  return exists (
    select 1
    from auth.sessions s
    join public.oauth_mfa_grants g on g.client_id = s.oauth_client_id and g.owner_id = s.user_id
    where s.id = sid::uuid
      and s.user_id = uid
  );
end;
$$;

revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

-- La llama `/oauth/consent` al pulsar «Permitir acceso», antes de aprobar. Solo apunta la app si quien llama es `aal2`
-- (pasó el código de la app) y el cliente existe; si no, no hace nada y devuelve `false`.
create function public.approve_oauth_client_mfa(client_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    return false;
  end if;
  if not exists (
    select 1 from auth.oauth_clients c
    where c.id = approve_oauth_client_mfa.client_id and c.deleted_at is null
  ) then
    return false;
  end if;
  insert into public.oauth_mfa_grants (owner_id, client_id)
  values (uid, approve_oauth_client_mfa.client_id)
  on conflict (owner_id, client_id) do update set approved_at = now();
  return true;
end;
$$;

revoke all on function public.approve_oauth_client_mfa(uuid) from public, anon;
grant execute on function public.approve_oauth_client_mfa(uuid) to authenticated;

-- Las funciones de sesiones, con la comprobación estricta. El resto, igual que en 20261029150000 y 20261029170000.
create or replace function public.list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  is_current boolean,
  app_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.mfa_satisfied_strict() then
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
      s.id::text = (select auth.jwt() ->> 'session_id') as is_current,
      c.client_name::text as app_name
    from auth.sessions s
    left join auth.oauth_clients c on c.id = s.oauth_client_id
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
  if not public.mfa_satisfied_strict() then
    raise exception 'Falta el segundo factor' using errcode = '42501', hint = 'mfa_required';
  end if;
  delete from auth.sessions s
  where s.id = revoke_my_session.session_id
    and s.user_id = (select auth.uid());
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;
