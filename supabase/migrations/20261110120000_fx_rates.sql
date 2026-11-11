-- Divisas (ADR-0085). Solo aditiva: una tabla nueva, `fx_rates`, con los tipos de referencia del euro del BCE.
--
-- EXCEPCIÓN CON NOMBRE a «toda tabla con owner_id + RLS» (gotchas/db, checklist de tabla nueva): es un dato de
-- referencia público e igual para todos, así que no lleva `owner_id`. Condiciones del ADR:
--   · RLS activado y una sola política, de lectura, para `authenticated` (`using (true)`).
--   · Ninguna de escritura: solo escribe la service role, desde la Edge Function `fx`.
--   · Sin `require_mfa` (no es un dato del usuario) y fuera de Realtime (cambia una vez al día).
-- Nada que escriba un usuario va nunca a esta tabla. No copies este patrón para datos del usuario.

create table public.fx_rates (
  -- ISO 4217 en mayúsculas. Nunca EUR: es la base (1 EUR = `rate` unidades de la divisa).
  currency   text not null check (currency ~ '^[A-Z]{3}$' and currency <> 'EUR'),
  date       date not null,
  -- Unidades de la divisa por 1 EUR, en millonésimas (1,0876 USD → 1087600). El BCE publica como mucho seis decimales.
  rate       bigint not null check (rate > 0),
  source     text not null default 'ecb' check (source in ('ecb')),
  created_at timestamptz not null default now(),
  -- «El tipo de ese día o el último anterior» lee el índice de la clave hacia atrás: (currency, date desc) limit 1.
  primary key (currency, date)
);

comment on table public.fx_rates is
  'Tipos de referencia del BCE (ADR-0085). Compartida: sin owner_id, solo lectura para authenticated, la escribe la función fx.';

alter table public.fx_rates enable row level security;

create policy fx_rates_read on public.fx_rates
  for select to authenticated
  using (true);

-- Los permisos por defecto de Supabase dan todo a anon y authenticated; RLS ya lo frena, pero que no quede ni el permiso.
revoke all on public.fx_rates from anon;
revoke insert, update, delete, truncate, references, trigger on public.fx_rates from authenticated;
grant select on public.fx_rates to authenticated;
