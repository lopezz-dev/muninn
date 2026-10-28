import { describe, expect, it } from 'vitest'
import { createMemoryStore, createMuninn, ValidationError } from '../src'

const clock = new Date('2026-10-21T10:00:00Z')

async function setup() {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  const app = createMuninn(store, { now: () => clock, timeZone: 'UTC' })
  const f = app.finance
  const checking = await f.accounts.create({ name: 'Imagin', kind: 'checking' })
  const savings = await f.accounts.create({ name: 'Hucha', kind: 'savings' })
  const savings2 = await f.accounts.create({ name: 'Hucha 2', kind: 'savings' })
  const fund = await f.accounts.create({ name: 'Fondo', kind: 'investment' })
  const cats = await f.categories.list()
  const cat = (key: string) => cats.find((c) => c.key === key)?.id ?? null
  const T = f.transactions
  // Septiembre
  await T.create({ kind: 'income', amount: 200_000, accountId: checking.id, date: '2026-09-01' })
  await T.create({
    kind: 'expense',
    amount: 60_000,
    accountId: checking.id,
    categoryId: cat('housing'),
    date: '2026-09-01',
  })
  await T.create({
    kind: 'expense',
    amount: 20_000,
    accountId: checking.id,
    categoryId: cat('leisure'),
    date: '2026-09-12',
  })
  // Octubre
  await T.create({
    kind: 'income',
    amount: 210_000,
    accountId: checking.id,
    categoryId: cat('salary'),
    date: '2026-10-01',
  })
  await T.create({
    kind: 'income',
    amount: 85_000,
    accountId: checking.id,
    categoryId: cat('invoices'),
    date: '2026-10-14',
  })
  await T.create({
    kind: 'expense',
    amount: 65_000,
    accountId: checking.id,
    categoryId: cat('housing'),
    date: '2026-10-01',
  })
  await T.create({
    kind: 'expense',
    amount: 24_180,
    accountId: checking.id,
    categoryId: cat('groceries'),
    date: '2026-10-19',
  })
  await T.create({ kind: 'expense', amount: 5_500, accountId: checking.id, date: '2026-10-20' })
  await T.create({
    kind: 'transfer',
    amount: 60_000,
    accountId: checking.id,
    toAccountId: savings.id,
    date: '2026-10-05',
  })
  await T.create({
    kind: 'transfer',
    amount: 10_000,
    accountId: savings.id,
    toAccountId: checking.id,
    date: '2026-10-20',
  })
  await T.create({
    kind: 'transfer',
    amount: 5_000,
    accountId: savings.id,
    toAccountId: savings2.id,
    date: '2026-10-21',
  })
  await T.create({
    kind: 'transfer',
    amount: 30_000,
    accountId: checking.id,
    toAccountId: fund.id,
    date: '2026-10-05',
  })
  const archived = await T.create({
    kind: 'expense',
    amount: 99_999,
    accountId: checking.id,
    date: '2026-10-02',
  })
  await T.archive(archived.id)
  // Noviembre (fuera del mes pedido)
  await T.create({ kind: 'expense', amount: 1_000, accountId: checking.id, date: '2026-11-01' })
  return { f }
}

describe('panel mensual', () => {
  it('entradas, salidas, ahorro, inversión, libre y tasa de ahorro', async () => {
    const { f } = await setup()
    const r = await f.report.month('2026-10')
    expect(r.income).toBe(295_000)
    expect(r.expenses).toBe(65_000 + 24_180 + 5_500)
    // Entre dos huchas no cuenta; sacar de la hucha resta.
    expect(r.savings).toBe(60_000 - 10_000)
    expect(r.investment).toBe(30_000)
    expect(r.free).toBe(295_000 - 94_680 - 50_000 - 30_000)
    expect(r.savingsRate).toBeCloseTo((295_000 - 94_680) / 295_000)
  })

  it('compara con el mes anterior', async () => {
    const { f } = await setup()
    const r = await f.report.month('2026-10')
    expect(r.previous).toMatchObject({ month: '2026-09', income: 200_000, expenses: 80_000 })
    expect(r.previous.savingsRate).toBeCloseTo(0.6)
  })

  it('gasto por categoría, con el mes anterior y su parte del total', async () => {
    const { f } = await setup()
    const r = await f.report.month('2026-10')
    expect(r.byCategory.map((c) => [c.name, c.amount, c.previous])).toEqual([
      ['Vivienda', 65_000, 60_000],
      ['Supermercado', 24_180, 0],
      ['Sin categoría', 5_500, 0],
      ['Ocio', 0, 20_000],
    ])
    expect(r.byCategory[0]?.share).toBeCloseTo(65_000 / 94_680)
    expect(r.byCategory.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1)
  })

  it('histórico de los últimos meses, del más antiguo al pedido', async () => {
    const { f } = await setup()
    const r = await f.report.month('2026-10')
    expect(r.history.map((h) => h.month)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
    expect(r.history.at(-2)).toEqual({ month: '2026-09', income: 200_000, expenses: 80_000 })
    expect((await f.report.month('2026-10', { months: 3 })).history).toHaveLength(3)
  })

  it('sin ingresos no hay tasa; mes vacío a cero; mes mal escrito, error', async () => {
    const { f } = await setup()
    const empty = await f.report.month('2025-01')
    expect(empty).toMatchObject({ income: 0, expenses: 0, savingsRate: null, byCategory: [] })
    await expect(f.report.month('2026-13')).rejects.toThrow(ValidationError)
  })
})
