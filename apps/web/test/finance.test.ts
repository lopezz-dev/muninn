import type { AccountWithBalance, Transaction } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import {
  amountText,
  applyToBalances,
  dayLabel,
  entryKindOf,
  filterTransactions,
  groupByDay,
  monthLabel,
  NO_TX_FILTER,
  putTransaction,
  shiftMonth,
  signedAmount,
} from '../src/lib/finance'

let n = 0
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  kind: 'expense',
  amount: 100,
  date: '2026-10-19',
  accountId: 'a',
  toAccountId: null,
  categoryId: null,
  concept: '',
  note: '',
  archivedAt: null,
  createdAt: `2026-10-19T10:00:0${n % 10}Z`,
  updatedAt: '2026-10-19T10:00:00Z',
  ...p,
})

const account = (
  id: string,
  kind: AccountWithBalance['kind'],
  balance = 0,
): AccountWithBalance => ({
  id,
  name: id,
  kind,
  color: 'blue',
  initialBalance: 0,
  goal: null,
  currency: 'EUR',
  position: 'a0',
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
  balance,
})

const accounts = new Map([
  ['a', account('a', 'checking')],
  ['h', account('h', 'savings')],
  ['f', account('f', 'investment')],
  ['c', account('c', 'cash')],
])

describe('finanzas · presentación', () => {
  it('un traspaso a la hucha es «Ahorro» y al fondo «Inversión»', () => {
    expect(entryKindOf(tx({ kind: 'transfer', toAccountId: 'h' }), accounts)).toBe('saving')
    expect(entryKindOf(tx({ kind: 'transfer', toAccountId: 'f' }), accounts)).toBe('investment')
    expect(entryKindOf(tx({ kind: 'transfer', toAccountId: 'c' }), accounts)).toBe('transfer')
    expect(entryKindOf(tx({ kind: 'income' }), accounts)).toBe('income')
  })

  it('signo de cada movimiento, con y sin cuenta filtrada', () => {
    const t = tx({ kind: 'transfer', amount: 600, toAccountId: 'h' })
    expect(signedAmount(tx({ kind: 'expense', amount: 5 }))).toBe(-5)
    expect(signedAmount(tx({ kind: 'income', amount: 5 }))).toBe(5)
    expect(signedAmount(t)).toBe(0)
    expect(signedAmount(t, 'a')).toBe(-600)
    expect(signedAmount(t, 'h')).toBe(600)
    expect(amountText(-1845)).toBe('−18,45 €')
    expect(amountText(85000)).toBe('+850,00 €')
    expect(amountText(-128430, 'none')).toBe('1.284,30 €')
  })

  it('agrupa por día con el total de ingresos menos gastos', () => {
    const list = [
      tx({ date: '2026-10-19', amount: 1845 }),
      tx({ date: '2026-10-17', amount: 3290 }),
      tx({ date: '2026-10-17', amount: 1000 }),
      tx({ date: '2026-10-05', kind: 'transfer', amount: 60000, toAccountId: 'h' }),
    ]
    const groups = groupByDay(list)
    expect(groups.map((g) => [g.date, g.items.length, g.total, g.moved])).toEqual([
      ['2026-10-19', 1, -1845, 0],
      ['2026-10-17', 2, -4290, 0],
      ['2026-10-05', 1, 0, 60000],
    ])
  })

  it('filtra por texto sin tildes, tipo, categoría y cuenta (también la de destino)', () => {
    const list = [
      tx({ concept: 'Cafetería' }),
      tx({ kind: 'transfer', toAccountId: 'h', concept: 'Hucha' }),
      tx({ categoryId: 'ocio', concept: 'Cine' }),
    ]
    const f = (p: Partial<typeof NO_TX_FILTER>) =>
      filterTransactions(list, { ...NO_TX_FILTER, ...p }, accounts).map((t) => t.concept)
    expect(f({ query: 'cafeteria' })).toEqual(['Cafetería'])
    expect(f({ kind: 'saving' })).toEqual(['Hucha'])
    expect(f({ categoryId: 'ocio' })).toEqual(['Cine'])
    expect(f({ accountId: 'h' })).toEqual(['Hucha'])
  })

  it('etiquetas de día y de mes', () => {
    expect(dayLabel('2026-10-19', '2026-10-19')).toBe('Hoy · lunes 19')
    expect(dayLabel('2026-10-18', '2026-10-19')).toBe('Ayer · domingo 18')
    expect(dayLabel('2026-10-17', '2026-10-19')).toBe('Sábado 17')
    expect(monthLabel('2026-10')).toBe('Octubre 2026')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('finanzas · caché optimista', () => {
  it('putTransaction coloca por fecha y deja arriba el recién creado del mismo día', () => {
    const a = tx({ date: '2026-10-19', createdAt: '2026-10-19T08:00:00Z' })
    const b = tx({ date: '2026-10-10' })
    const c = tx({ date: '2026-10-19', createdAt: '2026-10-19T09:00:00Z' })
    const d = tx({ date: '2026-10-15' })
    let list = putTransaction(putTransaction([], a), b)
    list = putTransaction(list, c)
    list = putTransaction(list, d)
    expect(list.map((t) => t.id)).toEqual([c.id, a.id, d.id, b.id])
    expect(putTransaction(list, { ...d, amount: 9 }).find((t) => t.id === d.id)?.amount).toBe(9)
  })

  it('applyToBalances suma y deshace como la vista del servidor', () => {
    const list = [account('a', 'checking', 1000), account('h', 'savings', 0)]
    const t = { kind: 'transfer' as const, amount: 300, accountId: 'a', toAccountId: 'h' }
    const after = applyToBalances(list, t, 1)
    expect(after.map((x) => x.balance)).toEqual([700, 300])
    expect(applyToBalances(after, t, -1).map((x) => x.balance)).toEqual([1000, 0])
    const income = { kind: 'income' as const, amount: 50, accountId: 'a', toAccountId: null }
    expect(applyToBalances(list, income, 1)[0]?.balance).toBe(1050)
  })
})
