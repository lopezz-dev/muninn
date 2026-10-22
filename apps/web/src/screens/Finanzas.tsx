import type { AccountWithBalance, Transaction } from '@muninn/core'
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  Icon,
  IconButton,
  icons,
  SegmentedControl,
  SheetContent,
} from '@muninn/ui'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'
import { monthLabel, shiftMonth } from '../lib/finance'
import { useMuninn } from '../lib/muninn'
import { useIsDesktop } from '../lib/use-media'
import type { FinanceView } from '../router'
import { AccountDialog, Accounts } from './finanzas/Accounts'
import { Movements } from './finanzas/Movements'
import { Overview } from './finanzas/Overview'
import { SubscriptionsCard, SubscriptionsView, UpcomingCharges } from './finanzas/Subscriptions'
import { TransactionForm } from './finanzas/TransactionForm'
import { useFinanceBase } from './finanzas/use-finance'

const route = getRouteApi('/_app/finanzas')

const VIEWS: { value: FinanceView; label: string }[] = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'movimientos', label: 'Movimientos' },
  { value: 'suscripciones', label: 'Suscripciones' },
  { value: 'cuentas', label: 'Cuentas' },
]

/**
 * Finanzas (Finanzas.dc.html, Movimientos.dc.html y sus versiones móviles; ADR-0037): cuentas con su saldo,
 * movimientos del mes con filtros, alta rápida y cuentas y categorías editables. La vista va en la URL.
 */
export function Finanzas() {
  const m = useMuninn()
  const desktop = useIsDesktop()
  const navigate = useNavigate()
  const view = route.useSearch().vista ?? 'resumen'
  const today = m.today()
  const [month, setMonth] = useState(today.slice(0, 7))
  const { accounts, categories, accountById, categoryById, loading, error } = useFinanceBase()
  // Alta (`editing` vacío) o edición de un movimiento en un diálogo (o una hoja, en móvil).
  const [txDialog, setTxDialog] = useState<{ open: boolean; editing?: Transaction }>({
    open: false,
  })
  const [accountDialog, setAccountDialog] = useState<{
    open: boolean
    editing?: AccountWithBalance
  }>({ open: false })

  const setView = (vista: FinanceView) =>
    navigate({ to: '/finanzas', search: vista === 'resumen' ? {} : { vista }, replace: true })
  const openTx = (tx?: Transaction) => setTxDialog({ open: true, editing: tx })

  const hasAccounts = Boolean(accounts?.some((a) => !a.archivedAt))
  // En escritorio, la vista Movimientos lleva el alta fija a la derecha (como el diseño).
  const inlineForm = desktop && view === 'movimientos'

  const monthNav = (
    <div className="flex items-center gap-1">
      <IconButton
        aria-label="Mes anterior"
        icon={<icons.chevronLeft />}
        variant="secondary"
        onClick={() => setMonth((mo) => shiftMonth(mo, -1))}
        className="size-11 md:size-8"
      />
      <span
        className="min-w-[100px] text-center text-sm font-medium md:min-w-[120px]"
        aria-live="polite"
      >
        {monthLabel(month)}
      </span>
      <IconButton
        aria-label="Mes siguiente"
        icon={<icons.chevronRight />}
        variant="secondary"
        onClick={() => setMonth((mo) => shiftMonth(mo, 1))}
        className="size-11 md:size-8"
      />
    </div>
  )

  const form =
    accounts && categories ? (
      <TransactionForm
        key={txDialog.editing?.id ?? 'new'}
        accounts={accounts}
        categories={categories}
        today={today}
        editing={txDialog.editing}
        large={!desktop}
        onDone={() => setTxDialog({ open: false })}
      />
    ) : null

  let body: ReactNode
  if (loading) {
    body = (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Ghost className="h-24" />
        <Ghost className="h-48 opacity-60" />
      </div>
    )
  } else if (error || !accounts || !categories) {
    body = (
      <EmptyState icon="warning" title="No se pudieron cargar tus finanzas">
        Comprueba la conexión y vuelve a intentarlo.
      </EmptyState>
    )
  } else if (!hasAccounts) {
    body = (
      <EmptyState
        icon="finance"
        title="Empieza por tus cuentas"
        actions={
          <Button variant="primary" onClick={() => setAccountDialog({ open: true })}>
            <Icon name="plus" />
            Crear la primera cuenta
          </Button>
        }
      >
        Una cuenta corriente, una hucha o el efectivo, con lo que tengan hoy. Después apuntas
        gastos, ingresos y traspasos, y el saldo se calcula solo.
      </EmptyState>
    )
  } else if (view === 'suscripciones') {
    body = <SubscriptionsView accounts={accounts} categories={categories} today={today} />
  } else if (view === 'cuentas') {
    body = (
      <Accounts
        accounts={accounts}
        categories={categories}
        onNewAccount={() => setAccountDialog({ open: true })}
        onEditAccount={(a) => setAccountDialog({ open: true, editing: a })}
      />
    )
  } else if (view === 'movimientos') {
    const list = (
      <Movements
        month={month}
        today={today}
        accounts={accounts}
        categories={categories}
        accountById={accountById}
        categoryById={categoryById}
        onOpen={openTx}
      />
    )
    body = inlineForm ? (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {list}
        <Card aria-label="Nuevo movimiento" className="flex flex-col gap-3 p-4 lg:sticky lg:top-7">
          <h2 className="text-md font-semibold">Nuevo movimiento</h2>
          <TransactionForm accounts={accounts} categories={categories} today={today} />
        </Card>
      </div>
    ) : (
      list
    )
  } else {
    body = (
      <Overview
        month={month}
        today={today}
        accounts={accounts}
        accountById={accountById}
        categoryById={categoryById}
        onOpen={openTx}
        onAllMovements={() => setView('movimientos')}
        onAccounts={() => setView('cuentas')}
        aside={<SubscriptionsCard today={today} onManage={() => setView('suscripciones')} />}
      >
        <UpcomingCharges today={today} />
      </Overview>
    )
  }

  const title = txDialog.editing ? 'Editar movimiento' : 'Nuevo movimiento'

  return (
    <Page>
      <PageHeader
        title="Finanzas"
        description={
          view === 'movimientos' || view === 'resumen'
            ? undefined
            : 'Cuentas, gastos, ingresos y ahorro.'
        }
        actions={
          hasAccounts ? (
            <>
              {view === 'movimientos' || view === 'resumen' ? monthNav : null}
              {inlineForm ? null : (
                <Button variant="primary" size={desktop ? 'md' : 'lg'} onClick={() => openTx()}>
                  <Icon name="plus" />
                  Movimiento
                </Button>
              )}
            </>
          ) : null
        }
      />
      {hasAccounts ? (
        <SegmentedControl
          aria-label="Sección de Finanzas"
          value={view}
          onValueChange={setView}
          options={VIEWS}
          fill={!desktop}
          size={desktop ? 'md' : 'lg'}
          className="self-start"
        />
      ) : null}
      {body}

      <Dialog open={txDialog.open} onOpenChange={(open) => setTxDialog((d) => ({ ...d, open }))}>
        {desktop ? (
          <DialogContent title={title}>{txDialog.open ? form : null}</DialogContent>
        ) : (
          <SheetContent side="bottom" title={title}>
            {txDialog.open ? form : null}
          </SheetContent>
        )}
      </Dialog>
      <AccountDialog
        open={accountDialog.open}
        editing={accountDialog.editing}
        onOpenChange={(open) => setAccountDialog((d) => ({ ...d, open }))}
      />
    </Page>
  )
}
