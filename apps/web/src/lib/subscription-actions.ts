import type {
  CreateSubscriptionInput,
  Muninn,
  Subscription,
  UpdateSubscriptionInput,
} from '@muninn/core'
import { notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { amountText } from './finance'
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
    notify.success(`Cobro de «${s.name}» apuntado`, {
      icon: 'recurring',
      description: amountText(res.transaction.amount, 'none'),
      action: {
        label: 'Deshacer',
        onClick: async () => {
          try {
            await run(() =>
              m.finance.subscriptions.revert(s.id, {
                previousDate: res.previousDate,
                transactionId: res.transaction.id,
              }),
            )
            notify.info('Cobro deshecho')
          } catch (err) {
            fail('No se pudo deshacer el cobro', err)
          }
          settleFinance(qc)
        },
      },
    })
    return true
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.upcoming, prev)
    fail('No se pudo apuntar el cobro', err)
    settleFinance(qc)
    return false
  }
}

export async function skipSubscription(m: Muninn, qc: QueryClient, s: Subscription) {
  const prev = dropFromUpcoming(qc, s.id)
  try {
    const res = await run(() => m.finance.subscriptions.skip(s.id, { expected: s.nextDate }))
    settleFinance(qc)
    notify.success(`Cobro de «${s.name}» saltado`, {
      icon: 'move',
      description: 'sin apuntar gasto',
      action: {
        label: 'Deshacer',
        onClick: async () => {
          try {
            await run(() =>
              m.finance.subscriptions.revert(s.id, { previousDate: res.previousDate }),
            )
            notify.info('Vuelve a estar pendiente')
          } catch (err) {
            fail('No se pudo deshacer', err)
          }
          settleFinance(qc)
        },
      },
    })
    return true
  } catch (err) {
    if (prev) qc.setQueryData(financeKeys.upcoming, prev)
    fail('No se pudo saltar el cobro', err)
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
    notify.success(
      opts.chargeNow
        ? `Gasto y suscripción «${sub.name}» guardados`
        : `Suscripción «${sub.name}» creada`,
      {
        icon: 'recurring',
        description: `${amountText(sub.amount, 'none')} · próximo cobro ${sub.nextDate.split('-').reverse().join('/')}`,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            try {
              await run(async () => {
                if (txId) await m.finance.transactions.archive(txId)
                await m.finance.subscriptions.archive(sub.id)
              })
              notify.info('Deshecho', { icon: 'archive' })
            } catch (err) {
              fail('No se pudo deshacer', err)
            }
            settleFinance(qc)
          },
        },
      },
    )
    return sub
  } catch (err) {
    fail('No se pudo crear la suscripción', err)
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
      notify.success('Suscripción guardada', {
        icon: 'check',
        id: `subscription-${before.id}`,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            if (await updateSubscription(m, qc, saved, back, { undoing: true })) {
              notify.info('Cambio deshecho')
            }
          },
        },
      })
    }
    return saved
  } catch (err) {
    fail('No se pudo guardar la suscripción', err)
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
    fail('No se pudo archivar la suscripción', err)
    settleFinance(qc)
    return false
  }
  settleFinance(qc)
  notify.success(`«${s.name}» archivada`, {
    icon: 'archive',
    description: 'ya no avisará; sus cobros se conservan',
    action: {
      label: 'Deshacer',
      onClick: async () => {
        try {
          await run(() => m.finance.subscriptions.restore(s.id))
          notify.info(`«${s.name}» recuperada`)
        } catch (err) {
          fail('No se pudo recuperar la suscripción', err)
        }
        settleFinance(qc)
      },
    },
  })
  return true
}
