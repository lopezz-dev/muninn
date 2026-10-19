-- Muninn · esquema inicial (F1): proyectos, columnas de tablero, tareas, checklist, notas, actividad y ajustes.
-- Todas las tablas son multi-usuario desde el día uno (owner_id + RLS) para poder convertirlo en producto.

create extension if not exists pgcrypto;

-- ─── Tipos ────────────────────────────────────────────────────────────────────

create type project_status as enum ('active', 'paused', 'archived');
-- Semántica de una columna, independiente de su nombre: permite saber qué está "hecho" aunque la columna se llame "Shipped".
create type column_kind as enum ('backlog', 'todo', 'in_progress', 'review', 'done');
create type task_priority as enum ('none', 'low', 'medium', 'high', 'urgent');
create type task_source as enum ('manual', 'github', 'mcp', 'agent');
create type actor_kind as enum ('user', 'mcp', 'github', 'agent', 'system');

-- ─── Utilidades ───────────────────────────────────────────────────────────────

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Proyectos ────────────────────────────────────────────────────────────────

create table projects (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  description  text not null default '',
  color        text not null default 'blue',
  icon         text,
  status       project_status not null default 'active',
  github_repo  text check (github_repo is null or github_repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  position     text collate "C" not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index projects_owner_idx on projects (owner_id, status);
create unique index projects_owner_repo_uq on projects (owner_id, github_repo) where github_repo is not null;
create trigger projects_updated_at before update on projects for each row execute function set_updated_at();

-- ─── Columnas (estados personalizables por proyecto) ─────────────────────────

create table board_columns (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid not null references projects (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  kind        column_kind not null,
  color       text,
  wip_limit   int check (wip_limit is null or wip_limit > 0),
  position    text collate "C" not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index board_columns_project_idx on board_columns (project_id, position);
create trigger board_columns_updated_at before update on board_columns for each row execute function set_updated_at();

-- ─── Tareas ───────────────────────────────────────────────────────────────────

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id    uuid not null references projects (id) on delete cascade,
  column_id     uuid not null references board_columns (id) on delete restrict,
  title         text not null check (char_length(title) between 1 and 300),
  description   text not null default '',
  priority      task_priority not null default 'none',
  labels        text[] not null default '{}',
  due_date      date,
  position      text collate "C" not null,
  source        task_source not null default 'manual',
  -- Vínculo con el origen externo (p. ej. issue de GitHub "owner/repo#123").
  external_id   text,
  external_url  text,
  completed_at  timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tasks_column_idx on tasks (column_id, position) where archived_at is null;
create index tasks_project_idx on tasks (project_id) where archived_at is null;
create index tasks_due_idx on tasks (owner_id, due_date) where archived_at is null and completed_at is null;
create unique index tasks_external_uq on tasks (owner_id, source, external_id) where external_id is not null;
create trigger tasks_updated_at before update on tasks for each row execute function set_updated_at();

create table task_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id     uuid not null references tasks (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 300),
  done        boolean not null default false,
  position    text collate "C" not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index task_checklist_task_idx on task_checklist_items (task_id, position);
create trigger task_checklist_updated_at before update on task_checklist_items for each row execute function set_updated_at();

-- ─── Notas ────────────────────────────────────────────────────────────────────

create table notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid references projects (id) on delete set null,
  task_id     uuid references tasks (id) on delete set null,
  title       text not null default '',
  content     text not null default '',
  pinned      boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notes_owner_idx on notes (owner_id, updated_at desc) where archived_at is null;
create index notes_project_idx on notes (project_id) where archived_at is null;
create trigger notes_updated_at before update on notes for each row execute function set_updated_at();

-- ─── Actividad (alimenta resúmenes, Jarvis e insights) ───────────────────────

create table activity (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id   uuid references projects (id) on delete cascade,
  entity_type  text not null,
  entity_id    uuid not null,
  action       text not null,
  actor        actor_kind not null default 'user',
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index activity_owner_idx on activity (owner_id, created_at desc);
create index activity_project_idx on activity (project_id, created_at desc);

-- ─── Ajustes de usuario (módulos activados, preferencias) ────────────────────

create table user_settings (
  owner_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled_modules  text[] not null default '{tasks,notes}',
  preferences      jsonb not null default '{}',
  updated_at       timestamptz not null default now()
);
create trigger user_settings_updated_at before update on user_settings for each row execute function set_updated_at();

-- ─── Integridad entre tablas: hijos del mismo dueño y del mismo proyecto ─────

create or replace function enforce_task_consistency() returns trigger
language plpgsql as $$
declare
  col record;
begin
  select project_id, owner_id into col from board_columns where id = new.column_id;
  if col.project_id is distinct from new.project_id or col.owner_id is distinct from new.owner_id then
    raise exception 'column % does not belong to project %', new.column_id, new.project_id;
  end if;
  return new;
end;
$$;
create trigger tasks_consistency before insert or update of column_id, project_id on tasks
  for each row execute function enforce_task_consistency();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['projects', 'board_columns', 'tasks', 'task_checklist_items', 'notes', 'activity', 'user_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end;
$$;

-- La actividad es un log: se inserta y se lee, no se edita.
drop policy activity_owner on activity;
create policy activity_select on activity for select to authenticated using (owner_id = (select auth.uid()));
create policy activity_insert on activity for insert to authenticated with check (owner_id = (select auth.uid()));

-- ─── Realtime (sincronización entre dispositivos) ────────────────────────────

alter publication supabase_realtime add table projects, board_columns, tasks, task_checklist_items, notes;
