-- Sincronización entre dispositivos (ADR-0029): los ajustes (módulos activos, apariencia) también
-- viajan por Realtime. El resto de tablas ya estaban en la publicación desde `init`.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime add table public.user_settings;
  end if;
end
$$;
