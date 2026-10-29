-- Sesiones abiertas de la cuenta, para Ajustes › Cuenta (ADR-0061).
-- El cliente no puede leer `auth.sessions` (no está expuesta y sin RLS). Estas dos funciones `security definer` solo
-- ven y cierran las sesiones del propio usuario (`auth.uid()`), y nunca devuelven tokens.

create or replace function public.list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) as last_active_at,
    s.user_agent,
    host(s.ip) as ip,
    s.aal::text,
    s.id::text = (select auth.jwt() ->> 'session_id') as is_current
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by last_active_at desc;
$$;

-- Cierra una sesión del usuario. Borrar la fila borra sus refresh tokens (cascada): ese dispositivo no puede renovar y
-- sale al caducar su token de acceso (una hora como mucho). Devuelve si había algo que cerrar.
create or replace function public.revoke_my_session(session_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  if (select auth.uid()) is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  delete from auth.sessions s
  where s.id = revoke_my_session.session_id
    and s.user_id = (select auth.uid());
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke all on function public.list_my_sessions() from public, anon;
revoke all on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.list_my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
