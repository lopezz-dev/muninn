import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createInstrumentInput,
  createMemoryStore,
  createTradeInput,
  DuplicateError,
  emptySnapshot,
  exposureInput,
  isDuplicate,
  setPricesInput,
} from '../src'
import { createFileStore } from '../src/file-store'
import { createSupabaseStore } from '../src/supabase-store'

const ACCOUNT = crypto.randomUUID()
const OTHER_ACCOUNT = crypto.randomUUID()

const instrument = (over: Record<string, unknown> = {}) => ({
  symbol: 'SXR8',
  name: 'iShares Core S&P 500',
  isin: 'IE00B5BMR087',
  assetClass: 'etf' as const,
  currency: 'EUR',
  exchange: 'IBIS2',
  exposure: { USD: 10_000 },
  exposureDate: '2026-11-10',
  externalId: '75961307',
  archivedAt: null,
  ...over,
})

const trade = (instrumentId: string, over: Record<string, unknown> = {}) => ({
  accountId: ACCOUNT,
  instrumentId,
  kind: 'buy' as const,
  date: '2026-11-03',
  // 1,2345 participaciones: fracciones de cuatro decimales, como las de IBKR.
  quantity: 1_234_500,
  amount: 70_012,
  fee: 0,
  fxRate: null,
  note: '',
  externalId: null,
  archivedAt: null,
  ...over,
})

describe('esquemas de Inversiones', () => {
  it('exposición: claves en mayúsculas, enteros de 1 a 10000 y suma de 10000 como mucho', () => {
    expect(exposureInput.parse({ usd: 6300, JPY: 600 })).toEqual({ USD: 6300, JPY: 600 })
    expect(exposureInput.parse({})).toEqual({})
    expect(exposureInput.safeParse({ USD: 6000, JPY: 5000 }).success).toBe(false)
    expect(exposureInput.safeParse({ USD: 12.5 }).success).toBe(false)
    expect(exposureInput.safeParse({ USD: 0 }).success).toBe(false)
    expect(exposureInput.safeParse({ dólar: 100 }).success).toBe(false)
  })

  it('instrumento: ISIN y divisa normalizados', () => {
    const i = createInstrumentInput.parse({
      symbol: ' VWCE ',
      name: 'Vanguard FTSE All-World',
      isin: 'ie00bk5bqt80',
      assetClass: 'etf',
      currency: 'eur',
    })
    expect(i).toMatchObject({ symbol: 'VWCE', isin: 'IE00BK5BQT80', currency: 'EUR' })
    expect(createInstrumentInput.safeParse({ ...i, isin: 'IE00' }).success).toBe(false)
    expect(createInstrumentInput.safeParse({ ...i, assetClass: 'warrant' }).success).toBe(false)
  })

  it('operación: enteros positivos y sin comisión en una posición inicial', () => {
    const base = {
      accountId: ACCOUNT,
      instrumentId: crypto.randomUUID(),
      kind: 'buy',
      date: '2026-11-03',
      quantity: 1_234_500,
      amount: 70_012,
    }
    expect(createTradeInput.safeParse(base).success).toBe(true)
    expect(createTradeInput.safeParse({ ...base, quantity: 1.5 }).success).toBe(false)
    expect(createTradeInput.safeParse({ ...base, quantity: 0 }).success).toBe(false)
    expect(createTradeInput.safeParse({ ...base, fee: -1 }).success).toBe(false)
    expect(createTradeInput.safeParse({ ...base, kind: 'opening', fee: 0 }).success).toBe(true)
    expect(createTradeInput.safeParse({ ...base, kind: 'opening', fee: 150 }).success).toBe(false)
  })

  it('precios por lotes: de 1 a 500', () => {
    const p = { instrumentId: crypto.randomUUID(), date: '2026-11-10', price: 618_000_000 }
    expect(setPricesInput.safeParse([p]).success).toBe(true)
    expect(setPricesInput.safeParse([]).success).toBe(false)
    expect(setPricesInput.safeParse([{ ...p, price: 0 }]).success).toBe(false)
  })
})

describe('store de memoria · Inversiones', () => {
  it('external_id único por dueño en instrumentos y por cuenta en operaciones (también archivadas)', async () => {
    const store = createMemoryStore()
    const sxr8 = await store.investInstruments.insert(instrument())
    await expect(store.investInstruments.insert(instrument({ symbol: 'Otro' }))).rejects.toThrow(
      DuplicateError,
    )
    // Sin id externo no entran en el índice.
    await store.investInstruments.insertMany([
      instrument({ externalId: null, symbol: 'A' }),
      instrument({ externalId: null, symbol: 'B' }),
    ])

    const t = await store.investTrades.insert(trade(sxr8.id, { externalId: 'U1|1' }))
    await store.investTrades.update(t.id, { archivedAt: '2026-11-10T00:00:00Z' })
    const again = await store.investTrades
      .insert(trade(sxr8.id, { externalId: 'U1|1' }))
      .catch((e) => e)
    expect(isDuplicate(again)).toBe(true)
    // En otra cuenta sí puede repetirse; dos iguales en el mismo lote, no.
    await store.investTrades.insert(
      trade(sxr8.id, { externalId: 'U1|1', accountId: OTHER_ACCOUNT }),
    )
    await expect(
      store.investTrades.insertMany([
        trade(sxr8.id, { externalId: 'U1|2' }),
        trade(sxr8.id, { externalId: 'U1|2' }),
      ]),
    ).rejects.toThrow(DuplicateError)
    // El lote fallido no deja nada a medias.
    expect(await store.investTrades.list({ externalId: 'U1|2' })).toEqual([])
    // Cambiar el id externo a uno que ya está, tampoco.
    const other = await store.investTrades.insert(trade(sxr8.id))
    await expect(store.investTrades.update(other.id, { externalId: 'U1|1' })).rejects.toThrow(
      DuplicateError,
    )
  })

  it('operaciones de la más reciente a la más antigua, con filtros y sin las archivadas', async () => {
    let clock = 0
    const store = createMemoryStore(undefined, {
      now: () => new Date(Date.UTC(2026, 10, 10, 0, 0, clock++)).toISOString(),
    })
    const i = await store.investInstruments.insert(instrument())
    const a = await store.investTrades.insert(trade(i.id, { date: '2026-11-03' }))
    const b = await store.investTrades.insert(trade(i.id, { date: '2026-11-05', kind: 'sell' }))
    const c = await store.investTrades.insert(trade(i.id, { date: '2026-11-05' }))
    await store.investTrades.insert(trade(i.id, { date: '2026-11-06', accountId: OTHER_ACCOUNT }))
    const archived = await store.investTrades.insert(trade(i.id, { date: '2026-11-07' }))
    await store.investTrades.update(archived.id, { archivedAt: '2026-11-10T00:00:00Z' })

    const ids = (rows: { id: string }[]) => rows.map((r) => r.id)
    expect(ids(await store.investTrades.list({ accountId: ACCOUNT }))).toEqual([c.id, b.id, a.id])
    expect(ids(await store.investTrades.list({ accountId: ACCOUNT, kinds: ['sell'] }))).toEqual([
      b.id,
    ])
    expect(
      ids(
        await store.investTrades.list({ accountId: ACCOUNT, from: '2026-11-04', to: '2026-11-05' }),
      ),
    ).toEqual([c.id, b.id])
    expect(
      await store.investTrades.list({ accountId: ACCOUNT, includeArchived: true }),
    ).toHaveLength(4)
    expect(await store.investTrades.list({ limit: 2 })).toHaveLength(2)
  })

  it('precios: uno por instrumento y día, y los últimos de cada uno hasta una fecha', async () => {
    const store = createMemoryStore()
    const sxr8 = await store.investInstruments.insert(instrument())
    const aapl = await store.investInstruments.insert(
      instrument({ symbol: 'AAPL', currency: 'USD', externalId: '265598', exposure: {} }),
    )
    await store.investPrices.upsert([
      { instrumentId: sxr8.id, date: '2026-11-06', price: 612_340_000, source: 'mcp' },
      { instrumentId: sxr8.id, date: '2026-11-09', price: 615_000_000, source: 'mcp' },
      { instrumentId: sxr8.id, date: '2026-11-10', price: 618_000_000, source: 'mcp' },
      { instrumentId: aapl.id, date: '2026-11-07', price: 230_000_000, source: 'manual' },
    ])
    // El mismo día sustituye.
    const [replaced] = await store.investPrices.upsert([
      { instrumentId: sxr8.id, date: '2026-11-10', price: 619_000_000, source: 'ibkr' },
    ])
    expect(replaced).toMatchObject({ price: 619_000_000, source: 'ibkr' })
    expect(
      await store.investPrices.list({
        instrumentId: sxr8.id,
        from: '2026-11-01',
        to: '2026-11-30',
      }),
    ).toHaveLength(3)

    const latest = await store.investPrices.latest([sxr8.id, aapl.id], '2026-11-09', 2)
    expect(latest.map((p) => `${p.instrumentId === sxr8.id ? 'SXR8' : 'AAPL'} ${p.date}`)).toEqual([
      'SXR8 2026-11-09',
      'SXR8 2026-11-06',
      'AAPL 2026-11-07',
    ])
    expect((await store.investPrices.latest([sxr8.id], '2026-12-31')).map((p) => p.price)).toEqual([
      619_000_000,
    ])
    expect(await store.investPrices.latest([sxr8.id], '2026-11-01')).toEqual([])
    expect(await store.investPrices.latest([], '2026-11-10')).toEqual([])
  })

  it('el fichero guarda Inversiones y lee los de antes, que no las traen', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'muninn-invest-'))
    const path = join(dir, 'data.json')
    const old = emptySnapshot() as unknown as Record<string, unknown>
    delete old.investInstruments
    writeFileSync(path, JSON.stringify(old))

    const store = createFileStore(path)
    expect(await store.investInstruments.list({})).toEqual([])
    const i = await store.investInstruments.insert(instrument())
    await store.investTrades.insert(trade(i.id))
    await store.investPrices.upsert([
      { instrumentId: i.id, date: '2026-11-10', price: 618_000_000, source: 'manual' },
    ])
    const saved = JSON.parse(readFileSync(path, 'utf8'))
    expect(saved.investInstruments).toHaveLength(1)
    expect(saved.investTrades).toHaveLength(1)
    expect(saved.investPrices).toHaveLength(1)

    const reopened = createFileStore(path)
    expect((await reopened.investTrades.list({}))[0]?.quantity).toBe(1_234_500)
  })
})

/** Cliente de Supabase falso: apunta cada llamada (tabla, filtros, RPC) y contesta con `reply`. */
function recordingClient(reply: (call: { table?: string; rpc?: string }) => unknown[]) {
  const calls: { table?: string; rpc?: string; ops: [string, unknown[]][] }[] = []
  const builder = (call: (typeof calls)[number]) => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_, prop: string) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => void) => resolve({ data: reply(call), error: null })
          }
          return (...args: unknown[]) => {
            call.ops.push([prop, args])
            return proxy
          }
        },
      },
    )
    return proxy
  }
  const client = {
    from(table: string) {
      const call = { table, ops: [] }
      calls.push(call)
      return builder(call)
    },
    rpc(name: string, args: unknown) {
      const call = { rpc: name, ops: [['args', [args]] as [string, unknown[]]] }
      calls.push(call)
      return builder(call)
    },
  }
  return { client, calls }
}

describe('store de Supabase · Inversiones', () => {
  const owner = crypto.randomUUID()

  it('los últimos precios van en una sola RPC con el dueño y los ids en el cuerpo', async () => {
    const { client, calls } = recordingClient(() => [
      {
        id: 'p1',
        owner_id: owner,
        instrument_id: 'i1',
        date: '2026-11-10',
        price: '618000000',
        source: 'mcp',
        created_at: 'x',
        updated_at: 'x',
      },
    ])
    // biome-ignore lint/suspicious/noExplicitAny: cliente falso
    const store = createSupabaseStore(client as any, owner)
    const rows = await store.investPrices.latest(['i1', 'i2'], '2026-11-10', 2)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      rpc: 'invest_latest_prices',
      ops: [
        [
          'args',
          [{ owner, instrument_ids: ['i1', 'i2'], on_or_before: '2026-11-10', per_instrument: 2 }],
        ],
      ],
    })
    // Sin `owner_id`, en camelCase y con el precio como número.
    expect(rows).toEqual([
      {
        id: 'p1',
        instrumentId: 'i1',
        date: '2026-11-10',
        price: 618_000_000,
        source: 'mcp',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ])
    expect(await store.investPrices.latest([], '2026-11-10')).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('upsert de precios con el dueño y la clave (instrumento, día)', async () => {
    const { client, calls } = recordingClient(() => [])
    // biome-ignore lint/suspicious/noExplicitAny: cliente falso
    const store = createSupabaseStore(client as any, owner)
    await store.investPrices.upsert([
      { instrumentId: 'i1', date: '2026-11-10', price: 618_000_000, source: 'mcp' },
    ])
    expect(calls[0]?.table).toBe('invest_prices')
    expect(calls[0]?.ops[0]).toEqual([
      'upsert',
      [
        [
          {
            instrument_id: 'i1',
            date: '2026-11-10',
            price: 618_000_000,
            source: 'mcp',
            owner_id: owner,
          },
        ],
        { onConflict: 'instrument_id,date' },
      ],
    ])
  })

  it('operaciones: del dueño, sin archivadas, filtradas y en orden total', async () => {
    const { client, calls } = recordingClient(() => [])
    // biome-ignore lint/suspicious/noExplicitAny: cliente falso
    const store = createSupabaseStore(client as any, owner)
    await store.investTrades.list({ accountId: 'a1', kinds: ['buy', 'opening'], limit: 50 })
    expect(calls[0]?.table).toBe('invest_trades')
    expect(calls[0]?.ops).toEqual([
      ['select', ['*']],
      ['eq', ['owner_id', owner]],
      ['is', ['archived_at', null]],
      ['eq', ['account_id', 'a1']],
      ['in', ['kind', ['buy', 'opening']]],
      ['order', ['date', { ascending: false }]],
      ['order', ['created_at', { ascending: false }]],
      ['order', ['id']],
      ['limit', [50]],
    ])
  })
})
