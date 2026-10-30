-- Prueba de eliminar tareas para siempre (ADR-0067) con el esquema que ya hay: no necesita migración. En el editor SQL,
-- pega este bloque tal cual. Termina siempre con un error «RESULTADO …» que deshace todo. Lo esperado:
--   1:0 2:1 3:0 4:0 5:true 6:1 7:1
-- A es el dueño; B, otra cuenta.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  p uuid := gen_random_uuid();
  col uuid := gen_random_uuid();
  t uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  note uuid := gen_random_uuid();
  r text := '';
  n int;
  ok boolean;
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'prueba-a-' || a || '@example.test'),
    (b, 'authenticated', 'authenticated', 'prueba-b-' || b || '@example.test');
  insert into public.projects (id, owner_id, name, position) values (p, a, 'Prueba', 'a0');
  insert into public.board_columns (id, owner_id, project_id, name, kind, position)
    values (col, a, p, 'Pendiente', 'todo', 'a0');
  insert into public.tasks (id, owner_id, project_id, column_id, title, position, archived_at) values
    (t, a, p, col, 'Archivada', 'a0', now()),
    (other, a, p, col, 'Otra', 'a1', null);
  insert into public.task_checklist_items (owner_id, task_id, title, position) values
    (a, t, 'Sub', 'a0'), (a, other, 'Sub de otra', 'a0');
  insert into public.github_outbox (owner_id, task_id) values (a, t);
  insert into public.notes (id, owner_id, project_id, task_id, title) values (note, a, p, t, 'Nota');
  insert into public.activity (owner_id, project_id, entity_type, entity_id, action)
    values (a, p, 'task', t, 'created');

  -- 1. B no puede borrar la tarea de A (RLS): no ve la fila
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
  delete from public.tasks where id = t;
  get diagnostics n = row_count; r := r || ' 1:' || n;
  reset role;

  -- 2. A sí, con su sesión
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
  delete from public.tasks where owner_id = a and id = t;
  get diagnostics n = row_count; r := r || ' 2:' || n;
  reset role;

  -- 3. Sus subtareas y 4. su cola de GitHub se van en cascada (la cola no tiene política de delete: la cascada no la pide)
  select count(*) into n from public.task_checklist_items where task_id = t; r := r || ' 3:' || n;
  select count(*) into n from public.github_outbox where task_id = t; r := r || ' 4:' || n;
  -- 5. La nota se queda, sin tarea
  select task_id is null into ok from public.notes where id = note; r := r || ' 5:' || ok;
  -- 6. La actividad se conserva y 7. la otra tarea sigue con su subtarea
  select count(*) into n from public.activity where entity_id = t; r := r || ' 6:' || n;
  select count(*) into n from public.task_checklist_items where task_id = other; r := r || ' 7:' || n;

  raise exception 'RESULTADO%', r;
end;
$$;
