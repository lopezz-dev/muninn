import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMemoryStore,
  createMuninn,
  monthlyCost,
  nextChargeDate,
  ValidationError,
} from '../src'

let clock = new Date('2026-10-21T10:00:00Z')
beforeEach(() => {
  clock = new Date('2026-10-21T10:00:00Z')
})

async function setup() {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  const app = createMuninn(store, { now: () => clock, timeZone: 'UTC' })
  const f = app.finance
  const account = await f.accounts.create({
    name: 'Imagin',
    kind: 'checking',
    initialBalance: 10_000,
  })
  const subsCat = (await f.categories.list()).find((c) => c.key === 'subscriptions')
  if (!subsCat) throw new Error('sin categoría')
  return { app, f, s: f.subscriptions, account, subsCat }
}

describe('fechas de cobro', () => {
  it('mensual: conserva el día del ciclo tras un mes corto', () => {
    expect(nextChargeDate('2026-01-31', '2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(nextChargeDate('2026-01-31', '2026-02-28', 'monthly')).toBe('2026-03-31')
    expect(nextChargeDate('2026-01-31', '2026-03-31', 'monthly')).toBe('2026-04-30')
    expect(nextChargeDate('2026-10-24', '2026-12-24', 'monthly')).toBe('2027-01-24')
  })

  it('anual (también el 29 de febrero) y semanal', () => {
    expect(nextChargeDate('2026-03-12', '2026-03-12', 'yearly')).toBe('2027-03-12')
    expect(nextChargeDate('2028-02-29', '2028-02-29', 'yearly')).toBe('2029-02-28')
    expect(nextChargeDate('2028-02-29', '2031-02-28', 'yearly')).toBe('2032-02-29')
    expect(nextChargeDate('2026-10-21', '2026-12-30', 'weekly')).toBe('2027-01-06')
  })

  it('coste mensual equivalente', () => {
    expect(monthlyCost({ amount: 1099, frequency: 'monthly' })).toBe(1099)
    expect(monthlyCost({ amount: 2198, frequency: 'yearly' })).toBe(183)
    expect(monthlyCost({ amount: 500, frequency: 'weekly' })).toBe(2167)
  })
})

describe('suscripciones', () => {
  it('apuntar el cobro crea el gasto enlazado, descuenta el saldo y adelanta la fecha', async () => {
    const { f, s, account, subsCat } = await setup()
    const sub = await s.create({
      name: 'Spotify',
      amount: 1099,
      frequency: 'monthly',
      accountId: account.id,
      categoryId: subsCat.id,
      nextDate: '2026-10-21',
    })
    expect(sub.anchorDate).toBe('2026-10-21')
    expect(sub.remindDays).toBe(3)
    const { transaction, subscription, previousDate } = await s.charge(sub.id, {
      expected: '2026-10-21',
    })
    expect(transaction).toMatchObject({
      kind: 'expense',
      amount: 1099,
      date: '2026-10-21',
      concept: 'Spotify',
      categoryId: subsCat.id,
      subscriptionId: sub.id,
    })
    expect(subscription.nextDate).toBe('2026-11-21')
    expect(previousDate).toBe('2026-10-21')
    expect((await f.accounts.get(account.id)).balance).toBe(10_000 - 1099)
  })

  it('el mismo cobro no se apunta dos veces (fecha esperada)', async () => {
    const { s, account } = await setup()
    const sub = await s.create({
      name: 'Claude',
      amount: 10_000,
      frequency: 'monthly',
      accountId: account.id,
      nextDate: '2026-10-24',
    })
    await s.charge(sub.id, { expected: '2026-10-24' })
    await expect(s.charge(sub.id, { expected: '2026-10-24' })).rejects.toThrow(/ya está apuntado/)
    await expect(s.skip(sub.id, { expected: '2026-10-24' })).rejects.toThrow(ValidationError)
  })

  it('saltar adelanta sin gasto; revertir vuelve atrás y archiva el gasto', async () => {
    const { f, s, account } = await setup()
    const sub = await s.create({
      name: 'Gimnasio',
      amount: 3_000,
      frequency: 'monthly',
      accountId: account.id,
      nextDate: '2026-10-31',
    })
    const skipped = await s.skip(sub.id)
    expect(skipped.subscription.nextDate).toBe('2026-11-30')
    expect(await f.transactions.list()).toHaveLength(0)
    await s.revert(sub.id, { previousDate: skipped.previousDate })

    const charged = await s.charge(sub.id)
    expect(charged.subscription.nextDate).toBe('2026-11-30')
    const back = await s.revert(sub.id, {
      previousDate: charged.previousDate,
      transactionId: charged.transaction.id,
    })
    expect(back.nextDate).toBe('2026-10-31')
    expect(back.anchorDate).toBe('2026-10-31')
    expect(await f.transactions.list()).toHaveLength(0)
    expect((await f.accounts.get(account.id)).balance).toBe(10_000)
  })

  it('upcoming: dentro de sus días de aviso y las vencidas, de la más próxima a la más lejana', async () => {
    const { s, account } = await setup()
    const mk = (name: string, nextDate: string, remindDays?: number) =>
      s.create({
        name,
        amount: 100,
        frequency: 'monthly',
        accountId: account.id,
        nextDate,
        remindDays,
      })
    await mk('Lejana', '2026-11-15')
    await mk('Mañana', '2026-10-22')
    await mk('Vencida', '2026-10-18')
    await mk('Con aviso largo', '2026-10-30', 10)
    const up = await s.upcoming()
    expect(up.map((u) => [u.name, u.daysUntil, u.overdue])).toEqual([
      ['Vencida', -3, true],
      ['Mañana', 1, false],
      ['Con aviso largo', 9, false],
    ])
    expect((await s.upcoming({ days: 30 })).map((u) => u.name)).toContain('Lejana')
  })

  it('cambiar la fecha mueve el ciclo; la categoría tiene que ser de gastos', async () => {
    const { f, s, account } = await setup()
    const salary = (await f.categories.list({ kind: 'income' }))[0]
    await expect(
      s.create({
        name: 'x',
        amount: 1,
        frequency: 'monthly',
        accountId: account.id,
        categoryId: salary?.id,
        nextDate: '2026-11-01',
      }),
    ).rejects.toThrow(/gastos/)
    const sub = await s.create({
      name: 'Dominio',
      amount: 2198,
      frequency: 'yearly',
      accountId: account.id,
      nextDate: '2027-03-12',
    })
    const moved = await s.update(sub.id, { nextDate: '2027-03-31' })
    expect(moved.anchorDate).toBe('2027-03-31')
  })

  it('archivada: no avisa ni se cobra; se recupera', async () => {
    const { s, account } = await setup()
    const sub = await s.create({
      name: 'Netflix',
      amount: 1_299,
      frequency: 'monthly',
      accountId: account.id,
      nextDate: '2026-10-22',
    })
    await s.archive(sub.id)
    expect(await s.upcoming()).toHaveLength(0)
    await expect(s.charge(sub.id)).rejects.toThrow(/archivada/)
    await s.restore(sub.id)
    expect(await s.upcoming()).toHaveLength(1)
  })
})
