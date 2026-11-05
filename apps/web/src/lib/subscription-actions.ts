import type {
  CreateSubscriptionInput,
  Muninn,
  Subscription,
  UpdateSubscriptionInput,
} from '@muninn/core'
import type { QueryClient } from '@tanstack/react-query'
import { t } from '../i18n'
import { notifyUndo } from './feedback'
import { amountText, numericDate } from './finance'
import { FINANCE_QUEUE, settleFinance } from './finance-actions'
import { financeKeys } from './finance-queries'
import { fail, serial } from './mutations'

/**
 * Acciones de suscripciones (ADR-0038), en la misma cola que el resto de Finanzas. Al llegar la fecha la app solo
 * avisa: «Apuntar» crea el gasto y adelanta la fecha, «Saltar» solo la adelanta, y los dos se deshacen con `revert`.
 */

const run = <T>(fn: () => Promise<T>) => serial(FINANCE_QUEUE, fn)

/** Quita la suscripción de los avisos al instante (la lista completa se refresca al vaciarse la cola). */
function dropFromUpcoming(qc: QueryClient, id: string) {
  const prev = qc.getQueryData<Subscription[]>(financeKeys.upcoming)
  if (prev)
    qc.setQueryData(
      financeKeys.upcoming,
      prev.filter((s) => s.id !== id),
    )
  return prev
}

export async function chargeSubscription(m: Muninn, qc: QueryClient, s: Subscription) {
  const prev = dropFromUpcoming(qc, s.id)
  try {
    const res = await run(() => m.finance.subscriptions.charge(s.id, { expected: s.nextDate }))
    settleFinance(qc)
    notifyUndo(t('toast.chargeLogged', { ns: 'finance', name: s.name }), {
      icon: 'recurring',
      description: amountText(res.transaction.amount, 'none'),
      undo: () =>
        run(() =>
          m.finance.subscriptions.revert(s.id, {
            previousDate: res.previousDate,
            transactionId: res.transaction.id,
          }),
        ).finally(() => settleFinance(qc)),
      undone: t('toast.chargeUndone', { ns: 'finance' }),
      failTitle: t('toast.chargeUndoFailed', { ns: 'finance' }),
    })
    return true
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.upcoming, prev)
    fail(t('toast.chargeFailed', { ns: 'finance' }), err)
    settleFinance(qc)
    return false
  }
}

export async function skipSubscription(m: Muninn, qc: QueryClient, s: Subscription) {
  const prev = dropFromUpcoming(qc, s.id)
  try {
    const res = await run(() => m.finance.subscriptions.skip(s.id, { expected: s.nextDate }))
    settleFinance(qc)
    notifyUndo(t('toast.chargeSkipped', { ns: 'finance', name: s.name }), {
      icon: 'move',
      description: t('toast.chargeSkippedHint', { ns: 'finance' }),
      undo: () =>
        run(() => m.finance.subscriptions.revert(s.id, { previousDate: res.previousDate })).finally(
          () => settleFinance(qc),
        ),
      undone: t('toast.pendingAgain', { ns: 'finance' }),
    })
    return true
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.upcoming, prev)
    fail(t('toast.skipFailed', { ns: 'finance' }), err)
    settleFinance(qc)
    return false
  }
}

/**
 * Crea una suscripción. Con `chargeNow` (la casilla «Repetir» del alta de un gasto), apunta ya el primer cobro: el
 * gasto queda enlazado y la próxima fecha pasa al siguiente periodo.
 */
export async function createSubscription(
  m: Muninn,
  qc: QueryClient,
  input: CreateSubscriptionInput,
  opts: { chargeNow?: boolean } = {},
) {
  try {
    const { sub, txId } = await run(async () => {
      const sub = await m.finance.subscriptions.create(input)
      if (!opts.chargeNow) return { sub, txId: undefined }
      const res = await m.finance.subscriptions.charge(sub.id, { expected: sub.nextDate })
      return { sub: res.subscription, txId: res.transaction.id }
    })
    settleFinance(qc)
    notifyUndo(
      opts.chargeNow
        ? t('toast.subWithExpense', { ns: 'finance', name: sub.name })
        : t('toast.subCreated', { ns: 'finance', name: sub.name }),
      {
        icon: 'recurring',
        description: t('toast.subDesc', {
          ns: 'finance',
          amount: amountText(sub.amount, 'none'),
          date: numericDate(sub.nextDate),
        }),
        undo: () =>
          run(async () => {
            if (txId) await m.finance.transactions.archive(txId)
            await m.finance.subscriptions.archive(sub.id)
          }).finally(() => settleFinance(qc)),
        undone: [t('toast.undone', { ns: 'finance' }), { icon: 'archive' }],
      },
    )
    return sub
  } catch (err) {
    fail(t('toast.subCreateFailed', { ns: 'finance' }), err)
    settleFinance(qc)
    return null
  }
}

export async function updateSubscription(
  m: Muninn,
  qc: QueryClient,
  before: Subscription,
  patch: UpdateSubscriptionInput,
  opts: { undoing?: boolean } = {},
) {
  try {
    const saved = await run(() => m.finance.subscriptions.update(before.id, patch))
    settleFinance(qc)
    if (!opts.undoing) {
      const back: UpdateSubscriptionInput = {
        name: before.name,
        amount: before.amount,
        frequency: before.frequency,
        accountId: before.accountId,
        categoryId: before.categoryId,
        nextDate: before.nextDate,
        remindDays: before.remindDays,
      }
      notifyUndo(t('toast.subSaved', { ns: 'finance' }), {
        icon: 'check',
        id: `subscription-${before.id}`,
        undo: async () =>
          (await updateSubscription(m, qc, saved, back, { undoing: true })) !== null,
      })
    }
    return saved
  } catch (err) {
    fail(t('toast.subSaveFailed', { ns: 'finance' }), err)
    return null
  }
}

export async function archiveSubscription(m: Muninn, qc: QueryClient, s: Subscription) {
  const prev = qc.getQueryData<Subscription[]>(financeKeys.subscriptions)
  if (prev)
    qc.setQueryData(
      financeKeys.subscriptions,
      prev.filter((x) => x.id !== s.id),
    )
  dropFromUpcoming(qc, s.id)
  try {
    await run(() => m.finance.subscriptions.archive(s.id))
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.subscriptions, prev)
    fail(t('toast.subArchiveFailed', { ns: 'finance' }), err)
    settleFinance(qc)
    return false
  }
  settleFinance(qc)
  notifyUndo(t('toast.subArchived', { ns: 'finance', name: s.name }), {
    icon: 'archive',
    description: t('toast.subArchivedHint', { ns: 'finance' }),
    undo: () => run(() => m.finance.subscriptions.restore(s.id)).finally(() => settleFinance(qc)),
    undone: t('toast.subRestored', { ns: 'finance', name: s.name }),
    failTitle: t('toast.subRestoreFailed', { ns: 'finance' }),
  })
  return true
}
