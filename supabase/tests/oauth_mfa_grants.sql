-- Prueba de 20261029200000_oauth_mfa_grants (ADR-0064), sin dejar nada: en el editor SQL, pega `begin;`, la migración y
-- este bloque. Termina siempre con un error «RESULTADO …» que deshace todo (también la migración). Lo esperado:
--   1:0 2:false 3:true 3b:false 3c:42501 4:1 4b:1 4c:42501 5:0 6:1 6b:0 6c:ok 7:1 7b:0
-- A tiene segundo factor y una sesión abierta por una app OAuth; B no tiene factor.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  s_app uuid := gen_random_uuid();
  s_web uuid := gen_random_uuid();
  r text := '';
  n int;
  ok boolean;
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'prueba-a-' || a || '@example.test'),
    (b, 'authenticated', 'authenticated', 'prueba-b-' || b || '@example.test');
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values (gen_random_uuid(), a, 'Prueba', 'totp', 'verified', now(), now());
  insert into auth.oauth_clients (id, client_name, grant_types, redirect_uris, registration_type, token_endpoint_auth_method)
    values (c, 'Prueba', 'authorization_code', 'https://example.test/cb', 'manual', 'none');
  insert into auth.sessions (id, user_id, oauth_client_id) values (s_app, a, c);
  insert into auth.sessions (id, user_id) values (s_web, a);
  insert into public.projects (owner_id, name, position) values (a, 'Prueba A', 'a0'), (b, 'Prueba B', 'a0');

  -- 1. A, app OAuth sin fila, aal1: 0 proyectos
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_app)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 1:' || n;
  -- 2. aal1 no puede aprobar
  select public.approve_oauth_client_mfa(c) into ok; r := r || ' 2:' || ok;
  reset role;

  -- 3. A en la web con aal2 aprueba; insertar a mano falla
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2', 'session_id', s_web)::text, true);
  set local role authenticated;
  select public.approve_oauth_client_mfa(c) into ok; r := r || ' 3:' || ok;
  select public.approve_oauth_client_mfa(gen_random_uuid()) into ok; r := r || ' 3b(cliente inexistente):' || ok;
  begin
    insert into public.oauth_mfa_grants (owner_id, client_id) values (a, c);
    r := r || ' 3c:INSERT-PERMITIDO';
  exception when others then r := r || ' 3c:' || sqlstate;
  end;
  reset role;

  -- 4. A desde la app con fila y aal1: ve su proyecto, ve la fila, no ve sesiones
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_app)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 4:' || n;
  select count(*) into n from public.oauth_mfa_grants; r := r || ' 4b:' || n;
  begin
    perform * from public.list_my_sessions();
    r := r || ' 4c:SESIONES-VISIBLES';
  exception when others then r := r || ' 4c:' || sqlstate;
  end;
  reset role;

  -- 5. A en otra sesión aal1 que no es de la app: 0
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_web)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 5:' || n;
  reset role;

  -- 6. B (sin factor) usando la sesión de A: no ve nada de A y su fila no cuenta
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_app)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 6:' || n;
  select count(*) into n from public.oauth_mfa_grants; r := r || ' 6b:' || n;
  perform * from public.list_my_sessions(); r := r || ' 6c:ok';
  reset role;

  -- 7. A con aal2 borra la fila (quitar acceso); la app deja de ver
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2', 'session_id', s_web)::text, true);
  set local role authenticated;
  delete from public.oauth_mfa_grants where client_id = c;
  get diagnostics n = row_count; r := r || ' 7:' || n;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_app)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 7b:' || n;
  reset role;

  raise exception 'RESULTADO%', r;
end;
$$;
