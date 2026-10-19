-- Avisos del asesor de Supabase tras el esquema inicial.
-- 1) Funciones con search_path fijo: sin él, quien cree objetos en otro schema podría suplantar
--    las tablas que usan. Con `search_path = ''` todo va calificado (`public.…`).
-- 2) Índices para las claves foráneas que no tenían uno (borrados en cascada y filtros por dueño).

create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_task_consistency() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col record;
begin
  select project_id, owner_id into col from public.board_columns where id = new.column_id;
  if col.project_id is distinct from new.project_id or col.owner_id is distinct from new.owner_id then
    raise exception 'column % does not belong to project %', new.column_id, new.project_id;
  end if;
  return new;
end;
$$;

create index board_columns_owner_idx on public.board_columns (owner_id);
create index task_checklist_owner_idx on public.task_checklist_items (owner_id);
create index notes_task_idx on public.notes (task_id);
