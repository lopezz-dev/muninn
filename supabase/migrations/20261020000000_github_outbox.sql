-- Sync de GitHub (ADR-0031): cola de salida de los cambios de estado de las tareas que vienen de una issue.
-- El core (createMuninn) apunta aquí cada vez que una tarea de GitHub entra en «hecho» o sale de ahí; la Edge
-- Function `github` la vacía cerrando o reabriendo la issue. Solo aditiva: no toca ninguna tabla existente.

create table github_outbox (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id       uuid not null references tasks (id) on delete cascade,
  attempts      int not null default 0 check (attempts >= 0),
  last_error    text,
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);
-- Lo que lee la sincronización: lo pendiente de un usuario, en orden.
create index github_outbox_pending_idx on github_outbox (owner_id, id) where processed_at is null;
create index github_outbox_task_idx on github_outbox (task_id) where processed_at is null;

alter table github_outbox enable row level security;

-- La app (con la sesión del usuario) apunta y puede ver lo suyo; procesar lo hace la Edge Function con la
-- service role, que no pasa por RLS. Sin política de update ni de delete para el usuario.
create policy github_outbox_select on github_outbox
  for select using (owner_id = (select auth.uid()));
create policy github_outbox_insert on github_outbox
  for insert with check (owner_id = (select auth.uid()));
