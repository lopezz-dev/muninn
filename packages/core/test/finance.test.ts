import { beforeEach, describe, expect, it } from 'vitest'
import {
  centsFromEuros,
  createMemoryStore,
  createMuninn,
  DEFAULT_CATEGORIES,
  formatEuros,
  monthRange,
  NotFoundError,
  shiftMonth,
  ValidationError,
} from '../src'

let clock = new Date('2026-10-21T10:00:00Z')
const setup = (actor?: 'user' | 'mcp') => {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  const app = createMuninn(store, { actor, now: () => clock, timeZone: 'UTC' })
  return { store, app, f: app.finance }
}

beforeEach(() => {
  clock = new Date('2026-10-21T10:00:00Z')
})

/** Corriente, hucha y fondo, y las categorías de serie. */
async function seed() {
  const ctx = setup()
  const { f } = ctx
  const checking = await f.accounts.create({
    name: 'Imagin',
    kind: 'checking',
    initialBalance: 100_000,
  })
  const savings = await f.accounts.create({ name: 'Hucha', kind: 'savings', goal: 1_200_000 })
  const fund = await f.accounts.create({ name: 'Fondo', kind: 'investment', color: 'violet' })
  const cats = await f.categories.list()
  const cat = (key: string) => {
    const c = cats.find((x) => x.key === key)
    if (!c) throw new Error(key)
    return c
  }
  return { ...ctx, checking, savings, fund, cat }
}

describe('importes en el borde', () => {
  it('centsFromEuros entiende coma, punto, miles y el símbolo', () => {
    expect(centsFromEuros('24,90')).toBe(2490)
    expect(centsFromEuros('24,9')).toBe(2490)
    expect(centsFromEuros('1.284,30')).toBe(128430)
    expect(centsFromEuros('1,284.30')).toBe(128430)
    expect(centsFromEuros('1284.30')).toBe(128430)
    expect(centsFromEuros('1.284')).toBe(128400)
    expect(centsFromEuros('24,90 €')).toBe(2490)
    expect(centsFromEuros(24.9)).toBe(2490)
    expect(centsFromEuros(0.1 + 0.2)).toBe(30)
  })

  it('centsFromEuros rechaza lo que no es un importe positivo', () => {
    for (const bad of ['', 'abc', '-5', '0', '1,234', '2,999', 0, -3]) {
      expect(() => centsFromEuros(bad as string)).toThrow(ValidationError)
    }
  })

  it('formatEuros agrupa siempre los miles', () => {
    expect(formatEuros(128430)).toMatch(/^1\.284,30\s€$/)
    expect(formatEuros(2490)).toMatch(/^24,90\s€$/)
  })

  it('monthRange y shiftMonth', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2028-02').to).toBe('2028-02-29')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-10', 3)).toBe('2027-01')
  })
})

describe('categorías', () => {
  it('se siembran las de serie una sola vez, aunque se pidan a la vez', async () => {
    const { f } = setup()
    const [a, b] = await Promise.all([f.categories.list(), f.categories.list()])
    expect(a).toHaveLength(DEFAULT_CATEGORIES.length)
    expect(b).toHaveLength(DEFAULT_CATEGORIES.length)
    expect(await f.categories.list()).toHaveLength(DEFAULT_CATEGORIES.length)
    expect((await f.categories.list({ kind: 'income' })).map((c) => c.name)).toEqual([
      'Nómina',
      'Facturas',
      'Otros ingresos',
    ])
  })

  it('archivar todas no vuelve a sembrar', async () => {
    const { f } = setup()
    for (const c of await f.categories.list()) await f.categories.archive(c.id)
    expect(await f.categories.list()).toHaveLength(0)
    expect(await f.categories.list({ includeArchived: true })).toHaveLength(
      DEFAULT_CATEGORIES.length,
    )
  })

  it('las propias van al final, se editan y se archivan con «Deshacer»', async () => {
    const { f } = setup()
    const mine = await f.categories.create({ name: 'Mascotas', kind: 'expense', color: 'amber' })
    const expenses = await f.categories.list({ kind: 'expense' })
    expect(expenses.at(-1)?.id).toBe(mine.id)
    expect(mine.key).toBeNull()
    expect((await f.categories.update(mine.id, { name: 'Perro' })).name).toBe('Perro')
    await f.categories.archive(mine.id)
    expect((await f.categories.list()).some((c) => c.id === mine.id)).toBe(false)
    await f.categories.restore(mine.id)
    expect((await f.categories.list()).some((c) => c.id === mine.id)).toBe(true)
  })

  it('valida nombre y color', async () => {
    const { f } = setup()
    await expect(f.categories.create({ name: ' ', kind: 'expense' })).rejects.toThrow(
      ValidationError,
    )
    await expect(
      f.categories.create({ name: 'x', kind: 'expense', color: 'red' as 'blue' }),
    ).rejects.toThrow(ValidationError)
  })
})

describe('cuentas y saldo derivado', () => {
  it('el saldo parte del inicial y suma ingresos, resta gastos y mueve traspasos', async () => {
    const { f, checking, savings, cat } = await seed()
    expect(checking.balance).toBe(100_000)
    await f.transactions.create({
      kind: 'income',
      amount: 210_000,
      accountId: checking.id,
      categoryId: cat('salary').id,
      concept: 'Nómina',
    })
    await f.transactions.create({
      kind: 'expense',
      amount: 1_845,
      accountId: checking.id,
      categoryId: cat('groceries').id,
      concept: 'Mercadona',
    })
    await f.transactions.create({
      kind: 'transfer',
      amount: 60_000,
      accountId: checking.id,
      toAccountId: savings.id,
      concept: 'Traspaso a hucha',
    })
    const byName = Object.fromEntries((await f.accounts.list()).map((a) => [a.name, a.balance]))
    expect(byName).toEqual({ Imagin: 100_000 + 210_000 - 1_845 - 60_000, Hucha: 60_000, Fondo: 0 })
  })

  it('un movimiento archivado no cuenta; restaurarlo vuelve a contar', async () => {
    const { f, checking, cat } = await seed()
    const t = await f.transactions.create({
      kind: 'expense',
      amount: 5_000,
      accountId: checking.id,
      categoryId: cat('leisure').id,
    })
    expect((await f.accounts.get(checking.id)).balance).toBe(95_000)
    await f.transactions.archive(t.id)
    expect((await f.accounts.get(checking.id)).balance).toBe(100_000)
    expect(await f.transactions.list()).toHaveLength(0)
    expect(await f.transactions.list({ includeArchived: true })).toHaveLength(1)
    await f.transactions.restore(t.id)
    expect((await f.accounts.get(checking.id)).balance).toBe(95_000)
  })

  it('el saldo inicial puede ser negativo', async () => {
    const { f } = setup()
    const a = await f.accounts.create({ name: 'Tarjeta', kind: 'other', initialBalance: -2_000 })
    expect(a.balance).toBe(-2_000)
    expect(a.currency).toBe('EUR')
  })

  it('archivar una cuenta la oculta pero un traspaso desde ella sigue contando en la otra', async () => {
    const { f, checking, savings } = await seed()
    await f.transactions.create({
      kind: 'transfer',
      amount: 10_000,
      accountId: savings.id,
      toAccountId: checking.id,
    })
    await f.accounts.archive(savings.id)
    const list = await f.accounts.list()
    expect(list.map((a) => a.name)).toEqual(['Imagin', 'Fondo'])
    expect(list[0]?.balance).toBe(110_000)
    await f.accounts.restore(savings.id)
    expect(await f.accounts.list()).toHaveLength(3)
  })

  it('se reordenan', async () => {
    const { f, fund } = await seed()
    await f.accounts.move(fund.id, 0)
    expect((await f.accounts.list()).map((a) => a.name)).toEqual(['Fondo', 'Imagin', 'Hucha'])
  })
})

describe('movimientos', () => {
  it('por defecto la fecha es hoy en la zona del core', async () => {
    const { f, checking } = await seed()
    clock = new Date('2026-10-21T23:30:00Z')
    const t = await f.transactions.create({ kind: 'expense', amount: 100, accountId: checking.id })
    expect(t.date).toBe('2026-10-21')
    expect(t.categoryId).toBeNull()
  })

  it('valida importes y reglas de cada tipo', async () => {
    const { f, checking, savings, cat } = await seed()
    const bad = [
      { kind: 'expense', amount: 0, accountId: checking.id },
      { kind: 'expense', amount: 12.5, accountId: checking.id },
      { kind: 'expense', amount: -100, accountId: checking.id },
      { kind: 'transfer', amount: 100, accountId: checking.id },
      { kind: 'transfer', amount: 100, accountId: checking.id, toAccountId: checking.id },
      {
        kind: 'transfer',
        amount: 100,
        accountId: checking.id,
        toAccountId: savings.id,
        categoryId: cat('housing').id,
      },
      { kind: 'expense', amount: 100, accountId: checking.id, toAccountId: savings.id },
      { kind: 'expense', amount: 100, accountId: checking.id, categoryId: cat('salary').id },
      { kind: 'income', amount: 100, accountId: checking.id, categoryId: cat('housing').id },
    ] as const
    for (const input of bad) {
      await expect(f.transactions.create(input)).rejects.toThrow(ValidationError)
    }
    await expect(
      f.transactions.create({ kind: 'expense', amount: 100, accountId: crypto.randomUUID() }),
    ).rejects.toThrow(NotFoundError)
  })

  it('no deja apuntar en una cuenta o categoría archivada, pero sí editar lo antiguo', async () => {
    const { f, checking, savings, cat } = await seed()
    const old = await f.transactions.create({
      kind: 'expense',
      amount: 500,
      accountId: checking.id,
      categoryId: cat('leisure').id,
    })
    await f.accounts.archive(checking.id)
    await f.categories.archive(cat('leisure').id)
    await expect(
      f.transactions.create({ kind: 'expense', amount: 100, accountId: checking.id }),
    ).rejects.toThrow(/archivada/)
    expect((await f.transactions.update(old.id, { amount: 700 })).amount).toBe(700)
    await expect(f.transactions.update(old.id, { accountId: savings.id })).resolves.toBeTruthy()
    await expect(f.transactions.update(old.id, { accountId: checking.id })).rejects.toThrow(
      /archivada/,
    )
  })

  it('cambiar el tipo quita lo que deja de encajar', async () => {
    const { f, checking, savings, cat } = await seed()
    const t = await f.transactions.create({
      kind: 'expense',
      amount: 500,
      accountId: checking.id,
      categoryId: cat('leisure').id,
    })
    const transfer = await f.transactions.update(t.id, {
      kind: 'transfer',
      toAccountId: savings.id,
    })
    expect(transfer.categoryId).toBeNull()
    expect(transfer.toAccountId).toBe(savings.id)
    const income = await f.transactions.update(t.id, {
      kind: 'income',
      categoryId: cat('salary').id,
    })
    expect(income.toAccountId).toBeNull()
    expect(income.categoryId).toBe(cat('salary').id)
    const expense = await f.transactions.update(t.id, { kind: 'expense' })
    expect(expense.categoryId).toBeNull()
  })

  it('un cambio sin diferencias no escribe ni anota', async () => {
    const { f, app, checking } = await seed()
    const t = await f.transactions.create({ kind: 'expense', amount: 500, accountId: checking.id })
    const before = (await app.recentActivity({ entityId: t.id })).length
    await f.transactions.update(t.id, { amount: 500 })
    expect((await app.recentActivity({ entityId: t.id })).length).toBe(before)
  })

  it('filtra por cuenta (también lo que entra), categoría, tipo, mes y concepto', async () => {
    const { f, checking, savings, cat } = await seed()
    const mk = (input: Parameters<typeof f.transactions.create>[0]) => f.transactions.create(input)
    await mk({
      kind: 'expense',
      amount: 100,
      accountId: checking.id,
      date: '2026-09-30',
      concept: 'Gasolina',
    })
    await mk({
      kind: 'expense',
      amount: 200,
      accountId: checking.id,
      date: '2026-10-01',
      categoryId: cat('groceries').id,
      concept: 'Mercadona',
    })
    await mk({
      kind: 'transfer',
      amount: 300,
      accountId: checking.id,
      toAccountId: savings.id,
      date: '2026-10-05',
    })
    await mk({
      kind: 'income',
      amount: 400,
      accountId: savings.id,
      date: '2026-10-31',
      concept: 'Intereses',
    })

    const amounts = async (q: Parameters<typeof f.transactions.list>[0]) =>
      (await f.transactions.list(q)).map((t) => t.amount)
    expect(await amounts({})).toEqual([400, 300, 200, 100])
    expect(await amounts({ month: '2026-10' })).toEqual([400, 300, 200])
    expect(await amounts({ accountId: savings.id })).toEqual([400, 300])
    expect(await amounts({ categoryId: cat('groceries').id })).toEqual([200])
    expect(await amounts({ kinds: ['expense'] })).toEqual([200, 100])
    expect(await amounts({ search: 'merca' })).toEqual([200])
    expect(await amounts({ month: '2026-10', from: '2026-10-02' })).toEqual([400, 300])
    expect(await amounts({ limit: 1 })).toEqual([400])
    await expect(f.transactions.list({ month: '2026-13' })).rejects.toThrow(ValidationError)
  })

  it('deja rastro con el actor y sin proyecto', async () => {
    const { store, checking } = await seed()
    const mcp = createMuninn(store, { actor: 'mcp', now: () => clock, timeZone: 'UTC' })
    const t = await mcp.finance.transactions.create({
      kind: 'expense',
      amount: 2490,
      accountId: checking.id,
      concept: 'Cine',
    })
    await mcp.finance.transactions.archive(t.id)
    const events = await mcp.recentActivity({ entityId: t.id })
    expect(events.map((e) => [e.entityType, e.action, e.actor, e.projectId])).toEqual([
      ['transaction', 'archived', 'mcp', null],
      ['transaction', 'created', 'mcp', null],
    ])
    expect(events[1]?.payload).toMatchObject({ amount: 2490, concept: 'Cine' })
  })
})
