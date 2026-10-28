-- Avisos Web Push (ADR-0040). Solo aditiva: dos tablas nuevas con dueño y RLS.
-- `push_subscriptions`: una fila por dispositivo (navegador o PWA instalada) que aceptó los avisos. La escribe la app con
-- la sesión del usuario; la Edge Function `push` (cron, service role) la lee y borra las que el navegador ya no reconoce.
-- `push_log`: qué avisos se enviaron, para no repetirlos si el cron corre dos veces o se recupera tras una pausa.

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Dirección del servicio de push del navegador (Apple, Google, Mozilla…). Es secreta: quien la tiene puede enviar.
  endpoint      text not null check (char_length(endpoint) between 12 and 2000 and endpoint ~* '^https://'),
  -- Claves de cifrado de la suscripción (base64url).
  p256dh        text not null check (char_length(p256dh) between 1 and 200),
  auth          text not null check (char_length(auth) between 1 and 100),
  user_agent    text check (user_agent is null or char_length(user_agent) <= 400),
  -- Nombre que enseña Ajustes («iPhone · Safari»).
  label         text check (label is null or char_length(label) between 1 and 60),
  -- La última vez que el dispositivo confirmó la suscripción (al abrir Ajustes › Notificaciones o activarla).
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Una fila por dispositivo y dueño: volver a activar en el mismo navegador actualiza la fila.
create unique index push_subscriptions_owner_endpoint_uq on public.push_subscriptions (owner_id, endpoint);
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

create table public.push_log (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Clave del aviso: `charge:<subscription_id>:<next_date>` (un aviso por cobro).
  key         text not null check (char_length(key) between 1 and 200),
  sent_at     timestamptz not null default now()
);
create unique index push_log_owner_key_uq on public.push_log (owner_id, key);
create index push_log_sent_at_idx on public.push_log (sent_at);

alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
create policy push_subscriptions_owner on public.push_subscriptions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy push_log_owner on public.push_log for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Sin tiempo real: la lista de dispositivos solo se ve en Ajustes y se lee al abrirla.
