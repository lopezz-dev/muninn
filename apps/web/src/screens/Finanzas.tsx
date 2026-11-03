import type { AccountWithBalance, Transaction } from '@muninn/core'
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  Icon,
  IconButton,
  icons,
  MonthPicker,
  SegmentedControl,
  SheetContent,
} from '@muninn/ui'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

// Los valores van en la URL y no se traducen; las etiquetas, al pintar.
const VIEWS: FinanceView[] = ['resumen', 'movimientos', 'suscripciones', 'cuentas']

/**
 * Finanzas (Finanzas.dc.html, Movimientos.dc.html y sus versiones móviles; ADR-0037): cuentas con su saldo,
 * movimientos del mes con filtros, alta rápida y cuentas y categorías editables. La vista va en la URL.
 */
export function Finanzas() {
  const { t } = useTranslation('finance')
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
        aria-label={t('month.previous')}
        icon={<icons.chevronLeft />}
        variant="secondary"
        onClick={() => setMonth((mo) => shiftMonth(mo, -1))}
        className="size-11 md:size-8"
      />
      <MonthPicker value={month} onChange={setMonth} current={today.slice(0, 7)}>
        <button
          type="button"
          aria-label={t('month.pick', { month: monthLabel(month) })}
          className="inline-flex h-11 min-w-[100px] cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent data-[state=open]:bg-surface-hover md:h-8 md:min-w-[120px]"
        >
          <span aria-live="polite">{monthLabel(month)}</span>
          <icons.chevronDown size={12} className="text-fg-subtle" />
        </button>
      </MonthPicker>
      <IconButton
        aria-label={t('month.next')}
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
      <EmptyState icon="warning" title={t('loadFailed')}>
        {t('loadFailedHint')}
      </EmptyState>
    )
  } else if (!hasAccounts) {
    body = (
      <EmptyState
        icon="finance"
        title={t('empty.title')}
        actions={
          <Button variant="primary" onClick={() => setAccountDialog({ open: true })}>
            <Icon name="plus" />
            {t('empty.action')}
          </Button>
        }
      >
        {t('empty.text')}
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
      // lg: la pantalla mide lo que la ventana (ADR-0050); la lista hace scroll dentro de su tarjeta y el
      // formulario se queda a la vista.
      <div className="grid grid-cols-1 items-start gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)]">
        {list}
        <Card
          aria-label={t('newTransaction')}
          className="flex flex-col gap-3 p-4 lg:max-h-full lg:overflow-y-auto"
        >
          <h2 className="text-md font-semibold">{t('newTransaction')}</h2>
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

  const title = txDialog.editing ? t('editTransaction') : t('newTransaction')

  return (
    <Page className={inlineForm ? 'lg:min-h-0' : undefined}>
      <PageHeader
        title={t('title')}
        description={view === 'movimientos' || view === 'resumen' ? undefined : t('description')}
        actions={
          hasAccounts ? (
            <>
              {view === 'movimientos' || view === 'resumen' ? monthNav : null}
              {inlineForm ? null : (
                <Button variant="primary" size={desktop ? 'md' : 'lg'} onClick={() => openTx()}>
                  <Icon name="plus" />
                  {t('transactionButton')}
                </Button>
              )}
            </>
          ) : null
        }
      />
      {hasAccounts ? (
        <SegmentedControl
          aria-label={t('sectionNav')}
          value={view}
          onValueChange={setView}
          options={VIEWS.map((v) => ({ value: v, label: t(`views.${v}`) }))}
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
