-- Último evento de cada proyecto, para Inicio (`overview()` en el core): una sola llamada en lugar de una por proyecto.
-- Un `lateral … limit 1` por proyecto baja por `activity_project_idx (project_id, created_at desc)` y lee una fila por
-- proyecto, sin recorrer su historial. Los proyectos sin actividad no salen.
-- `security invoker`: el RLS de `activity` (dueño y segundo factor) decide qué filas ve quien llama. El dueño va como
-- parámetro porque con la service role (MCP) `auth.uid()` es `null`.

create or replace function public.activity_latest_by_project(owner uuid, project_ids uuid[])
returns table (project_id uuid, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, last.created_at
  from unnest(project_ids) as p(id)
  cross join lateral (
    select a.created_at
    from public.activity a
    where a.project_id = p.id
      and a.owner_id = activity_latest_by_project.owner
    order by a.created_at desc
    limit 1
  ) last;
$$;

revoke all on function public.activity_latest_by_project(uuid, uuid[]) from public, anon;
grant execute on function public.activity_latest_by_project(uuid, uuid[]) to authenticated, service_role;
