-- Aviso por correo al entrar desde un dispositivo nuevo (ADR-0080). No hay trigger en `auth.sessions`: un cron llama cada
-- 5 minutos a la Edge Function `security`, que lee las sesiones nuevas con `login_alert_pending()` (service role) y apunta
-- lo que ha visto en estas dos tablas. Solo aditiva. Aplícala antes de desplegar la función (gotchas/db, «Aviso de
-- dispositivo nuevo»).

-- ─── Dispositivos que ya has usado ───────────────────────────────────────────
-- `device_key` es el nombre que enseña la lista de sesiones (`sessionDeviceLabel` del core): «Windows · Chrome»,
-- «Claude · app conectada»… Lo escribe solo la service role; el dueño lo puede leer.
create table public.known_devices (
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_key    text not null check (char_length(device_key) between 1 and 120),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (owner_id, device_key)
);

alter table public.known_devices enable row level security;

create policy known_devices_owner_read on public.known_devices
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy require_mfa on public.known_devices as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- ─── Sesiones ya miradas ─────────────────────────────────────────────────────
-- Para no repetir el aviso si el cron corre dos veces. Sin FK a `auth.sessions`: la sesión puede cerrarse y el registro
-- sigue sirviendo. Sin políticas: solo la service role (que se salta RLS) lo lee y lo escribe.
create table public.login_alert_log (
  session_id uuid primary key,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  device_key text not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.login_alert_log enable row level security;

create index login_alert_log_owner_idx on public.login_alert_log (owner_id);
create index login_alert_log_created_idx on public.login_alert_log (created_at);

-- ─── Lo que lee el cron ──────────────────────────────────────────────────────
-- Sesiones de las últimas 24 h que aún no están en el registro, con lo que hace falta para decidir y escribir el
-- correo. Nunca devuelve tokens. Solo para la service role: el cliente no debe ver las sesiones de nadie más.
create function public.login_alert_pending()
returns table (
  session_id uuid,
  owner_id   uuid,
  created_at timestamptz,
  user_agent text,
  ip         text,
  app_name   text,
  email      text,
  locale     text,
  enabled    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.user_id,
    s.created_at,
    s.user_agent,
    host(s.ip),
    c.client_name::text,
    u.email::text,
    us.preferences ->> 'locale',
    -- Activado salvo un `false` explícito (un valor raro no rompe la consulta).
    (us.preferences -> 'loginAlerts') is distinct from 'false'::jsonb
  from auth.sessions s
  join auth.users u on u.id = s.user_id
  left join auth.oauth_clients c on c.id = s.oauth_client_id
  left join public.user_settings us on us.owner_id = s.user_id
  where s.created_at > now() - interval '24 hours'
    and not exists (select 1 from public.login_alert_log l where l.session_id = s.id)
  order by s.created_at;
$$;

revoke all on function public.login_alert_pending() from public, anon, authenticated;
grant execute on function public.login_alert_pending() to service_role;
