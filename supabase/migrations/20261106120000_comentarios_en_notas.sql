-- Comentarios en las notas (ADR-0079): hilos anclados a una cita del texto visible, con «Para Claude» (`for_agent`).
-- Solo aditiva: una tabla nueva. El ancla vive aquí, nunca en el Markdown de la nota.

create table public.note_comments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id      uuid not null references public.notes (id) on delete cascade,
  -- null en el comentario que abre el hilo; las respuestas apuntan a él (un solo nivel).
  parent_id    uuid references public.note_comments (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 10000),
  -- Solo en el primero: { quote, prefix, suffix, start, end } sobre el texto visible (`noteText` del core).
  anchor       jsonb,
  orphaned     boolean not null default false,
  for_agent    boolean not null default false,
  resolved_at  timestamptz,
  resolved_by  public.actor_kind,
  actor        public.actor_kind not null default 'user',
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint note_comments_anchor_only_root check (parent_id is null or anchor is null),
  constraint note_comments_resolved_only_root check (parent_id is null or resolved_at is null)
);
create index note_comments_owner_idx on public.note_comments (owner_id);
create index note_comments_note_created_idx on public.note_comments (note_id, created_at);
create index note_comments_parent_idx on public.note_comments (parent_id) where parent_id is not null;
create trigger note_comments_updated_at before update on public.note_comments
  for each row execute function public.set_updated_at();

-- La nota es del mismo dueño, y una respuesta cuelga de un hilo (sin madre) de la misma nota.
create or replace function public.enforce_note_comment() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  root record;
begin
  if not exists (select 1 from public.notes where id = new.note_id and owner_id = new.owner_id) then
    raise exception 'note does not belong to owner %', new.owner_id;
  end if;
  if new.parent_id is not null then
    select note_id, parent_id, owner_id into root from public.note_comments where id = new.parent_id;
    if root.owner_id is distinct from new.owner_id
      or root.note_id is distinct from new.note_id
      or root.parent_id is not null then
      raise exception 'parent % is not a thread of note %', new.parent_id, new.note_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger note_comments_consistency
  before insert or update of note_id, parent_id, owner_id on public.note_comments
  for each row execute function public.enforce_note_comment();

alter table public.note_comments enable row level security;
create policy note_comments_owner on public.note_comments for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- Segundo factor (ADR-0062), como el resto de tablas.
create policy require_mfa on public.note_comments as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_comments'
  ) then
    alter publication supabase_realtime add table public.note_comments;
  end if;
end;
$$;
