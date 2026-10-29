-- Una app OAuth aprobada con el segundo factor cuenta como `aal2` (ADR-0064), pero solo la sesión que nace de esa
-- aprobación (ADR-0066). El servidor OAuth de Supabase emite tokens `aal1` aunque quien aprueba haya pasado el código, así
-- que con el factor activado claude.ai no veía nada. Atarlo a la app y no a la sesión dejaba entrar a quien solo tuviera
-- el código del correo: podía aprobar por la API (sin `/oauth/consent`) desde su propia cuenta de la misma app.

-- «Esta autorización la aprobé con el segundo factor» y, en cuanto se canjea, la sesión que salió de ella. Una fila por
-- app: aprobarla otra vez sustituye la anterior. Solo la escriben `approve_oauth_client_mfa` y el trigger de abajo; se lee
-- y se borra con RLS (quitar el acceso en Apps con acceso borra la fila).
create table public.oauth_mfa_grants (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references auth.oauth_clients (id) on delete cascade,
  authorization_id text not null,
  approved_at timestamptz not null default now(),
  session_id uuid references auth.sessions (id) on delete set null,
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

-- Lo de siempre y, al final (solo con factor y `aal1`), si la sesión del JWT es la atada a una aprobación con el factor.
-- En plpgsql para que el orden sea este: lo normal no paga la consulta. `security definer` con dueño `postgres` (que se
-- salta el RLS): leer `oauth_mfa_grants` no vuelve a evaluar `require_mfa`.
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
    from public.oauth_mfa_grants g
    join auth.sessions s on s.id = g.session_id and s.user_id = g.owner_id
    where g.owner_id = uid
      and g.session_id = sid::uuid
  );
end;
$$;

revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

-- La llama `/oauth/consent` al pulsar «Permitir acceso», antes de aprobar. Solo apunta si quien llama es `aal2` (pasó el
-- código de la app) y la autorización es suya, sigue pendiente y no ha caducado; la app sale de la autorización. Si no,
-- no hace nada y devuelve `false`.
create function public.approve_oauth_client_mfa(authorization_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  client uuid;
begin
  if uid is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    return false;
  end if;
  select a.client_id into client
  from auth.oauth_authorizations a
  join auth.oauth_clients c on c.id = a.client_id and c.deleted_at is null
  where a.authorization_id = approve_oauth_client_mfa.authorization_id
    -- Supabase puede no rellenar `user_id` hasta aprobarla; el trigger lo exige ya aprobada.
    and (a.user_id = uid or a.user_id is null)
    and a.status = 'pending'
    and a.expires_at > now();
  if client is null then
    return false;
  end if;
  insert into public.oauth_mfa_grants (owner_id, client_id, authorization_id, approved_at, session_id)
  values (uid, client, approve_oauth_client_mfa.authorization_id, now(), null)
  on conflict (owner_id, client_id) do update
    set authorization_id = excluded.authorization_id, approved_at = excluded.approved_at, session_id = null;
  return true;
end;
$$;

revoke all on function public.approve_oauth_client_mfa(text) from public, anon;
grant execute on function public.approve_oauth_client_mfa(text) to authenticated;

-- Al nacer la sesión de una app OAuth (al canjear el código), la ata a la aprobación pendiente si la autorización apuntada
-- es la última aprobada de esa app para ese usuario y es de hace menos de 15 minutos. Una vez: con `session_id` puesto, ya
-- no se ata otra. Si algo falla, la sesión nace igual (sin acceso con el factor): no puede romper la entrada.
create function public.bind_oauth_mfa_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.oauth_client_id is null then
    return new;
  end if;
  begin
    update public.oauth_mfa_grants g
    set session_id = new.id
    where g.owner_id = new.user_id
      and g.client_id = new.oauth_client_id
      and g.session_id is null
      and g.approved_at > now() - interval '15 minutes'
      and g.authorization_id = (
        select a.authorization_id
        from auth.oauth_authorizations a
        where a.user_id = new.user_id
          and a.client_id = new.oauth_client_id
          and a.approved_at is not null
        order by a.approved_at desc
        limit 1
      );
  exception when others then
    raise warning 'bind_oauth_mfa_grant: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.bind_oauth_mfa_grant() from public, anon, authenticated;

create trigger oauth_mfa_grants_bind
  after insert on auth.sessions
  for each row execute function public.bind_oauth_mfa_grant();

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
