-- Prueba de 20261029200000_oauth_mfa_grants (ADR-0064 y ADR-0066), sin dejar nada: en el editor SQL, pega `begin;`, la
-- migración y este bloque. Termina siempre con un error «RESULTADO …» que deshace todo (también la migración). Lo esperado:
--   1:false 2:false 2b:true 2c:42501 3:true 4:1 4b:42501 5:0 6:0 7:0 7b:0 8:1 9:1 9b:0
-- A tiene segundo factor; B no. «Atacante» = otra sesión de la misma app con la cuenta de A (solo el código del correo).
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  s_web uuid := gen_random_uuid();
  s_app uuid := gen_random_uuid();
  s_att uuid := gen_random_uuid();
  s_x uuid := gen_random_uuid();
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
  insert into auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope) values
    (gen_random_uuid(), 'auth-v-' || a, c, a, 'https://example.test/cb', 'email');
  insert into auth.sessions (id, user_id) values (s_web, a);
  insert into public.projects (owner_id, name, position) values (a, 'Prueba A', 'a0'), (b, 'Prueba B', 'a0');

  -- 1. Con aal1 no se apunta nada
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_web)::text, true);
  set local role authenticated;
  select public.approve_oauth_client_mfa('auth-v-' || a) into ok; r := r || ' 1:' || ok;
  reset role;

  -- 2. Con aal2: autorización inexistente no; la suya sí; insertar a mano, no
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2', 'session_id', s_web)::text, true);
  set local role authenticated;
  select public.approve_oauth_client_mfa('no-existe') into ok; r := r || ' 2:' || ok;
  select public.approve_oauth_client_mfa('auth-v-' || a) into ok; r := r || ' 2b:' || ok;
  begin
    insert into public.oauth_mfa_grants (owner_id, client_id, authorization_id) values (a, c, 'x');
    r := r || ' 2c:INSERT-PERMITIDO';
  exception when others then r := r || ' 2c:' || sqlstate;
  end;
  reset role;

  -- 3. Supabase aprueba y la app canjea el código: la sesión nueva queda atada
  update auth.oauth_authorizations set status = 'approved', approved_at = now() where authorization_id = 'auth-v-' || a;
  insert into auth.sessions (id, user_id, oauth_client_id) values (s_app, a, c);
  select exists (select 1 from public.oauth_mfa_grants where owner_id = a and session_id = s_app) into ok; r := r || ' 3:' || ok;

  -- 4. Esa sesión ve sus datos, pero no las sesiones
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_app)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 4:' || n;
  begin
    perform * from public.list_my_sessions();
    r := r || ' 4b:SESIONES-VISIBLES';
  exception when others then r := r || ' 4b:' || sqlstate;
  end;
  reset role;

  -- 5. El atacante abre otra sesión de la misma app (aprobada por la API con aal1): no se ata y no ve nada
  insert into auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, status, approved_at) values
    (gen_random_uuid(), 'auth-att-' || a, c, a, 'https://example.test/cb', 'email', 'approved', now() + interval '1 second');
  insert into auth.sessions (id, user_id, oauth_client_id) values (s_att, a, c);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_att)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 5:' || n;
  reset role;

  -- 6. Una sesión aal1 que no es de la app: nada
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_web)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 6:' || n;
  reset role;

  -- 7. A vuelve a aprobar (aal2), pero el atacante aprueba después: la sesión nueva no se ata, y la vieja pierde el acceso
  insert into auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope) values
    (gen_random_uuid(), 'auth-w-' || a, c, a, 'https://example.test/cb', 'email');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2', 'session_id', s_web)::text, true);
  set local role authenticated;
  perform public.approve_oauth_client_mfa('auth-w-' || a);
  reset role;
  update auth.oauth_authorizations set status = 'approved', approved_at = now() + interval '2 seconds' where authorization_id = 'auth-w-' || a;
  insert into auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, status, approved_at) values
    (gen_random_uuid(), 'auth-x-' || a, c, a, 'https://example.test/cb', 'email', 'approved', now() + interval '3 seconds');
  insert into auth.sessions (id, user_id, oauth_client_id) values (s_x, a, c);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_x)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 7:' || n;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_app)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 7b:' || n;
  reset role;

  -- 8. B, sin factor, ve lo suyo con aal1
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1', 'session_id', s_app)::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || ' 8:' || n;
  reset role;

  -- 9. Quitar el acceso borra la fila; la tabla queda vacía para A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2', 'session_id', s_web)::text, true);
  set local role authenticated;
  delete from public.oauth_mfa_grants where client_id = c;
  get diagnostics n = row_count; r := r || ' 9:' || n;
  select count(*) into n from public.oauth_mfa_grants; r := r || ' 9b:' || n;
  reset role;

  raise exception 'RESULTADO%', r;
end;
$$;
