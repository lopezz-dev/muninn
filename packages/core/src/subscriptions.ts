import { ValidationError } from './errors'
import type { FinanceContext } from './finance'
import {
  type CreateSubscriptionInput,
  type CreateTransactionInput,
  createSubscriptionInput,
  type Subscription,
  type SubscriptionFrequency,
  type Transaction,
  type UpdateSubscriptionInput,
  updateSubscriptionInput,
} from './schemas'
import { NotFoundError } from './store'

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** `anchor` desplazado `months` meses, con el día recortado al final de mes (31 → 30 de abril). */
function addMonths(anchor: string, months: number) {
  const [y, m, d] = anchor.split('-').map(Number) as [number, number, number]
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const day = Math.min(d, daysIn(ny, nm))
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Días de `from` a `to` (negativo si `to` es anterior). */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * El cobro siguiente a `current`, contado desde `anchor` para no perder el día del ciclo: una suscripción del 31
 * cobra el 30 de abril y vuelve al 31 en mayo (ADR-0038).
 */
export function nextChargeDate(anchor: string, current: string, frequency: SubscriptionFrequency) {
  if (frequency === 'weekly') return addDays(current, 7)
  const step = frequency === 'yearly' ? 12 : 1
  const [ay, am] = anchor.split('-').map(Number) as [number, number]
  const [cy, cm] = current.split('-').map(Number) as [number, number]
  const elapsed = (cy - ay) * 12 + (cm - am)
  const n = Math.floor(elapsed / step) * step + step
  return addMonths(anchor, n)
}

/** Lo que cuesta al mes, redondeado al céntimo: anual / 12, semanal × 52 / 12. */
export function monthlyCost(s: Pick<Subscription, 'amount' | 'frequency'>) {
  if (s.frequency === 'monthly') return s.amount
  if (s.frequency === 'yearly') return Math.round(s.amount / 12)
  return Math.round((s.amount * 52) / 12)
}

export type UpcomingCharge = Subscription & {
  /** Días hasta el cobro: 0 hoy, negativo si ya pasó. */
  daysUntil: number
  overdue: boolean
}

interface TransactionsApi {
  create(input: CreateTransactionInput): Promise<Transaction>
  archive(id: string): Promise<Transaction>
}

/**
 * Suscripciones (ADR-0038). Al llegar la fecha solo avisan: `charge` apunta el gasto y adelanta la fecha,
 * `skip` solo la adelanta, y `revert` deshace cualquiera de los dos.
 */
export function createSubscriptions(
  { store, today, parse, log, nowIso }: FinanceContext,
  transactions: TransactionsApi,
) {
  const get = async (id: string) => {
    const s = await store.financeSubscriptions.get(id)
    if (!s) throw new NotFoundError('Suscripción', id)
    return s
  }

  /** Cuenta sin archivar y categoría de gastos sin archivar, si se eligen ahora. */
  async function check(accountId: string | undefined, categoryId: string | null | undefined) {
    if (accountId) {
      const a = await store.financeAccounts.get(accountId)
      if (!a) throw new NotFoundError('Cuenta', accountId)
      if (a.archivedAt) throw new ValidationError(`La cuenta «${a.name}» está archivada`)
    }
    if (categoryId) {
      const c = await store.financeCategories.get(categoryId)
      if (!c) throw new NotFoundError('Categoría', categoryId)
      if (c.kind !== 'expense') {
        throw new ValidationError('Una suscripción lleva una categoría de gastos')
      }
      if (c.archivedAt) throw new ValidationError(`La categoría «${c.name}» está archivada`)
    }
  }

  const payload = (s: Subscription) => ({
    name: s.name,
    amount: s.amount,
    frequency: s.frequency,
    nextDate: s.nextDate,
  })

  async function list(opts: { includeArchived?: boolean } = {}) {
    return store.financeSubscriptions.list(opts)
  }

  async function create(input: CreateSubscriptionInput) {
    const data = parse(createSubscriptionInput, input)
    await check(data.accountId, data.categoryId)
    const s = await store.financeSubscriptions.insert({
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      accountId: data.accountId,
      categoryId: data.categoryId ?? null,
      anchorDate: data.nextDate,
      nextDate: data.nextDate,
      remindDays: data.remindDays ?? 3,
      archivedAt: null,
    })
    await log('subscription', s.id, 'created', null, payload(s))
    return s
  }

  async function update(id: string, input: UpdateSubscriptionInput) {
    const patch = parse(updateSubscriptionInput, input)
    const before = await get(id)
    await check(
      patch.accountId !== before.accountId ? patch.accountId : undefined,
      patch.categoryId !== before.categoryId ? patch.categoryId : undefined,
    )
    const changes = {
      ...patch,
      // Elegir otra fecha mueve también el día del ciclo.
      ...(patch.nextDate && patch.nextDate !== before.nextDate
        ? { anchorDate: patch.nextDate }
        : {}),
    }
    const s = await store.financeSubscriptions.update(id, changes)
    await log('subscription', id, 'updated', null, payload(s))
    return s
  }

  async function archive(id: string) {
    const s = await get(id)
    const archived = await store.financeSubscriptions.update(id, { archivedAt: nowIso() })
    await log('subscription', id, 'archived', null, payload(s))
    return archived
  }

  async function restore(id: string) {
    const s = await get(id)
    const restored = await store.financeSubscriptions.update(id, { archivedAt: null })
    await log('subscription', id, 'restored', null, payload(s))
    return restored
  }

  /** Sin archivar y que debe estar en `expected`: si no, otro dispositivo ya apuntó o saltó ese cobro. */
  async function due(id: string, expected?: string) {
    const s = await get(id)
    if (s.archivedAt) throw new ValidationError(`«${s.name}» está archivada`)
    if (expected && expected !== s.nextDate) {
      throw new ValidationError(`Ese cobro de «${s.name}» ya está apuntado o saltado`)
    }
    return s
  }

  /**
   * Apunta el cobro como gasto (con la fecha del cobro, o `date`) y adelanta la fecha un periodo. `expected` es la
   * fecha del cobro que se ve en pantalla: si ya no es la próxima, no se apunta dos veces.
   */
  async function charge(
    id: string,
    opts: { expected?: string; amount?: number; date?: string } = {},
  ) {
    const s = await due(id, opts.expected)
    const transaction = await transactions.create({
      kind: 'expense',
      amount: opts.amount ?? s.amount,
      date: opts.date ?? s.nextDate,
      accountId: s.accountId,
      categoryId: s.categoryId,
      concept: s.name,
      subscriptionId: s.id,
    })
    const subscription = await store.financeSubscriptions.update(id, {
      nextDate: nextChargeDate(s.anchorDate, s.nextDate, s.frequency),
    })
    await log('subscription', id, 'charged', null, {
      ...payload(s),
      transactionId: transaction.id,
    })
    return { transaction, subscription, previousDate: s.nextDate }
  }

  /** Ese periodo no se cobró: solo adelanta la fecha. */
  async function skip(id: string, opts: { expected?: string } = {}) {
    const s = await due(id, opts.expected)
    const subscription = await store.financeSubscriptions.update(id, {
      nextDate: nextChargeDate(s.anchorDate, s.nextDate, s.frequency),
    })
    await log('subscription', id, 'skipped', null, payload(s))
    return { subscription, previousDate: s.nextDate }
  }

  /** Deshace `charge` o `skip`: vuelve a la fecha anterior (el ciclo no cambia) y archiva el gasto, si lo hubo. */
  async function revert(id: string, opts: { previousDate: string; transactionId?: string }) {
    await get(id)
    if (opts.transactionId) await transactions.archive(opts.transactionId)
    const s = await store.financeSubscriptions.update(id, { nextDate: opts.previousDate })
    await log('subscription', id, 'reverted', null, payload(s))
    return s
  }

  /**
   * Las que hay que avisar: sin archivar y con el cobro dentro de sus días de aviso (o de `days`, si se da), y
   * las ya vencidas. De la más próxima a la más lejana.
   */
  async function upcoming(opts: { days?: number } = {}): Promise<UpcomingCharge[]> {
    const t0 = today()
    return (await list())
      .map((s) => {
        const daysUntil = daysBetween(t0, s.nextDate)
        return { ...s, daysUntil, overdue: daysUntil < 0 }
      })
      .filter((s) => s.daysUntil <= (opts.days ?? s.remindDays))
  }

  return { list, get, create, update, archive, restore, charge, skip, revert, upcoming }
}
