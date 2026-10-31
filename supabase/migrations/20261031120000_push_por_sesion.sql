-- Cada suscripción push va atada a la sesión de Auth que la guardó (ADR-0074). Al cerrarse esa sesión (desde la lista de
-- Ajustes › Cuenta, «En los demás», «En todos», quitando el acceso a una app o porque caduca), la fila se borra con ella:
-- un dispositivo con la sesión cerrada deja de recibir los avisos de cobro de la cuenta.
-- Aplícala después de `20261028180000_push_subscriptions` (paso 4b de la fase final). Solo aditiva.

alter table public.push_subscriptions
  add column session_id uuid references auth.sessions (id) on delete cascade;

-- La cascada busca por esta columna al borrar una sesión.
create index push_subscriptions_session_idx on public.push_subscriptions (session_id);

-- La sesión la pone el servidor, no el cliente: la del JWT que escribe (`session_id`). Con la service role (sin sesión)
-- no se toca. `security definer` para poder mirar `auth.sessions`: si la sesión del token ya está cerrada (su token de
-- acceso vale hasta una hora más), no se guarda nada, porque ese dispositivo está saliendo.
create or replace function public.push_subscriptions_set_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid := nullif((select auth.jwt() ->> 'session_id'), '')::uuid;
begin
  if sid is null then
    return new;
  end if;
  if not exists (select 1 from auth.sessions s where s.id = sid and s.user_id = new.owner_id) then
    raise exception 'La sesión de este dispositivo está cerrada' using errcode = '42501', hint = 'session_closed';
  end if;
  new.session_id := sid;
  return new;
end;
$$;

revoke all on function public.push_subscriptions_set_session() from public, anon, authenticated;

create trigger push_subscriptions_session
  before insert or update on public.push_subscriptions
  for each row execute function public.push_subscriptions_set_session();
