import type { z } from 'zod'
import { ValidationError } from './errors'
import { createFinanceReport } from './finance-report'
import { positionAt, positionsFor } from './ordering'
import {
  type AccountKind,
  type AccountWithBalance,
  type Activity,
  type CategoryKind,
  type CreateAccountInput,
  type CreateCategoryInput,
  type CreateTransactionInput,
  createAccountInput,
  createCategoryInput,
  createTransactionInput,
  type FinanceAccount,
  type FinanceColor,
  MAX_CENTS,
  type Transaction,
  type TransactionQuery,
  transactionQuery,
  type UpdateAccountInput,
  type UpdateCategoryInput,
  type UpdateTransactionInput,
  updateAccountInput,
  updateCategoryInput,
  updateTransactionInput,
} from './schemas'
import { NotFoundError, type Store } from './store'
import { createSubscriptions } from './subscriptions'

/** Categorías con las que empieza todo usuario (ADR-0037). Son filas normales: se renombran y se archivan. */
export const DEFAULT_CATEGORIES: {
  key: string
  name: string
  kind: CategoryKind
  color: FinanceColor
}[] = [
  { key: 'housing', name: 'Vivienda', kind: 'expense', color: 'blue' },
  { key: 'groceries', name: 'Supermercado', kind: 'expense', color: 'teal' },
  { key: 'subscriptions', name: 'Suscripciones', kind: 'expense', color: 'amber' },
  { key: 'transport', name: 'Transporte', kind: 'expense', color: 'violet' },
  { key: 'restaurants', name: 'Restaurantes', kind: 'expense', color: 'green' },
  { key: 'leisure', name: 'Ocio', kind: 'expense', color: 'pink' },
  { key: 'health', name: 'Salud', kind: 'expense', color: 'teal' },
  { key: 'other_expense', name: 'Otros', kind: 'expense', color: 'gray' },
  { key: 'salary', name: 'Nómina', kind: 'income', color: 'green' },
  { key: 'invoices', name: 'Facturas', kind: 'income', color: 'blue' },
  { key: 'other_income', name: 'Otros ingresos', kind: 'income', color: 'gray' },
]

/** Grupo de una cuenta para los informes: dinero disponible, ahorro o inversión. */
export const accountGroup = (kind: AccountKind): 'liquid' | 'savings' | 'investment' =>
  kind === 'savings' ? 'savings' : kind === 'investment' ? 'investment' : 'liquid'

/** Primer y último día (`AAAA-MM-DD`) de un mes `AAAA-MM`. */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

/** El mes `AAAA-MM` desplazado `delta` meses. */
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

/**
 * Euros escritos por una persona o un modelo → céntimos enteros. Acepta `24.9`, `'24,90'`, `'1.284,30'`, `'1284.30'` y
 * `'24,90 €'`. Para el MCP: los modelos se equivocan al multiplicar por cien (ADR-0037).
 */
export function centsFromEuros(input: string | number): number {
  let cents: number
  if (typeof input === 'number') {
    cents = Math.round(input * 100)
  } else {
    let t = input.replace(/[\s€]/g, '').replace(/^\+/, '')
    const lastComma = t.lastIndexOf(',')
    const lastDot = t.lastIndexOf('.')
    if (lastComma >= 0 && lastDot >= 0) {
      // Los dos: el último es el decimal y el otro, miles.
      const dec = lastComma > lastDot ? ',' : '.'
      t = t.replaceAll(dec === ',' ? '.' : ',', '').replace(dec, '.')
    } else if (lastComma >= 0) {
      t = t.replace(',', '.')
    } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
      // «1.284» es mil doscientos: no hay céntimos de tres cifras.
      t = t.replaceAll('.', '')
    }
    if (!/^\d+(\.\d{1,2})?$/.test(t)) throw new ValidationError(`Importe no válido: «${input}»`)
    const [int = '0', dec = ''] = t.split('.')
    cents = Number(int) * 100 + Number(`${dec}00`.slice(0, 2))
  }
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new ValidationError('El importe tiene que ser mayor que cero')
  }
  if (cents > MAX_CENTS) throw new ValidationError('El importe es demasiado grande')
  return cents
}

const euroFormat = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
})

/** Céntimos → «1.284,30 €» (para respuestas del MCP; la UI usa `formatAmount` de `@muninn/ui`). */
export const formatEuros = (cents: number) => euroFormat.format(cents / 100)

export interface FinanceContext {
  store: Store
  nowIso: () => string
  today: () => string
  parse: <S extends z.ZodType>(schema: S, value: unknown) => z.output<S>
  log: (
    entityType: Activity['entityType'],
    entityId: string,
    action: string,
    projectId: string | null,
    payload?: Record<string, unknown>,
  ) => Promise<Activity>
}

/** Finanzas (ADR-0037): cuentas con su saldo derivado, categorías y movimientos. Lo monta `createMuninn`. */
export function createFinance({ store, nowIso, today, parse, log }: FinanceContext) {
  const getAccountRow = async (id: string) => {
    const a = await store.financeAccounts.get(id)
    if (!a) throw new NotFoundError('Cuenta', id)
    return a
  }
  const getCategoryRow = async (id: string) => {
    const c = await store.financeCategories.get(id)
    if (!c) throw new NotFoundError('Categoría', id)
    return c
  }
  const getTransaction = async (id: string) => {
    const t = await store.transactions.get(id)
    if (!t) throw new NotFoundError('Movimiento', id)
    return t
  }

  /** Persiste el rebalanceo si dos dispositivos generaron la misma clave (como `place` en el servicio). */
  async function place(
    collection: 'financeAccounts' | 'financeCategories',
    siblings: { id: string; position: string }[],
    index?: number,
  ) {
    const { position, rebalance } = positionAt(siblings, index)
    if (rebalance) {
      for (const r of rebalance) await store[collection].update(r.id, { position: r.position })
    }
    return position
  }

  // ─── Cuentas ───────────────────────────────────────────────────────────────

  async function balances() {
    return new Map((await store.accountTotals()).map((t) => [t.accountId, t.net]))
  }

  const withBalance = (a: FinanceAccount, nets: Map<string, number>): AccountWithBalance => ({
    ...a,
    balance: a.initialBalance + (nets.get(a.id) ?? 0),
  })

  async function listAccounts(opts: { includeArchived?: boolean; kinds?: AccountKind[] } = {}) {
    const [rows, nets] = await Promise.all([store.financeAccounts.list(opts), balances()])
    return rows.map((a) => withBalance(a, nets))
  }

  async function getAccount(id: string) {
    const [row, nets] = await Promise.all([getAccountRow(id), balances()])
    return withBalance(row, nets)
  }

  async function createAccount(input: CreateAccountInput) {
    const data = parse(createAccountInput, input)
    const siblings = await store.financeAccounts.list({ includeArchived: true })
    const account = await store.financeAccounts.insert({
      name: data.name,
      kind: data.kind,
      color: data.color ?? 'blue',
      initialBalance: data.initialBalance ?? 0,
      goal: data.goal ?? null,
      currency: 'EUR',
      position: await place('financeAccounts', siblings),
      archivedAt: null,
    })
    await log('account', account.id, 'created', null, { name: account.name, kind: account.kind })
    return withBalance(account, new Map())
  }

  async function updateAccount(id: string, input: UpdateAccountInput) {
    const patch = parse(updateAccountInput, input)
    await getAccountRow(id)
    await store.financeAccounts.update(id, patch)
    await log('account', id, 'updated', null, patch)
    return getAccount(id)
  }

  async function moveAccount(id: string, index: number) {
    await getAccountRow(id)
    const siblings = (await store.financeAccounts.list({})).filter((a) => a.id !== id)
    await store.financeAccounts.update(id, {
      position: await place('financeAccounts', siblings, index),
    })
    return getAccount(id)
  }

  /** Deja de verse; sus movimientos siguen ahí (y cuentan para la otra cuenta de un traspaso). */
  async function archiveAccount(id: string) {
    const a = await getAccountRow(id)
    await store.financeAccounts.update(id, { archivedAt: nowIso() })
    await log('account', id, 'archived', null, { name: a.name })
    return getAccount(id)
  }

  async function restoreAccount(id: string) {
    const a = await getAccountRow(id)
    await store.financeAccounts.update(id, { archivedAt: null })
    await log('account', id, 'restored', null, { name: a.name })
    return getAccount(id)
  }

  // ─── Categorías ────────────────────────────────────────────────────────────

  let seeding: Promise<void> | null = null

  /**
   * Siembra las de serie si el usuario no tiene ninguna (ni archivada). Si otro dispositivo las sembró a la vez,
   * el índice único `(owner_id, key)` rechaza las repetidas y se ignora (ADR-0037).
   */
  function ensureDefaults() {
    seeding ??= (async () => {
      if ((await store.financeCategories.list({ includeArchived: true })).length > 0) return
      const positions = positionsFor(DEFAULT_CATEGORIES.length)
      for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
        try {
          await store.financeCategories.insert({
            name: c.name,
            kind: c.kind,
            color: c.color,
            key: c.key,
            position: positions[i] as string,
            archivedAt: null,
          })
        } catch {
          // Ya estaba (otro dispositivo): la lista que sigue la trae.
        }
      }
    })().finally(() => {
      seeding = null
    })
    return seeding
  }

  async function listCategories(opts: { kind?: CategoryKind; includeArchived?: boolean } = {}) {
    await ensureDefaults()
    return store.financeCategories.list(opts)
  }

  async function createCategory(input: CreateCategoryInput) {
    const data = parse(createCategoryInput, input)
    await ensureDefaults()
    const siblings = await store.financeCategories.list({ includeArchived: true })
    const category = await store.financeCategories.insert({
      name: data.name,
      kind: data.kind,
      color: data.color ?? 'gray',
      key: null,
      position: await place('financeCategories', siblings),
      archivedAt: null,
    })
    await log('category', category.id, 'created', null, {
      name: category.name,
      kind: category.kind,
    })
    return category
  }

  async function updateCategory(id: string, input: UpdateCategoryInput) {
    const patch = parse(updateCategoryInput, input)
    await getCategoryRow(id)
    const category = await store.financeCategories.update(id, patch)
    await log('category', id, 'updated', null, patch)
    return category
  }

  async function moveCategory(id: string, index: number) {
    await getCategoryRow(id)
    const siblings = (await store.financeCategories.list({})).filter((c) => c.id !== id)
    return store.financeCategories.update(id, {
      position: await place('financeCategories', siblings, index),
    })
  }

  /** Deja de ofrecerse en el alta; sus movimientos la siguen nombrando. */
  async function archiveCategory(id: string) {
    const c = await getCategoryRow(id)
    const archived = await store.financeCategories.update(id, { archivedAt: nowIso() })
    await log('category', id, 'archived', null, { name: c.name })
    return archived
  }

  async function restoreCategory(id: string) {
    const c = await getCategoryRow(id)
    const restored = await store.financeCategories.update(id, { archivedAt: null })
    await log('category', id, 'restored', null, { name: c.name })
    return restored
  }

  // ─── Movimientos ───────────────────────────────────────────────────────────

  async function listTransactions(query: TransactionQuery = {}) {
    const { month, ...q } = parse(transactionQuery, query)
    const range = month ? monthRange(month) : null
    // `month` y `from`/`to` juntos: la intersección.
    const from = [range?.from, q.from].filter(Boolean).sort().at(-1)
    const to = [range?.to, q.to].filter(Boolean).sort().at(0)
    return store.transactions.list({ ...q, from, to })
  }

  /**
   * Comprueba un movimiento entero (el nuevo o el resultado de aplicar un cambio). Solo exige que cuentas y
   * categoría no estén archivadas si se eligen ahora (`fresh`): editar un movimiento antiguo no obliga a cambiarlas.
   */
  async function checkTransaction(
    t: Pick<Transaction, 'kind' | 'accountId' | 'toAccountId' | 'categoryId'>,
    fresh: { account: boolean; toAccount: boolean; category: boolean },
  ) {
    const account = await getAccountRow(t.accountId)
    if (fresh.account && account.archivedAt) {
      throw new ValidationError(`La cuenta «${account.name}» está archivada`)
    }
    if (t.kind === 'transfer') {
      if (!t.toAccountId) throw new ValidationError('Un traspaso necesita la cuenta de destino')
      if (t.toAccountId === t.accountId) {
        throw new ValidationError('El traspaso tiene que ir a otra cuenta')
      }
      const to = await getAccountRow(t.toAccountId)
      if (fresh.toAccount && to.archivedAt) {
        throw new ValidationError(`La cuenta «${to.name}» está archivada`)
      }
      if (t.categoryId) throw new ValidationError('Un traspaso no lleva categoría')
    } else if (t.toAccountId) {
      throw new ValidationError('Solo los traspasos tienen cuenta de destino')
    }
    if (t.categoryId) {
      const category = await getCategoryRow(t.categoryId)
      if (category.kind !== t.kind) {
        throw new ValidationError(
          `«${category.name}» es una categoría de ${category.kind === 'expense' ? 'gastos' : 'ingresos'}`,
        )
      }
      if (fresh.category && category.archivedAt) {
        throw new ValidationError(`La categoría «${category.name}» está archivada`)
      }
    }
  }

  const txPayload = (t: Transaction) => ({
    kind: t.kind,
    amount: t.amount,
    concept: t.concept,
    date: t.date,
  })

  async function createTransaction(input: CreateTransactionInput) {
    const data = parse(createTransactionInput, input)
    const row = {
      kind: data.kind,
      amount: data.amount,
      date: data.date ?? today(),
      accountId: data.accountId,
      toAccountId: data.kind === 'transfer' ? (data.toAccountId ?? null) : null,
      categoryId: data.categoryId ?? null,
      concept: data.concept ?? '',
      note: data.note ?? '',
      subscriptionId: data.subscriptionId ?? null,
      archivedAt: null,
    }
    if (data.kind !== 'transfer' && data.toAccountId) {
      throw new ValidationError('Solo los traspasos tienen cuenta de destino')
    }
    await checkTransaction(row, { account: true, toAccount: true, category: true })
    if (row.subscriptionId && !(await store.financeSubscriptions.get(row.subscriptionId))) {
      throw new NotFoundError('Suscripción', row.subscriptionId)
    }
    const tx = await store.transactions.insert(row)
    await log('transaction', tx.id, 'created', null, txPayload(tx))
    return tx
  }

  /**
   * Cambiar el tipo arrastra lo que deja de encajar: a traspaso, se quita la categoría; desde traspaso, el destino; y
   * una categoría del otro tipo se quita si no se elige otra en el mismo cambio.
   */
  async function updateTransaction(id: string, input: UpdateTransactionInput) {
    const patch = parse(updateTransactionInput, input)
    const before = await getTransaction(id)
    const next = {
      ...before,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    }
    if (patch.kind && patch.kind !== before.kind) {
      if (next.kind === 'transfer' && patch.categoryId === undefined) next.categoryId = null
      if (next.kind !== 'transfer' && patch.toAccountId === undefined) next.toAccountId = null
      if (next.kind !== 'transfer' && patch.categoryId === undefined && next.categoryId) {
        const category = await store.financeCategories.get(next.categoryId)
        if (category?.kind !== next.kind) next.categoryId = null
      }
    }
    await checkTransaction(next, {
      account: next.accountId !== before.accountId,
      toAccount: next.toAccountId !== before.toAccountId,
      category: next.categoryId !== before.categoryId,
    })
    const fields = (
      [
        'kind',
        'amount',
        'date',
        'accountId',
        'toAccountId',
        'categoryId',
        'concept',
        'note',
      ] as const
    ).filter((k) => next[k] !== before[k])
    if (fields.length === 0) return before
    const tx = await store.transactions.update(
      id,
      Object.fromEntries(fields.map((k) => [k, next[k]])),
    )
    await log('transaction', id, 'updated', null, { ...txPayload(tx), fields })
    return tx
  }

  /** Deja de contar para el saldo y los informes. «Deshacer» es `restore`. */
  async function archiveTransaction(id: string) {
    const t = await getTransaction(id)
    const archived = await store.transactions.update(id, { archivedAt: nowIso() })
    await log('transaction', id, 'archived', null, txPayload(t))
    return archived
  }

  async function restoreTransaction(id: string) {
    const t = await getTransaction(id)
    const restored = await store.transactions.update(id, { archivedAt: null })
    await log('transaction', id, 'restored', null, txPayload(t))
    return restored
  }

  const transactions = {
    list: listTransactions,
    get: getTransaction,
    create: createTransaction,
    update: updateTransaction,
    archive: archiveTransaction,
    restore: restoreTransaction,
  }

  return {
    report: createFinanceReport({ store, parse }),
    subscriptions: createSubscriptions({ store, nowIso, today, parse, log }, transactions),
    accounts: {
      list: listAccounts,
      get: getAccount,
      create: createAccount,
      update: updateAccount,
      move: moveAccount,
      archive: archiveAccount,
      restore: restoreAccount,
    },
    categories: {
      list: listCategories,
      create: createCategory,
      update: updateCategory,
      move: moveCategory,
      archive: archiveCategory,
      restore: restoreCategory,
    },
    transactions,
  }
}

export type Finance = ReturnType<typeof createFinance>
