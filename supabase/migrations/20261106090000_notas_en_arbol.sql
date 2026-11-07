-- Notas en árbol (ADR-0083): páginas con hijas, carpetas incluidas, y un espacio por proyecto (`project_id`; null = «General»).
-- Solo aditiva: lo que hay queda en la raíz de su espacio.

alter table public.notes
  add column parent_id uuid references public.notes (id) on delete set null,
  -- Default solo para los clientes de antes del árbol (insertan sin posición): el core rebalancea si dos hermanas coinciden.
  add column position text collate "C" not null default 'a0',
  add column kind text not null default 'page' check (kind in ('page', 'folder'));

-- Clave de fractional-indexing (la misma forma que `generateNKeysBetween`) para la n-ésima nota de un nivel: a0…az, b00…bzz, c000…
create or replace function public.note_tree_key(n bigint) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  head text;
  width int;
  rest bigint := n;
  acc text := '';
begin
  if n < 62 then
    head := 'a'; width := 1;
  elsif n < 62 + 3844 then
    head := 'b'; width := 2; rest := n - 62;
  else
    head := 'c'; width := 3; rest := n - 62 - 3844;
  end if;
  for i in 1..width loop
    acc := substr(digits, (rest % 62)::int + 1, 1) || acc;
    rest := rest / 62;
  end loop;
  return head || acc;
end;
$$;

-- Lo que hay, en la raíz de su espacio y de la más reciente a la más antigua. Sin tocar `updated_at`, que ordena «Recientes».
alter table public.notes disable trigger notes_updated_at;
update public.notes n
set position = public.note_tree_key(o.rn - 1)
from (
  select id, row_number() over (partition by owner_id, project_id order by updated_at desc, id) as rn
  from public.notes
) o
where n.id = o.id;
alter table public.notes enable trigger notes_updated_at;

drop function public.note_tree_key(bigint);

create index notes_tree_idx on public.notes (owner_id, project_id, parent_id, position) where archived_at is null;
create index notes_parent_idx on public.notes (parent_id);

-- Última barrera (el core ya lo valida): la madre es del mismo dueño y del mismo espacio, y no hay ciclos. Es un trigger AFTER
-- de constraint para que se compruebe al acabar la sentencia: mover un subárbol entero de espacio va en un solo `update`, y
-- borrar un proyecto pone `project_id = null` a todas sus notas a la vez.
create or replace function public.enforce_note_tree() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent record;
  cursor_id uuid;
  depth int := 0;
begin
  if new.parent_id is null then
    return null;
  end if;
  if new.parent_id = new.id then
    raise exception 'note % cannot be its own parent', new.id;
  end if;
  select owner_id, project_id into parent from public.notes where id = new.parent_id;
  if not found then
    raise exception 'parent note % not found', new.parent_id;
  end if;
  if parent.owner_id is distinct from new.owner_id or parent.project_id is distinct from new.project_id then
    raise exception 'note % is not in the space of its parent %', new.id, new.parent_id;
  end if;
  cursor_id := new.parent_id;
  loop
    select n.parent_id into cursor_id from public.notes n where n.id = cursor_id;
    exit when cursor_id is null;
    if cursor_id = new.id then
      raise exception 'note % would be its own ancestor', new.id;
    end if;
    depth := depth + 1;
    if depth > 1000 then
      raise exception 'note tree too deep at %', new.id;
    end if;
  end loop;
  return null;
end;
$$;

create constraint trigger notes_tree
after insert or update of parent_id, project_id, owner_id on public.notes
deferrable initially immediate
for each row execute function public.enforce_note_tree();
