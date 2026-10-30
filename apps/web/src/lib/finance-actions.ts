import type {
  AccountWithBalance,
  CreateAccountInput,
  CreateCategoryInput,
  CreateTransactionInput,
  FinanceAccount,
  FinanceCategory,
  Muninn,
  Transaction,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateTransactionInput,
} from '@muninn/core'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { notifyUndo } from './feedback'
import {
  amountText,
  applyCategoryMove,
  applyToBalances,
  dropTransaction,
  putTransaction,
} from './finance'
import { financeKeys } from './finance-queries'
import { fail, isBusy, serial } from './mutations'

/**
 * Acciones de Finanzas con feedback y «Deshacer» (ADR-0019, ADR-0025). Los movimientos se reflejan al instante
 * en la caché (lista del mes, últimos movimientos y saldos) y se escriben de uno en uno (`serial('finance')`);
 * al vaciarse la cola se vuelve a pedir todo `['finance']` para recoger lo que calculó el servidor. «Deshacer»
 * archiva o restaura: nunca se borra.
 */

export const FINANCE_QUEUE = 'finance'

const run = <T>(fn: () => Promise<T>) => serial(FINANCE_QUEUE, fn)

/** Refresca Finanzas si ya no queda nada propio en cola (si no, parpadearía). */
export function settleFinance(qc: QueryClient) {
  if (isBusy(FINANCE_QUEUE)) return
  void qc.invalidateQueries({ queryKey: financeKeys.all })
}

/** Lo que había en las listas de movimientos y en los saldos, para volver atrás si falla. */
type Snapshot = [QueryKey, unknown][]

function snapshot(qc: QueryClient): Snapshot {
  return [
    ...qc.getQueriesData({ queryKey: ['finance', 'transactions'] }),
    [financeKeys.accounts, qc.getQueryData(financeKeys.accounts)],
  ]
}

function restoreSnapshot(qc: QueryClient, snap: Snapshot) {
  for (const [key, data] of snap) if (data !== undefined) qc.setQueryData(key, data)
}

/**
 * Aplica un cambio a todas las listas de movimientos en caché: la de cada mes (si el movimiento es de ese
 * mes) y «últimos movimientos». `next` = `null` lo quita.
 */
function cacheTransaction(qc: QueryClient, id: string, next: Transaction | null) {
  for (const [key, list] of qc.getQueriesData<Transaction[]>({
    queryKey: ['finance', 'transactions'],
  })) {
    if (!list) continue
    const scope = key[2]
    const fits = next && (scope === 'recent' || scope === next.date.slice(0, 7))
    let out = dropTransaction(list, id)
    if (fits) out = putTransaction(out, next)
    if (scope === 'recent') out = out.slice(0, 6)
    qc.setQueryData(key, out)
  }
}

function cacheBalances(
  qc: QueryClient,
  tx: Pick<Transaction, 'kind' | 'amount' | 'accountId' | 'toAccountId'>,
  sign: 1 | -1,
) {
  qc.setQueryData<AccountWithBalance[]>(financeKeys.accounts, (list) =>
    list ? applyToBalances(list, tx, sign) : list,
  )
}

const describe = (t: Pick<Transaction, 'concept' | 'amount'>) =>
  [amountText(t.amount, 'none'), t.concept.trim()].filter(Boolean).join(' · ')

// ─── Movimientos ────────────────────────────────────────────────────────────

/** Apunta un movimiento. Devuelve el guardado o `null`. «Deshacer» lo archiva. */
export async function createTransaction(
  m: Muninn,
  qc: QueryClient,
  input: CreateTransactionInput & { date: string },
  toast: { title: string },
): Promise<Transaction | null> {
  const snap = snapshot(qc)
  const now = new Date().toISOString()
  const temp: Transaction = {
    id: `tmp-${crypto.randomUUID()}`,
    kind: input.kind,
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    toAccountId: input.toAccountId ?? null,
    categoryId: input.categoryId ?? null,
    concept: input.concept?.trim() ?? '',
    note: input.note ?? '',
    subscriptionId: input.subscriptionId ?? null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  cacheTransaction(qc, temp.id, temp)
  cacheBalances(qc, temp, 1)
  let saved: Transaction
  try {
    saved = await run(() => m.finance.transactions.create(input))
  } catch (err) {
    restoreSnapshot(qc, snap)
    fail('No se pudo guardar el movimiento', err)
    settleFinance(qc)
    return null
  }
  cacheTransaction(qc, temp.id, null)
  cacheTransaction(qc, saved.id, saved)
  settleFinance(qc)
  notifyUndo(toast.title, {
    icon: input.kind === 'income' ? 'income' : input.kind === 'expense' ? 'expense' : 'move',
    description: describe(saved),
    undo: () => archiveTransaction(m, qc, saved, { undoing: true }),
    undone: ['Movimiento deshecho', { icon: 'archive' }],
  })
  return saved
}

/** Edita un movimiento. «Deshacer» devuelve los valores que tenía. */
export async function updateTransaction(
  m: Muninn,
  qc: QueryClient,
  before: Transaction,
  patch: UpdateTransactionInput,
  opts: { undoing?: boolean } = {},
): Promise<Transaction | null> {
  const snap = snapshot(qc)
  const guess = {
    ...before,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
  } as Transaction
  if (guess.kind !== 'transfer') guess.toAccountId = null
  if (guess.kind === 'transfer') guess.categoryId = null
  cacheTransaction(qc, before.id, guess)
  cacheBalances(qc, before, -1)
  cacheBalances(qc, guess, 1)
  let saved: Transaction
  try {
    saved = await run(() => m.finance.transactions.update(before.id, patch))
  } catch (err) {
    restoreSnapshot(qc, snap)
    fail('No se pudo guardar el cambio', err)
    settleFinance(qc)
    return null
  }
  cacheTransaction(qc, saved.id, saved)
  settleFinance(qc)
  if (opts.undoing) return saved
  const back: UpdateTransactionInput = {
    kind: before.kind,
    amount: before.amount,
    date: before.date,
    accountId: before.accountId,
    toAccountId: before.toAccountId,
    categoryId: before.categoryId,
    concept: before.concept,
    note: before.note,
  }
  notifyUndo('Movimiento guardado', {
    icon: 'check',
    description: describe(saved),
    id: `tx-${before.id}`,
    undo: async () => (await updateTransaction(m, qc, saved, back, { undoing: true })) !== null,
  })
  return saved
}

/** Archiva: deja de contar en saldos e informes. «Deshacer» lo restaura. */
export async function archiveTransaction(
  m: Muninn,
  qc: QueryClient,
  tx: Transaction,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const snap = snapshot(qc)
  cacheTransaction(qc, tx.id, null)
  cacheBalances(qc, tx, -1)
  try {
    await run(() => m.finance.transactions.archive(tx.id))
  } catch (err) {
    restoreSnapshot(qc, snap)
    fail('No se pudo archivar el movimiento', err)
    settleFinance(qc)
    return false
  }
  settleFinance(qc)
  if (opts.undoing) return true
  notifyUndo('Movimiento archivado', {
    icon: 'archive',
    description: describe(tx),
    undo: async () => {
      const snap2 = snapshot(qc)
      cacheTransaction(qc, tx.id, tx)
      cacheBalances(qc, tx, 1)
      try {
        await run(() => m.finance.transactions.restore(tx.id))
      } catch (err) {
        restoreSnapshot(qc, snap2)
        throw err
      } finally {
        settleFinance(qc)
      }
    },
    undone: 'Movimiento recuperado',
    failTitle: 'No se pudo recuperar el movimiento',
  })
  return true
}

// ─── Cuentas y categorías ──────────────────────────────────────────────────

/** Cambia una lista en caché (cuentas o categorías) y devuelve cómo estaba. */
function patchList<T extends { id: string }>(
  qc: QueryClient,
  key: QueryKey,
  fn: (list: T[]) => T[],
): T[] | undefined {
  const prev = qc.getQueryData<T[]>(key)
  if (prev) qc.setQueryData(key, fn(prev))
  return prev
}

export async function createAccount(m: Muninn, qc: QueryClient, input: CreateAccountInput) {
  try {
    const account = await run(() => m.finance.accounts.create(input))
    patchList<AccountWithBalance>(qc, financeKeys.accounts, (l) => [...l, account])
    settleFinance(qc)
    notifyUndo(`Cuenta «${account.name}» creada`, {
      icon: 'plus',
      undo: () => archiveAccount(m, qc, account, { undoing: true }),
      undone: [`Cuenta «${account.name}» deshecha`, { icon: 'archive' }],
    })
    return account
  } catch (err) {
    fail('No se pudo crear la cuenta', err)
    return null
  }
}

export async function updateAccount(
  m: Muninn,
  qc: QueryClient,
  before: AccountWithBalance,
  patch: UpdateAccountInput,
  opts: { undoing?: boolean } = {},
) {
  const prev = patchList<AccountWithBalance>(qc, financeKeys.accounts, (l) =>
    l.map((a) =>
      a.id === before.id
        ? {
            ...a,
            ...patch,
            balance: a.balance + (patch.initialBalance ?? a.initialBalance) - a.initialBalance,
          }
        : a,
    ),
  )
  try {
    const saved = await run(() => m.finance.accounts.update(before.id, patch))
    settleFinance(qc)
    if (!opts.undoing) {
      const back: UpdateAccountInput = {
        name: before.name,
        kind: before.kind,
        color: before.color as UpdateAccountInput['color'],
        initialBalance: before.initialBalance,
        goal: before.goal,
      }
      notifyUndo('Cuenta guardada', {
        icon: 'check',
        id: `account-${before.id}`,
        undo: async () => (await updateAccount(m, qc, saved, back, { undoing: true })) !== null,
      })
    }
    return saved
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.accounts, prev)
    fail('No se pudo guardar la cuenta', err)
    return null
  }
}

export async function archiveAccount(
  m: Muninn,
  qc: QueryClient,
  account: Pick<FinanceAccount, 'id' | 'name'>,
  opts: { undoing?: boolean } = {},
) {
  const stamp = new Date().toISOString()
  const prev = patchList<AccountWithBalance>(qc, financeKeys.accounts, (l) =>
    l.map((a) => (a.id === account.id ? { ...a, archivedAt: stamp } : a)),
  )
  try {
    await run(() => m.finance.accounts.archive(account.id))
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.accounts, prev)
    fail('No se pudo archivar la cuenta', err)
    return false
  }
  settleFinance(qc)
  if (opts.undoing) return true
  notifyUndo(`«${account.name}» archivada`, {
    icon: 'archive',
    description: 'sus movimientos se conservan',
    undo: () => run(() => m.finance.accounts.restore(account.id)).finally(() => settleFinance(qc)),
    undone: `«${account.name}» recuperada`,
    failTitle: 'No se pudo recuperar la cuenta',
  })
  return true
}

export async function createCategory(m: Muninn, qc: QueryClient, input: CreateCategoryInput) {
  try {
    const category = await run(() => m.finance.categories.create(input))
    patchList<FinanceCategory>(qc, financeKeys.categories, (l) => [...l, category])
    settleFinance(qc)
    notifyUndo(`Categoría «${category.name}» creada`, {
      icon: 'plus',
      undo: () => archiveCategory(m, qc, category, { undoing: true }),
      undone: [`Categoría «${category.name}» deshecha`, { icon: 'archive' }],
    })
    return category
  } catch (err) {
    fail('No se pudo crear la categoría', err)
    return null
  }
}

export async function updateCategory(
  m: Muninn,
  qc: QueryClient,
  before: FinanceCategory,
  patch: UpdateCategoryInput,
  opts: { undoing?: boolean } = {},
) {
  const prev = patchList<FinanceCategory>(qc, financeKeys.categories, (l) =>
    l.map((c) => (c.id === before.id ? { ...c, ...patch } : c)),
  )
  try {
    const saved = await run(() => m.finance.categories.update(before.id, patch))
    settleFinance(qc)
    if (!opts.undoing) {
      const back = { name: before.name, color: before.color as UpdateCategoryInput['color'] }
      notifyUndo('Categoría guardada', {
        icon: 'check',
        id: `category-${before.id}`,
        undo: async () => (await updateCategory(m, qc, saved, back, { undoing: true })) !== null,
      })
    }
    return saved
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.categories, prev)
    fail('No se pudo guardar la categoría', err)
    return null
  }
}

export async function archiveCategory(
  m: Muninn,
  qc: QueryClient,
  category: Pick<FinanceCategory, 'id' | 'name'>,
  opts: { undoing?: boolean } = {},
) {
  const stamp = new Date().toISOString()
  const prev = patchList<FinanceCategory>(qc, financeKeys.categories, (l) =>
    l.map((c) => (c.id === category.id ? { ...c, archivedAt: stamp } : c)),
  )
  try {
    await run(() => m.finance.categories.archive(category.id))
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.categories, prev)
    fail('No se pudo archivar la categoría', err)
    return false
  }
  settleFinance(qc)
  if (opts.undoing) return true
  notifyUndo(`«${category.name}» archivada`, {
    icon: 'archive',
    description: 'sus movimientos la conservan',
    undo: () =>
      run(() => m.finance.categories.restore(category.id)).finally(() => settleFinance(qc)),
    undone: `«${category.name}» recuperada`,
    failTitle: 'No se pudo recuperar la categoría',
  })
  return true
}

/** Mueve una categoría dentro de su lista (gastos o ingresos). `index` cuenta las demás de esa lista. */
export async function moveCategory(
  m: Muninn,
  qc: QueryClient,
  category: Pick<FinanceCategory, 'id' | 'kind' | 'name'>,
  index: number,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const prev = patchList<FinanceCategory>(qc, financeKeys.categories, (l) =>
    applyCategoryMove(l, category, index),
  )
  const fromIndex =
    prev
      ?.filter((c) => c.kind === category.kind && !c.archivedAt)
      .findIndex((c) => c.id === category.id) ?? -1
  try {
    await run(() => m.finance.categories.move(category.id, index))
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.categories, prev)
    fail('No se pudo mover la categoría', err)
    return false
  }
  settleFinance(qc)
  if (opts.undoing) return true
  notifyUndo(`«${category.name}» movida`, {
    icon: 'move',
    // Sin la lista en caché no se sabe de dónde venía.
    undo: fromIndex >= 0 ? () => moveCategory(m, qc, category, fromIndex, { undoing: true }) : null,
    undone: ['Orden deshecho', { icon: 'move' }],
  })
  return true
}
