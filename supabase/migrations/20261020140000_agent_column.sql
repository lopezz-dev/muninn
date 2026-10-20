-- Columna «Para el agente» (ADR-0032). Solo aditiva:
-- 1. Cada proyecto puede marcar una de sus columnas como la del agente. Borrar la columna la desmarca.
-- 2. La cola de salida de GitHub (ADR-0031) lleva ahora dos tipos de entrada: `state` (cerrar o reabrir la
--    issue, lo de siempre) y `agent` (poner o quitar la etiqueta `muninn:agent`). Las filas viejas son `state`.

alter table public.projects
  add column agent_column_id uuid null references public.board_columns (id) on delete set null;
create index projects_agent_column_idx on public.projects (agent_column_id)
  where agent_column_id is not null;

-- Última barrera, como `enforce_task_consistency`: la columna es del mismo proyecto y del mismo dueño.
-- El core ya lo valida (y que no sea de tipo «Hecho»).
create or replace function public.enforce_agent_column() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col record;
begin
  if new.agent_column_id is null then
    return new;
  end if;
  select project_id, owner_id into col from public.board_columns where id = new.agent_column_id;
  if col.project_id is distinct from new.id or col.owner_id is distinct from new.owner_id then
    raise exception 'column % does not belong to project %', new.agent_column_id, new.id;
  end if;
  return new;
end;
$$;
create trigger projects_agent_column before insert or update of agent_column_id on public.projects
  for each row execute function public.enforce_agent_column();

alter table public.github_outbox
  add column kind text not null default 'state' check (kind in ('state', 'agent'));

-- Las políticas de `projects` y `github_outbox` no cambian: la columna nueva va con su fila (owner_id + RLS).
