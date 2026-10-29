-- La política restrictiva del segundo factor (ADR-0062) en las tablas de avisos push. `20261029150000_aal2_en_el_servidor`
-- solo la puso en las tablas que existían al aplicarla, y `20261028180000_push_subscriptions` (paso 4b de la fase final)
-- llega después en remoto. Aplica esta justo después de la de push. Si las tablas aún no existen, no hace nada, y si la
-- política ya está, tampoco.
do $$
declare
  t text;
begin
  foreach t in array array['push_subscriptions', 'push_log'] loop
    if to_regclass('public.' || t) is not null
      and not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'require_mfa'
      )
    then
      execute format(
        'create policy require_mfa on public.%I as restrictive for all to authenticated '
        'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
        t
      );
    end if;
  end loop;
end;
$$;
