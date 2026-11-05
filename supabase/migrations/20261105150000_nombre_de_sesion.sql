-- Nombre puesto a mano a una sesión (ADR-0082): «Portátil del curro», «iPhone». En el navegador no se puede leer el
-- nombre del equipo (en la app de escritorio sí, ADR-0081), así que lo pones tú desde «Sesiones y dispositivos».
-- Va atado a la sesión: al cerrarla, el nombre se borra con ella. Este navegador lo recuerda y lo vuelve a poner al
-- entrar otra vez (eso lo hace la app). Solo aditiva, salvo `list_my_sessions`, que cambia su tipo de retorno.
-- Aplícala después de `20261029170000_sesiones_con_app`.

create table public.session_names (
  session_id uuid primary key references auth.sessions (id) on delete cascade,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  updated_at timestamptz not null default now()
);

create index session_names_owner_idx on public.session_names (owner_id);
create trigger session_names_updated_at before update on public.session_names
  for each row execute function public.set_updated_at();

-- Solo lectura para el dueño; se escribe con `name_my_session`, que comprueba que la sesión es suya.
alter table public.session_names enable row level security;
create policy session_names_owner_read on public.session_names
  for select to authenticated
  using (owner_id = (select auth.uid()));
create policy require_mfa on public.session_names as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Pone (o quita, con un nombre vacío o `null`) el nombre de una sesión de `auth.uid()`. Devuelve si la sesión existe.
create function public.name_my_session(session_id uuid, name text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean text := nullif(btrim(name_my_session.name), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  if not public.mfa_satisfied() then
    raise exception 'Falta el segundo factor' using errcode = '42501', hint = 'mfa_required';
  end if;
  if not exists (
    select 1 from auth.sessions s
    where s.id = name_my_session.session_id and s.user_id = (select auth.uid())
  ) then
    return false;
  end if;
  if clean is null then
    delete from public.session_names n where n.session_id = name_my_session.session_id;
  else
    insert into public.session_names (session_id, owner_id, name)
    values (name_my_session.session_id, (select auth.uid()), left(clean, 40))
    on conflict on constraint session_names_pkey do update set name = excluded.name;
  end if;
  return true;
end;
$$;

revoke all on function public.name_my_session(uuid, text) from public, anon;
grant execute on function public.name_my_session(uuid, text) to authenticated;

-- La lista de sesiones trae también el nombre. Cambia el tipo de retorno: se borra y se crea otra vez, como en
-- 20261029170000_sesiones_con_app (lo demás igual: segundo factor, sin tokens, solo las de `auth.uid()`).
drop function if exists public.list_my_sessions();

create function public.list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  is_current boolean,
  app_name text,
  device_name text
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
      s.id::text = (select auth.jwt() ->> 'session_id') as is_current,
      c.client_name::text as app_name,
      n.name as device_name
    from auth.sessions s
    left join auth.oauth_clients c on c.id = s.oauth_client_id
    left join public.session_names n on n.session_id = s.id
    where s.user_id = (select auth.uid())
      and (s.not_after is null or s.not_after > now())
    order by last_active_at desc;
end;
$$;

revoke all on function public.list_my_sessions() from public, anon;
grant execute on function public.list_my_sessions() to authenticated;
