-- Inversiones (ADR-0086, con las divisas de ADR-0085). Solo aditiva: instrumentos, operaciones y precios, con dueño.
-- La verdad son las operaciones: posición, precio medio y ganancia se derivan en el core; no se guarda ninguna posición.
-- Enteros siempre: importes en centésimas de la divisa del instrumento; cantidades, precios y tipos en millonésimas.

-- ─── Instrumentos ─────────────────────────────────────────────────────────────

-- Reparto de exposición por divisa en tanto por diez mil (ADR-0085): un objeto { "USD": 6300, "JPY": 600, … } con
-- claves ISO en mayúsculas y enteros de 1 a 10 000 que suman 10 000 como mucho (el resto es «otras»). `{}` = sin
-- reparto: cuenta entera en su divisa de cotización.
create or replace function public.invest_exposure_ok(e jsonb) returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(e) = 'object' and coalesce((
    select bool_and(
             k ~ '^[A-Z]{3}$'
             and jsonb_typeof(v) = 'number'
             and (v #>> '{}')::numeric between 1 and 10000
             and (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric)
           )
           and sum((v #>> '{}')::numeric) <= 10000
    from jsonb_each(e) as x(k, v)
  ), true);
$$;

create table public.invest_instruments (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol         text not null check (char_length(symbol) between 1 and 24),
  name           text not null check (char_length(name) between 1 and 120),
  isin           text check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  asset_class    text not null check (asset_class in ('etf', 'stock', 'fund', 'bond', 'crypto', 'other')),
  -- Divisa de cotización: en la que se compra y se valora.
  currency       text not null check (currency ~ '^[A-Z]{3}$'),
  exchange       text check (exchange is null or char_length(exchange) between 1 and 24),
  exposure       jsonb not null default '{}' check (public.invest_exposure_ok(exposure)),
  -- Cuándo se pusieron los pesos: envejecen y la pantalla lo dice.
  exposure_date  date,
  -- El conid de IBKR (o el id de quien sincronice): uno por dueño.
  external_id    text check (external_id is null or char_length(external_id) between 1 and 64),
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index invest_instruments_owner_idx on public.invest_instruments (owner_id, symbol);
create unique index invest_instruments_external_uq on public.invest_instruments (owner_id, external_id)
  where external_id is not null;
create trigger invest_instruments_updated_at before update on public.invest_instruments
  for each row execute function public.set_updated_at();

-- ─── Operaciones ──────────────────────────────────────────────────────────────

create table public.invest_trades (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Sin `on delete`, como los movimientos: no se borra por debajo una cuenta o un instrumento con operaciones
  -- (al borrar el usuario, se comprueba al final de la sentencia; gotchas/db).
  account_id     uuid not null references public.finance_accounts (id),
  instrument_id  uuid not null references public.invest_instruments (id),
  -- `opening` = posición que ya tenías al empezar a llevar la cuenta en Muninn (cantidad y coste, sin comisión).
  kind           text not null check (kind in ('buy', 'sell', 'opening')),
  -- Fecha local de la operación.
  date           date not null,
  -- Participaciones en millonésimas (IBKR da fracciones de 4 decimales).
  quantity       bigint not null check (quantity > 0),
  -- Importe total sin comisión, en centésimas de la divisa del instrumento. El precio medio se calcula.
  amount         bigint not null check (amount > 0),
  fee            bigint not null default 0 check (fee >= 0),
  -- Tipo aplicado (unidades por 1 EUR, millonésimas) si el instrumento no cotiza en EUR; si no, null.
  fx_rate        bigint check (fx_rate is null or fx_rate > 0),
  note           text not null default '' check (char_length(note) <= 2000),
  external_id    text check (external_id is null or char_length(external_id) between 1 and 64),
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint invest_trades_opening_fee_ck check (kind <> 'opening' or fee = 0)
);
create index invest_trades_owner_date_idx on public.invest_trades (owner_id, date desc)
  where archived_at is null;
create index invest_trades_account_idx on public.invest_trades (account_id);
create index invest_trades_instrument_idx on public.invest_trades (instrument_id);
-- Repetir una carga (Claude hoy, IBKR mañana) no duplica: único por cuenta, también entre las archivadas (una
-- operación que archivaste no vuelve con la siguiente sincronización).
create unique index invest_trades_external_uq on public.invest_trades (account_id, external_id)
  where external_id is not null;
create trigger invest_trades_updated_at before update on public.invest_trades
  for each row execute function public.set_updated_at();

-- Última barrera, como `enforce_finance_transaction`: la cuenta es del dueño y de inversión, el instrumento es suyo, y
-- el tipo aplicado solo va con un instrumento que no cotiza en euros. El core ya lo valida (y además no deja vender
-- más de lo que hay ni cambiar de tipo una cuenta con operaciones).
create or replace function public.enforce_invest_trade() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  inst record;
begin
  if not exists (
    select 1 from public.finance_accounts
    where id = new.account_id and owner_id = new.owner_id and kind = 'investment'
  ) then
    raise exception 'account % is not an investment account of owner %', new.account_id, new.owner_id;
  end if;
  select owner_id, currency into inst from public.invest_instruments where id = new.instrument_id;
  if inst.owner_id is distinct from new.owner_id then
    raise exception 'instrument % does not belong to owner %', new.instrument_id, new.owner_id;
  end if;
  if new.fx_rate is not null and inst.currency = 'EUR' then
    raise exception 'instrument % is quoted in EUR: fx_rate must be null', new.instrument_id;
  end if;
  return new;
end;
$$;
create trigger invest_trades_consistency
  before insert or update of account_id, instrument_id, fx_rate, owner_id
  on public.invest_trades
  for each row execute function public.enforce_invest_trade();

-- ─── Precios ──────────────────────────────────────────────────────────────────

-- Cierres por usuario (ADR-0086: nunca compartidos). Un precio nuevo del mismo día sustituye al anterior; no se
-- archivan ni dejan actividad: son datos de mercado.
create table public.invest_prices (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instrument_id  uuid not null references public.invest_instruments (id) on delete cascade,
  date           date not null,
  -- Cierre por participación, en millonésimas de la divisa del instrumento.
  price          bigint not null check (price > 0),
  source         text not null default 'manual' check (source in ('manual', 'mcp', 'ibkr')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Uno por instrumento y día; «el último hasta tal día» baja por este índice hacia atrás.
create unique index invest_prices_instrument_date_uq on public.invest_prices (instrument_id, date);
create index invest_prices_owner_idx on public.invest_prices (owner_id);
create trigger invest_prices_updated_at before update on public.invest_prices
  for each row execute function public.set_updated_at();

create or replace function public.enforce_invest_price() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.invest_instruments where id = new.instrument_id and owner_id = new.owner_id
  ) then
    raise exception 'instrument % does not belong to owner %', new.instrument_id, new.owner_id;
  end if;
  return new;
end;
$$;
create trigger invest_prices_consistency
  before insert or update of instrument_id, owner_id
  on public.invest_prices
  for each row execute function public.enforce_invest_price();

-- Los últimos `per_instrument` precios de cada instrumento hasta `on_or_before` (el último y el anterior dan el
-- cambio del día): una llamada en vez de una por instrumento. Como `activity_latest_by_project`: `security invoker`
-- (manda el RLS, segundo factor incluido) y el dueño como parámetro (con la service role `auth.uid()` es null).
create or replace function public.invest_latest_prices(
  owner uuid,
  instrument_ids uuid[],
  on_or_before date,
  per_instrument int default 1
)
returns setof public.invest_prices
language sql
stable
security invoker
set search_path = ''
as $$
  select last.*
  from unnest(instrument_ids) as i(id)
  cross join lateral (
    select p.*
    from public.invest_prices p
    where p.instrument_id = i.id
      and p.owner_id = invest_latest_prices.owner
      and p.date <= on_or_before
    order by p.date desc
    limit greatest(1, least(per_instrument, 10))
  ) last;
$$;

revoke all on function public.invest_latest_prices(uuid, uuid[], date, int) from public, anon;
grant execute on function public.invest_latest_prices(uuid, uuid[], date, int) to authenticated, service_role;

-- ─── RLS, segundo factor y Realtime (checklist de gotchas/db) ─────────────────

do $$
declare
  t text;
begin
  foreach t in array array['invest_instruments', 'invest_trades', 'invest_prices']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_owner', t
    );
    -- ADR-0062: sin el segundo factor (si la cuenta lo tiene), no se ve ni se escribe nada.
    execute format(
      'create policy require_mfa on public.%I as restrictive for all to authenticated '
      'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t
    );
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
