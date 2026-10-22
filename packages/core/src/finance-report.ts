import type { z } from 'zod'
import { accountGroup, monthRange, shiftMonth } from './finance'
import { type FinanceAccount, type FinanceCategory, monthKey, type Transaction } from './schemas'
import type { Store } from './store'

/** Totales de un mes, en céntimos (ADR-0037). */
export interface MonthTotals {
  month: string
  income: number
  expenses: number
  /** Neto que entra en cuentas de ahorro desde fuera de ellas (traspasos). Negativo si se sacó más de lo que se metió. */
  savings: number
  /** Lo mismo con las cuentas de inversión. */
  investment: number
  /** Ingresos − gastos − ahorro − inversión: lo que queda libre en las cuentas del día a día. */
  free: number
  /** (ingresos − gastos) / ingresos, de 0 a 1 (o negativa si gastaste más). `null` sin ingresos. */
  savingsRate: number | null
}

export interface CategorySpend {
  /** `null`: gastos sin categoría. */
  categoryId: string | null
  name: string
  color: string
  amount: number
  /** Lo mismo el mes anterior. */
  previous: number
  /** Parte del gasto del mes, de 0 a 1. */
  share: number
}

export interface MonthReport extends MonthTotals {
  previous: MonthTotals
  /** Gasto por categoría, de mayor a menor (las que tuvieron gasto este mes o el anterior). */
  byCategory: CategorySpend[]
  /** Ingresos y gastos de los últimos `months` meses, del más antiguo al pedido. */
  history: Pick<MonthTotals, 'month' | 'income' | 'expenses'>[]
}

/**
 * Suma un mes con las reglas de ADR-0037: ingresos y gastos por su tipo; ahorro e inversión por el neto de los
 * traspasos que cruzan a cuentas de ese grupo (de la corriente a la hucha suma, de la hucha a la corriente resta,
 * entre dos huchas no cuenta).
 */
export function totalsOf(
  month: string,
  list: Transaction[],
  accounts: Map<string, Pick<FinanceAccount, 'kind'>>,
): MonthTotals {
  let income = 0
  let expenses = 0
  let savings = 0
  let investment = 0
  for (const t of list) {
    if (t.archivedAt || t.date.slice(0, 7) !== month) continue
    if (t.kind === 'income') income += t.amount
    else if (t.kind === 'expense') expenses += t.amount
    else {
      const from = accountGroup(accounts.get(t.accountId)?.kind ?? 'other')
      const to = accountGroup(accounts.get(t.toAccountId ?? '')?.kind ?? 'other')
      if (from === to) continue
      if (to === 'savings') savings += t.amount
      if (from === 'savings') savings -= t.amount
      if (to === 'investment') investment += t.amount
      if (from === 'investment') investment -= t.amount
    }
  }
  return {
    month,
    income,
    expenses,
    savings,
    investment,
    free: income - expenses - savings - investment,
    savingsRate: income > 0 ? (income - expenses) / income : null,
  }
}

/** Panel mensual (bloque D de la F3): se calcula en el core para que la UI, el MCP y Jarvis digan lo mismo. */
export function createFinanceReport({
  store,
  parse,
}: {
  store: Store
  parse: <S extends z.ZodType>(schema: S, value: unknown) => z.output<S>
}) {
  async function month(input: string, opts: { months?: number } = {}): Promise<MonthReport> {
    const m = parse(monthKey, input)
    const months = Math.min(Math.max(opts.months ?? 6, 2), 24)
    const first = shiftMonth(m, -(months - 1))
    const [list, accounts, categories] = await Promise.all([
      store.transactions.list({ from: monthRange(first).from, to: monthRange(m).to }),
      store.financeAccounts.list({ includeArchived: true }),
      store.financeCategories.list({ includeArchived: true }),
    ])
    const accountById = new Map(accounts.map((a) => [a.id, a]))
    const categoryById = new Map<string, FinanceCategory>(categories.map((c) => [c.id, c]))
    const prev = shiftMonth(m, -1)

    const current = totalsOf(m, list, accountById)
    const previous = totalsOf(prev, list, accountById)

    const spend = new Map<string | null, { amount: number; previous: number }>()
    for (const t of list) {
      if (t.kind !== 'expense') continue
      const ym = t.date.slice(0, 7)
      if (ym !== m && ym !== prev) continue
      const row = spend.get(t.categoryId) ?? { amount: 0, previous: 0 }
      if (ym === m) row.amount += t.amount
      else row.previous += t.amount
      spend.set(t.categoryId, row)
    }
    const byCategory: CategorySpend[] = [...spend]
      .map(([categoryId, v]) => {
        const c = categoryId ? categoryById.get(categoryId) : undefined
        return {
          categoryId,
          name: c?.name ?? 'Sin categoría',
          color: c?.color ?? 'gray',
          amount: v.amount,
          previous: v.previous,
          share: current.expenses > 0 ? v.amount / current.expenses : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount || b.previous - a.previous)

    const history = Array.from({ length: months }, (_, i) => {
      const t = totalsOf(shiftMonth(first, i), list, accountById)
      return { month: t.month, income: t.income, expenses: t.expenses }
    })

    return { ...current, previous, byCategory, history }
  }

  return { month }
}
