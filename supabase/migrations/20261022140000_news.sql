-- Noticias (ADR-0042). Solo aditiva: tres tablas nuevas con dueño y RLS.
-- Las fuentes las elige el usuario; los artículos los descarga la Edge Function `news` (cron) y el resumen diario
-- lo escribe la app en el ordenador con el modelo local.

create table public.news_sources (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url             text not null check (char_length(url) between 8 and 2000 and url ~* '^https?://'),
  title           text not null check (char_length(title) between 1 and 120),
  site_url        text check (site_url is null or char_length(site_url) <= 2000),
  topic           text check (topic is null or char_length(topic) between 1 and 40),
  enabled         boolean not null default true,
  -- Descarga condicional (ETag / Last-Modified) y estado de la última vez.
  etag            text,
  last_modified   text,
  last_fetched_at timestamptz,
  last_error      text,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Una fuente por URL y dueño (si la quitas y la vuelves a añadir, se recupera la archivada).
create unique index news_sources_owner_url_uq on public.news_sources (owner_id, url);
create trigger news_sources_updated_at before update on public.news_sources
  for each row execute function public.set_updated_at();

create table public.news_items (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_id     uuid not null references public.news_sources (id) on delete cascade,
  -- Identificador estable del artículo en su fuente (guid, id de Atom o el enlace): evita duplicados.
  guid          text not null check (char_length(guid) between 1 and 500),
  url           text not null check (char_length(url) <= 2000),
  title         text not null check (char_length(title) between 1 and 300),
  summary       text not null default '' check (char_length(summary) <= 1200),
  author        text check (author is null or char_length(author) <= 120),
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  read_at       timestamptz,
  saved_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index news_items_source_guid_uq on public.news_items (source_id, guid);
create index news_items_owner_recent_idx on public.news_items (owner_id, coalesce(published_at, fetched_at) desc);
create index news_items_owner_saved_idx on public.news_items (owner_id, saved_at) where saved_at is not null;
create trigger news_items_updated_at before update on public.news_items
  for each row execute function public.set_updated_at();

-- El artículo es del dueño de su fuente.
create or replace function public.enforce_news_item_owner() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.news_sources where id = new.source_id and owner_id = new.owner_id
  ) then
    raise exception 'source % does not belong to owner %', new.source_id, new.owner_id;
  end if;
  return new;
end;
$$;
create trigger news_items_owner before insert or update of source_id, owner_id on public.news_items
  for each row execute function public.enforce_news_item_owner();

create table public.news_digests (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Un resumen por día (fecha local del usuario).
  date        date not null,
  content     text not null check (char_length(content) between 1 and 8000),
  model       text check (model is null or char_length(model) <= 120),
  item_ids    uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index news_digests_owner_date_uq on public.news_digests (owner_id, date);
create trigger news_digests_updated_at before update on public.news_digests
  for each row execute function public.set_updated_at();

alter table public.news_sources enable row level security;
alter table public.news_items enable row level security;
alter table public.news_digests enable row level security;
create policy news_sources_owner on public.news_sources for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy news_items_owner on public.news_items for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy news_digests_owner on public.news_digests for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Tiempo real: las fuentes, los artículos que llegan del cron y el resumen que escribe el ordenador.
do $$
declare
  t text;
begin
  foreach t in array array['news_sources', 'news_items', 'news_digests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
