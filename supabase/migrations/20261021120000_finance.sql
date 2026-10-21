-- Finanzas (ADR-0037): cuentas, categorías y movimientos. Solo aditiva.
-- Importes en céntimos enteros y siempre positivos (ADR-0018): el signo lo da el tipo de movimiento.
-- El saldo no se guarda: lo suma la vista `finance_account_totals`.

-- ─── Cuentas ──────────────────────────────────────────────────────────────────

create table public.finance_accounts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  kind             text not null check (kind in ('checking', 'savings', 'investment', 'cash', 'other')),
  color            text not null default 'blue',
  -- Puede ser negativo: una cuenta que empieza en descubierto.
  initial_balance  bigint not null default 0,
  -- Objetivo de una hucha («Objetivo 12.000 €»), opcional.
  goal             bigint check (goal is null or goal > 0),
  -- Una sola divisa por ahora; la columna existe para que el multidivisa sea aditivo.
  currency         text not null default 'EUR' check (currency = 'EUR'),
  position         text collate "C" not null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index finance_accounts_owner_idx on public.finance_accounts (owner_id, position);
create trigger finance_accounts_updated_at before update on public.finance_accounts
  for each row execute function public.set_updated_at();

-- ─── Categorías ───────────────────────────────────────────────────────────────

create table public.finance_categories (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  kind         text not null check (kind in ('expense', 'income')),
  color        text not null default 'gray',
  -- Las de serie (`housing`, `groceries`…); null en las propias. Evita sembrarlas dos veces.
  key          text check (key is null or char_length(key) between 1 and 40),
  position     text collate "C" not null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index finance_categories_owner_idx on public.finance_categories (owner_id, kind, position);
create unique index finance_categories_key_uq on public.finance_categories (owner_id, key)
  where key is not null;
create trigger finance_categories_updated_at before update on public.finance_categories
  for each row execute function public.set_updated_at();

-- ─── Movimientos ──────────────────────────────────────────────────────────────

create table public.finance_transactions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('expense', 'income', 'transfer')),
  amount         bigint not null check (amount > 0),
  -- Fecha local del movimiento (como `tasks.due_date`).
  date           date not null,
  -- Sin `on delete`: no se borra por debajo una cuenta con movimientos (al borrar el usuario, se comprueba al final).
  account_id     uuid not null references public.finance_accounts (id),
  to_account_id  uuid references public.finance_accounts (id),
  category_id    uuid references public.finance_categories (id),
  concept        text not null default '' check (char_length(concept) <= 200),
  note           text not null default '' check (char_length(note) <= 2000),
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Un traspaso va de una cuenta a otra distinta y sin categoría; un gasto o un ingreso, sin destino.
  constraint finance_transactions_transfer_ck check (
    (kind = 'transfer' and to_account_id is not null and to_account_id <> account_id and category_id is null)
    or (kind <> 'transfer' and to_account_id is null)
  )
);
create index finance_transactions_owner_date_idx on public.finance_transactions (owner_id, date desc)
  where archived_at is null;
create index finance_transactions_account_idx on public.finance_transactions (account_id);
create index finance_transactions_to_account_idx on public.finance_transactions (to_account_id)
  where to_account_id is not null;
create index finance_transactions_category_idx on public.finance_transactions (category_id)
  where category_id is not null;
create trigger finance_transactions_updated_at before update on public.finance_transactions
  for each row execute function public.set_updated_at();

-- Última barrera, como `enforce_task_consistency`: cuentas y categoría del mismo dueño, y la categoría del mismo
-- tipo que el movimiento. El core ya lo valida.
create or replace function public.enforce_finance_transaction() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cat record;
begin
  if not exists (
    select 1 from public.finance_accounts where id = new.account_id and owner_id = new.owner_id
  ) or (
    new.to_account_id is not null and not exists (
      select 1 from public.finance_accounts where id = new.to_account_id and owner_id = new.owner_id
    )
  ) then
    raise exception 'account does not belong to owner %', new.owner_id;
  end if;
  if new.category_id is not null then
    select kind, owner_id into cat from public.finance_categories where id = new.category_id;
    if cat.owner_id is distinct from new.owner_id or cat.kind is distinct from new.kind then
      raise exception 'category % does not match transaction kind %', new.category_id, new.kind;
    end if;
  end if;
  return new;
end;
$$;
create trigger finance_transactions_consistency
  before insert or update of kind, account_id, to_account_id, category_id, owner_id
  on public.finance_transactions
  for each row execute function public.enforce_finance_transaction();

-- ─── Saldo derivado ───────────────────────────────────────────────────────────

-- Neto por cuenta de los movimientos no archivados: ingresos suman, gastos restan, un traspaso resta del origen y
-- suma al destino. `security_invoker`: RLS de `finance_transactions` decide qué filas entran.
create view public.finance_account_totals
with (security_invoker = true) as
select owner_id, account_id, sum(delta)::bigint as net
from (
  select owner_id, account_id, case when kind = 'income' then amount else -amount end as delta
  from public.finance_transactions
  where archived_at is null
  union all
  select owner_id, to_account_id, amount
  from public.finance_transactions
  where archived_at is null and kind = 'transfer'
) movements
group by owner_id, account_id;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['finance_accounts', 'finance_categories', 'finance_transactions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end;
$$;

grant select on public.finance_account_totals to authenticated;
revoke all on public.finance_account_totals from anon;

-- ─── Realtime (ADR-0029) ──────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['finance_accounts', 'finance_categories', 'finance_transactions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
