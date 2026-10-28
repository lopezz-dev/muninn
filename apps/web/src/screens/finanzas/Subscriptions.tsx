import type {
  AccountWithBalance,
  FinanceCategory,
  Subscription,
  SubscriptionFrequency,
} from '@muninn/core'
import {
  AmountField,
  Button,
  Card,
  CardHeader,
  cn,
  DateField,
  Dialog,
  DialogClose,
  DialogContent,
  Icon,
  IconButton,
  icons,
  projectColor,
  SegmentedControl,
  TextField,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Ghost } from '../../components/Page'
import { SelectMenu } from '../../components/SelectMenu'
import { amountText, chargeLabel, FREQUENCY_LABEL } from '../../lib/finance'
import { subscriptionsQuery } from '../../lib/finance-queries'
import { useMuninn } from '../../lib/muninn'
import {
  archiveSubscription,
  createSubscription,
  updateSubscription,
} from '../../lib/subscription-actions'
import { Logo, tone, UpcomingCharges } from './UpcomingCharges'

export { UpcomingCharges }

/** Coste mensual equivalente (ADR-0038). Duplica `monthlyCost` del core: la UI solo importa tipos del core. */
const perMonth = (s: Pick<Subscription, 'amount' | 'frequency'>) =>
  s.frequency === 'monthly'
    ? s.amount
    : s.frequency === 'yearly'
      ? Math.round(s.amount / 12)
      : Math.round((s.amount * 52) / 12)

/** Tarjeta «Suscripciones» del Resumen: todas, por próximo cobro, con el total al mes. */
export function SubscriptionsCard({ today, onManage }: { today: string; onManage: () => void }) {
  const m = useMuninn()
  const subs = useQuery(subscriptionsQuery(m)).data
  const total = (subs ?? []).reduce((sum, s) => sum + perMonth(s), 0)
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Suscripciones"
        description={subs?.length ? `${amountText(total, 'none')}/mes` : undefined}
        action={
          <button
            type="button"
            onClick={onManage}
            className="cursor-pointer text-sm text-accent hover:text-accent-hover"
          >
            Gestionar
          </button>
        }
      />
      {!subs ? (
        <Ghost className="mx-4 mb-4 h-10" />
      ) : subs.length === 0 ? (
        <p className="border-t border-border-subtle px-4 py-5 text-sm text-fg-subtle">
          Apunta tus suscripciones y Muninn te avisará antes de cada cobro.
        </p>
      ) : (
        <ul className="flex flex-col pb-1.5">
          {subs.slice(0, 6).map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 border-t border-border-subtle px-4 py-2.5"
            >
              <Logo name={s.name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base">{s.name}</span>
                <span className={cn('text-xs', tone(s, today))}>{chargeLabel(s, today)}</span>
              </span>
              <span className="font-mono text-base tabular">{amountText(s.amount, 'none')}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const FREQUENCIES: SubscriptionFrequency[] = ['monthly', 'yearly', 'weekly']
const REMIND = [0, 1, 3, 7, 14]

/** Alta y edición de una suscripción. */
export function SubscriptionDialog({
  open,
  onOpenChange,
  editing,
  accounts,
  categories,
  today,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Subscription
  accounts: AccountWithBalance[]
  categories: FinanceCategory[]
  today: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? `Editar «${editing.name}»` : 'Nueva suscripción'}
        description="Muninn te avisa antes de cada cobro; tú lo confirmas con un toque."
      >
        {open ? (
          <SubscriptionForm
            key={editing?.id ?? 'new'}
            editing={editing}
            accounts={accounts}
            categories={categories}
            today={today}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SubscriptionForm({
  editing,
  accounts,
  categories,
  today,
  onDone,
}: {
  editing?: Subscription
  accounts: AccountWithBalance[]
  categories: FinanceCategory[]
  today: string
  onDone: () => void
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const open = accounts.filter((a) => !a.archivedAt || a.id === editing?.accountId)
  const cats = categories.filter(
    (c) => c.kind === 'expense' && (!c.archivedAt || c.id === editing?.categoryId),
  )
  const [name, setName] = useState(editing?.name ?? '')
  const [amount, setAmount] = useState<number | null>(editing?.amount ?? null)
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(editing?.frequency ?? 'monthly')
  const [accountId, setAccountId] = useState(
    editing?.accountId ?? (open.find((a) => a.kind === 'checking') ?? open[0])?.id ?? '',
  )
  const [categoryId, setCategoryId] = useState(
    editing ? (editing.categoryId ?? '') : (cats.find((c) => c.key === 'subscriptions')?.id ?? ''),
  )
  const [nextDate, setNextDate] = useState(editing?.nextDate ?? today)
  const [remindDays, setRemindDays] = useState(editing?.remindDays ?? 3)
  const [error, setError] = useState<string>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Ponle un nombre')
    if (!amount) return setError('Escribe el importe')
    if (!accountId) return setError('Elige una cuenta')
    if (!nextDate) return setError('Elige el próximo cobro')
    const fields = {
      name: name.trim(),
      amount,
      frequency,
      accountId,
      categoryId: categoryId || null,
      nextDate,
      remindDays,
    }
    const ok = editing
      ? await updateSubscription(m, qc, editing, fields)
      : await createSubscription(m, qc, fields)
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Nombre"
        value={name}
        maxLength={80}
        onChange={(e) => {
          setName(e.target.value)
          setError(undefined)
        }}
        placeholder="Spotify"
        error={error}
        autoComplete="off"
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField
          label="Importe por cobro"
          valueCents={amount}
          onValueChange={(v) => {
            setAmount(v)
            setError(undefined)
          }}
          placeholder="0,00"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">Cada</span>
          <SegmentedControl
            aria-label="Frecuencia"
            fill
            value={frequency}
            onValueChange={setFrequency}
            options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
            className="h-9 [&>button]:h-full"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">Cuenta</span>
          <SelectMenu
            label="Cuenta"
            value={accountId}
            onChange={setAccountId}
            options={open.map((a) => ({ value: a.id, label: a.name, dot: projectColor(a.color) }))}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">Categoría</span>
          <SelectMenu
            label="Categoría"
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: '', label: 'Sin categoría' },
              ...cats.map((c) => ({ value: c.id, label: c.name, dot: projectColor(c.color) })),
            ]}
          />
        </div>
        <DateField
          label="Próximo cobro"
          value={nextDate}
          onChange={setNextDate}
          today={m.today()}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">Avisar</span>
          <SelectMenu
            label="Avisar"
            value={String(remindDays)}
            onChange={(v) => setRemindDays(Number(v))}
            options={REMIND.map((d) => ({
              value: String(d),
              label: d === 0 ? 'El mismo día' : d === 1 ? '1 día antes' : `${d} días antes`,
            }))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary">
          {editing ? 'Guardar' : 'Crear suscripción'}
        </Button>
      </div>
    </form>
  )
}

/** Vista «Suscripciones»: todas, con su coste mensual, para editarlas y archivarlas. */
export function SubscriptionsView({
  accounts,
  categories,
  today,
}: {
  accounts: AccountWithBalance[]
  categories: FinanceCategory[]
  today: string
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const subs = useQuery(subscriptionsQuery(m)).data
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Subscription }>({ open: false })
  const accountName = new Map(accounts.map((a) => [a.id, a.name]))
  const total = (subs ?? []).reduce((sum, s) => sum + perMonth(s), 0)
  return (
    <div className="flex flex-col gap-4">
      <UpcomingCharges today={today} />
      <Card className="flex flex-col">
        <CardHeader
          title="Suscripciones"
          description={
            subs?.length
              ? `${amountText(total, 'none')} al mes · ${amountText(total * 12, 'none')} al año`
              : 'Pagos que se repiten: Muninn te avisa antes de cada cobro.'
          }
          action={
            <Button size="sm" variant="primary" onClick={() => setDialog({ open: true })}>
              <Icon name="plus" />
              Nueva
            </Button>
          }
        />
        {!subs ? (
          <Ghost className="mx-4 mb-4 h-10" />
        ) : (
          <ul className="flex flex-col pb-1.5">
            {subs.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 border-t border-border-subtle py-2 pr-2 pl-4"
              >
                <button
                  type="button"
                  onClick={() => setDialog({ open: true, editing: s })}
                  aria-label={`Editar ${s.name}`}
                  className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 text-left outline-none focus-visible:underline"
                >
                  <Logo name={s.name} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base">{s.name}</span>
                    <span className="truncate text-xs text-fg-subtle">
                      <span className={tone(s, today)}>{chargeLabel(s, today)}</span>
                      {/* `chargeLabel` ya dice «Anual · …» si no es mensual y falta más de un día. */}
                      {chargeLabel(s, today).startsWith(FREQUENCY_LABEL[s.frequency])
                        ? ''
                        : ` · ${FREQUENCY_LABEL[s.frequency]}`}
                      {` · ${accountName.get(s.accountId) ?? '?'}`}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="font-mono text-base tabular">
                      {amountText(s.amount, 'none')}
                    </span>
                    {s.frequency !== 'monthly' ? (
                      <span className="font-mono text-xs text-fg-subtle tabular">
                        {amountText(perMonth(s), 'none')}/mes
                      </span>
                    ) : null}
                  </span>
                </button>
                <IconButton
                  aria-label={`Archivar ${s.name}`}
                  icon={<icons.archive />}
                  onClick={() => archiveSubscription(m, qc, s)}
                  className="size-11 md:size-8"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <SubscriptionDialog
        open={dialog.open}
        editing={dialog.editing}
        accounts={accounts}
        categories={categories}
        today={today}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </div>
  )
}
