import type {
  AccountKind,
  AccountWithBalance,
  FinanceCategory,
  Transaction,
  TransactionKind,
} from '@muninn/core'
import { currentLocale, t as tr } from '../i18n'
import { addDays, asDate, capitalize, dueLabel } from './dates'
import { matchesAll, words } from './text'

/**
 * Lógica pura de la pantalla Finanzas (ADR-0037): etiquetas, agrupar por día, filtrar y los cambios
 * optimistas sobre la caché. Sin React ni core de valor (solo tipos), para probarla sin red.
 */

/**
 * Lo que elige el alta. «Ahorro» e «Inversión» no son tipos de movimiento: son traspasos a una cuenta de
 * ese tipo. «Traspaso» es entre cualquier par de cuentas.
 */
export type EntryKind = 'expense' | 'income' | 'saving' | 'investment' | 'transfer'

/** Etiquetas en el idioma activo (ADR-0077): se leen al pintar, nunca en una constante de módulo. */
export const entryLabel = (k: EntryKind) => tr(`entry.${k}`, { ns: 'finance' })

export const ACCOUNT_KINDS: AccountKind[] = ['checking', 'savings', 'investment', 'cash', 'other']

export const accountKindLabel = (k: AccountKind) => tr(`accountKind.${k}`, { ns: 'finance' })

export const txKindOf = (entry: EntryKind): TransactionKind =>
  entry === 'expense' || entry === 'income' ? entry : 'transfer'

/** Tipos de cuenta a los que puede ir cada atajo; `null` = cualquiera. */
export const destinationKinds = (entry: EntryKind): AccountKind[] | null =>
  entry === 'saving' ? ['savings'] : entry === 'investment' ? ['investment'] : null

/** Cómo se presenta un movimiento: un traspaso a una hucha es «Ahorro». */
export function entryKindOf(
  t: Pick<Transaction, 'kind' | 'toAccountId'>,
  accounts: Map<string, Pick<AccountWithBalance, 'kind'>>,
): EntryKind {
  if (t.kind !== 'transfer') return t.kind
  const to = t.toAccountId ? accounts.get(t.toAccountId)?.kind : undefined
  return to === 'savings' ? 'saving' : to === 'investment' ? 'investment' : 'transfer'
}

/**
 * Céntimos con signo tal como se ven en la lista: los gastos restan y los ingresos suman. Un traspaso no
 * cambia lo que tienes (0), salvo mirando una cuenta: sale (−) o entra (+).
 */
export function signedAmount(t: Transaction, accountId?: string | null) {
  if (t.kind === 'income') return t.amount
  if (t.kind === 'expense') return -t.amount
  if (!accountId) return 0
  return t.toAccountId === accountId ? t.amount : t.accountId === accountId ? -t.amount : 0
}

/** Etiqueta de Intl del idioma activo: `es-ES` en español y `en` en inglés (como `lib/dates.ts`). */
const tag = () => (currentLocale() === 'es' ? 'es-ES' : 'en')

/** Formateadores por idioma, creados una vez: `Intl` es caro de construir. */
const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>()
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(
  key: string,
  make: (locale: string) => T,
): T {
  const id = `${tag()}|${key}`
  if (!formatters.has(id)) formatters.set(id, make(tag()))
  return formatters.get(id) as T
}

// Euros (ADR-0018: la moneda es EUR) con dos decimales; agrupa siempre los miles (en es-ES Intl no agrupa 4 cifras).
const MONEY = () =>
  cached(
    'money',
    (l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'EUR', useGrouping: 'always' }),
  )
const PERCENT = () =>
  cached('pct', (l) => new Intl.NumberFormat(l, { style: 'percent', maximumFractionDigits: 0 }))

/** Intl separa con un espacio duro (`es-ES`: «18,45 €», «20 %»); la app siempre ha usado uno normal. */
const plainSpaces = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

/** Un porcentaje (0–1) en el idioma activo: «20 %» en español, «20%» en inglés. */
export const percentText = (ratio: number) => plainSpaces(PERCENT().format(ratio))

/** «−18,45 €», «+850,00 €» o, sin signo, «600,00 €» (en inglés, «−€18.45»). */
export function amountText(cents: number, sign: 'auto' | 'none' = 'auto') {
  const abs = plainSpaces(MONEY().format(Math.abs(cents) / 100))
  if (sign === 'none' || cents === 0) return abs
  return cents < 0 ? `−${abs}` : `+${abs}`
}

export interface TxFilter {
  query: string
  kind: EntryKind | null
  categoryId: string | null
  accountId: string | null
}

export const NO_TX_FILTER: TxFilter = { query: '', kind: null, categoryId: null, accountId: null }

export const isFilteringTx = (f: TxFilter) =>
  f.query.trim() !== '' || f.kind !== null || f.categoryId !== null || f.accountId !== null

/** Filtra en el navegador los movimientos de un mes (son pocos; así los filtros van al instante). */
export function filterTransactions(
  list: Transaction[],
  f: TxFilter,
  accounts: Map<string, Pick<AccountWithBalance, 'kind'>>,
) {
  const terms = words(f.query)
  return list.filter(
    (t) =>
      matchesAll(`${t.concept}\n${t.note}`, terms) &&
      (!f.kind || entryKindOf(t, accounts) === f.kind) &&
      (!f.categoryId || t.categoryId === f.categoryId) &&
      (!f.accountId || t.accountId === f.accountId || t.toAccountId === f.accountId),
  )
}

export interface DayGroup {
  date: string
  items: Transaction[]
  /** Ingresos − gastos del día (los traspasos no cuentan), o lo de la cuenta filtrada. */
  total: number
  /** Lo apartado ese día (traspasos), si no hubo ingresos ni gastos. */
  moved: number
}

/** Agrupa por día, del más reciente al más antiguo (la lista ya llega ordenada). */
export function groupByDay(list: Transaction[], accountId?: string | null): DayGroup[] {
  const groups: DayGroup[] = []
  for (const t of list) {
    let g = groups.at(-1)
    if (g?.date !== t.date) {
      g = { date: t.date, items: [], total: 0, moved: 0 }
      groups.push(g)
    }
    g.items.push(t)
    g.total += signedAmount(t, accountId)
    if (t.kind === 'transfer') g.moved += t.amount
  }
  return groups
}

const WEEKDAY = () => cached('weekday', (l) => new Intl.DateTimeFormat(l, { weekday: 'long' }))
const MONTH_YEAR = () =>
  cached('monthYear', (l) => new Intl.DateTimeFormat(l, { month: 'long', year: 'numeric' }))
const SHORT_MONTH = () =>
  cached('shortMonth', (l) => new Intl.DateTimeFormat(l, { month: 'short' }))
const MONTH_NAME = () => cached('monthName', (l) => new Intl.DateTimeFormat(l, { month: 'long' }))
const NUMERIC_DATE = () =>
  cached(
    'numericDate',
    (l) => new Intl.DateTimeFormat(l, { day: '2-digit', month: '2-digit', year: 'numeric' }),
  )

/** «Hoy · lunes 19», «Ayer · domingo 18», «Sábado 17». */
export function dayLabel(date: string, today: string) {
  // El día de la semana y el número por separado: en inglés, Intl daría «19 Monday».
  const day = `${WEEKDAY().format(asDate(date))} ${Number(date.slice(8, 10))}`
  if (date === today) return `${tr('dates.today')} · ${day}`
  if (date === addDays(today, -1)) return `${tr('dates.yesterday')} · ${day}`
  return capitalize(day)
}

/** «Octubre 2026». */
export const monthLabel = (month: string) =>
  capitalize(
    MONTH_YEAR()
      .format(asDate(`${month}-15`))
      .replace(' de ', ' '),
  )

/** «Oct». */
export const monthShort = (month: string) =>
  capitalize(
    SHORT_MONTH()
      .format(asDate(`${month}-15`))
      .replace('.', ''),
  )

/** «19/10/2026» en español, «10/19/2026» en inglés. */
export const numericDate = (iso: string) => NUMERIC_DATE().format(asDate(iso))

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

// ─── Cambios optimistas sobre la caché ──────────────────────────────────────

/** Inserta o sustituye un movimiento en la lista de un mes, en su sitio (fecha desc, recién creado arriba). */
export function putTransaction(list: Transaction[], t: Transaction): Transaction[] {
  const rest = list.filter((x) => x.id !== t.id)
  const i = rest.findIndex(
    (x) => x.date < t.date || (x.date === t.date && x.createdAt <= t.createdAt),
  )
  return i < 0 ? [...rest, t] : [...rest.slice(0, i), t, ...rest.slice(i)]
}

export const dropTransaction = (list: Transaction[], id: string) => list.filter((t) => t.id !== id)

/** Saldos tras sumar (`sign = 1`) o quitar (`-1`) un movimiento: lo que hará la vista del servidor. */
export function applyToBalances(
  accounts: AccountWithBalance[],
  t: Pick<Transaction, 'kind' | 'amount' | 'accountId' | 'toAccountId'>,
  sign: 1 | -1,
): AccountWithBalance[] {
  return accounts.map((a) => {
    let delta = 0
    if (a.id === t.accountId) delta += t.kind === 'income' ? t.amount : -t.amount
    if (t.kind === 'transfer' && a.id === t.toAccountId) delta += t.amount
    return delta ? { ...a, balance: a.balance + sign * delta } : a
  })
}

/** Categorías del tipo de un movimiento, sin archivar (las que ofrece el alta). */
export const categoriesFor = (categories: FinanceCategory[], kind: TransactionKind) =>
  kind === 'transfer' ? [] : categories.filter((c) => c.kind === kind && !c.archivedAt)

type Frequency = 'weekly' | 'monthly' | 'yearly'

export const frequencyLabel = (f: Frequency) => tr(`frequency.${f}`, { ns: 'finance' })

/**
 * Cuándo se cobra, como en el diseño: «Hoy», «Mañana», «24 oct», y «Vencida · 18 oct» si ya pasó. Las no mensuales
 * llevan delante su frecuencia («Anual · 12 mar»).
 */
export function chargeLabel(s: { nextDate: string; frequency: Frequency }, today: string) {
  const when = dueLabel(s.nextDate, today)
  if (s.nextDate < today) return tr('format.overdue', { ns: 'finance', when })
  return s.frequency === 'monthly' || s.nextDate <= addDays(today, 1)
    ? when
    : tr('format.withFrequency', { ns: 'finance', frequency: frequencyLabel(s.frequency), when })
}

/** Por encima de esto (más del triple), un porcentaje ya no dice nada: «+15559 %». */
const MAX_DELTA_PCT = 200

/**
 * Cambio respecto al mes anterior en texto: «−6 % que en septiembre». `null` si el mes anterior fue 0 (no hay base).
 * Si se multiplicó por más de tres (un mes casi vacío, p. ej. el primero que apuntas), da la cifra de ese mes:
 * «En septiembre: 9,99 €».
 */
export function deltaText(current: number, previous: number, previousMonth: string) {
  if (previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const month = MONTH_NAME().format(asDate(`${previousMonth}-15`))
  if (pct > MAX_DELTA_PCT)
    return tr('format.deltaOver', { ns: 'finance', month, amount: amountText(previous, 'none') })
  if (pct === 0) return tr('format.deltaSame', { ns: 'finance', month })
  const signed = `${pct > 0 ? '+' : '−'}${percentText(Math.abs(pct) / 100)}`
  return tr('format.delta', { ns: 'finance', pct: signed, month })
}

/** Tasa de ahorro (0–1) como «20 %»; «—» sin ingresos. */
export const rateText = (rate: number | null) =>
  rate === null ? '—' : percentText(Math.round(rate * 100) / 100)

/**
 * Reordena en la caché: `category` pasa al puesto `index` de las activas de su tipo; las demás (el otro
 * tipo y las archivadas) se quedan donde estaban.
 */
export function applyCategoryMove(
  list: FinanceCategory[],
  category: Pick<FinanceCategory, 'id' | 'kind'>,
  index: number,
): FinanceCategory[] {
  const inGroup = (c: FinanceCategory) => c.kind === category.kind && !c.archivedAt
  const moved = list.find((c) => c.id === category.id)
  if (!moved) return list
  const rest = list.filter((c) => inGroup(c) && c.id !== category.id)
  const at = Math.max(0, Math.min(index, rest.length))
  const order = [...rest.slice(0, at), moved, ...rest.slice(at)]
  let i = 0
  return list.map((c) => (inGroup(c) ? (order[i++] ?? c) : c))
}
