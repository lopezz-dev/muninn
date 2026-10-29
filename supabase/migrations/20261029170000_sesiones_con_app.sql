-- La lista de sesiones (ADR-0061) dice qué app abrió cada sesión por OAuth. Las de claude.ai llegan con el user agent
-- `python-httpx/…`, que no dice nada: el nombre sale del cliente OAuth (`auth.oauth_clients.client_name`, p. ej. «Claude»).
-- Cambia el tipo de retorno, así que hay que borrarla y crearla otra vez (y volver a dar los permisos). Lo demás sigue como
-- en 20261029150000_aal2_en_el_servidor: comprueba el segundo factor, no devuelve tokens y solo ve las de `auth.uid()`.
drop function if exists public.list_my_sessions();

create function public.list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  is_current boolean,
  app_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.mfa_satisfied() then
    raise exception 'Falta el segundo factor' using errcode = '42501', hint = 'mfa_required';
  end if;
  return query
    select
      s.id,
      s.created_at,
      coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) as last_active_at,
      s.user_agent,
      host(s.ip) as ip,
      s.aal::text,
      s.id::text = (select auth.jwt() ->> 'session_id') as is_current,
      c.client_name::text as app_name
    from auth.sessions s
    left join auth.oauth_clients c on c.id = s.oauth_client_id
    where s.user_id = (select auth.uid())
      and (s.not_after is null or s.not_after > now())
    order by last_active_at desc;
end;
$$;

revoke all on function public.list_my_sessions() from public, anon;
grant execute on function public.list_my_sessions() to authenticated;
