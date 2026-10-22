-- Suscripciones recurrentes (ADR-0038). Solo aditiva: una tabla nueva y una columna opcional en los movimientos.
-- Al llegar la fecha, Muninn solo avisa: el gasto lo apunta el usuario («Apuntar cobro»).

create table public.finance_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  amount        bigint not null check (amount > 0),
  frequency     text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  account_id    uuid not null references public.finance_accounts (id),
  category_id   uuid references public.finance_categories (id),
  -- Día que marca el ciclo (un día 31 vuelve al 31 tras un mes corto).
  anchor_date   date not null,
  next_date     date not null,
  remind_days   int not null default 3 check (remind_days between 0 and 30),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index finance_subscriptions_owner_next_idx on public.finance_subscriptions (owner_id, next_date)
  where archived_at is null;
create index finance_subscriptions_account_idx on public.finance_subscriptions (account_id);
create index finance_subscriptions_category_idx on public.finance_subscriptions (category_id)
  where category_id is not null;
create trigger finance_subscriptions_updated_at before update on public.finance_subscriptions
  for each row execute function public.set_updated_at();

-- Como en los movimientos: cuenta y categoría del mismo dueño, y la categoría de gastos.
create or replace function public.enforce_finance_subscription() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cat record;
begin
  if not exists (
    select 1 from public.finance_accounts where id = new.account_id and owner_id = new.owner_id
  ) then
    raise exception 'account does not belong to owner %', new.owner_id;
  end if;
  if new.category_id is not null then
    select kind, owner_id into cat from public.finance_categories where id = new.category_id;
    if cat.owner_id is distinct from new.owner_id or cat.kind is distinct from 'expense' then
      raise exception 'category % is not an expense category of the owner', new.category_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger finance_subscriptions_consistency
  before insert or update of account_id, category_id, owner_id on public.finance_subscriptions
  for each row execute function public.enforce_finance_subscription();

-- El movimiento que apunta un cobro sabe de qué suscripción viene.
alter table public.finance_transactions
  add column subscription_id uuid references public.finance_subscriptions (id);
create index finance_transactions_subscription_idx on public.finance_transactions (subscription_id)
  where subscription_id is not null;
-- Un cobro (suscripción + fecha) no se apunta dos veces, aunque se pulse a la vez en dos dispositivos.
create unique index finance_transactions_subscription_date_uq
  on public.finance_transactions (subscription_id, date)
  where subscription_id is not null and archived_at is null;

alter table public.finance_subscriptions enable row level security;
create policy finance_subscriptions_owner on public.finance_subscriptions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'finance_subscriptions'
  ) then
    alter publication supabase_realtime add table public.finance_subscriptions;
  end if;
end;
$$;
