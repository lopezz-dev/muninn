import type { AccountWithBalance, FinanceCategory, Transaction } from '@muninn/core'
import {
  AmountField,
  Button,
  Checkbox,
  DateField,
  formatAmount,
  Icon,
  projectColor,
  SegmentedControl,
  TextField,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectMenu } from '../../components/SelectMenu'
import { intlLocale } from '../../i18n'
import {
  accountKindLabel,
  categoriesFor,
  destinationKinds,
  type EntryKind,
  entryKindOf,
  entryLabel,
  txKindOf,
} from '../../lib/finance'
import { archiveTransaction, createTransaction, updateTransaction } from '../../lib/finance-actions'
import { useMuninn } from '../../lib/muninn'
import { createSubscription } from '../../lib/subscription-actions'

const ENTRIES: EntryKind[] = ['expense', 'income', 'saving', 'investment', 'transfer']

interface Props {
  accounts: AccountWithBalance[]
  categories: FinanceCategory[]
  today: string
  /** Al editar: el movimiento. Sin él, es un alta. */
  editing?: Transaction
  /** Tras guardar o archivar (cierra el diálogo, si lo hay). */
  onDone?: () => void
  /** Táctil: campos de 44 px. */
  large?: boolean
}

/**
 * Alta y edición de un movimiento (Movimientos.dc.html, M-Movimiento.dc.html). «Ahorro» e «Inversión» son
 * traspasos a una cuenta de ese tipo (ADR-0037): el destino solo ofrece esas cuentas.
 */
export function TransactionForm({ accounts, categories, today, editing, onDone, large }: Props) {
  const { t } = useTranslation('finance')
  const m = useMuninn()
  const qc = useQueryClient()
  const open = accounts.filter((a) => !a.archivedAt)
  const byId = new Map(accounts.map((a) => [a.id, a]))

  const [entry, setEntry] = useState<EntryKind>(() =>
    editing ? entryKindOf(editing, byId) : 'expense',
  )
  const [amount, setAmount] = useState<number | null>(editing?.amount ?? null)
  const [concept, setConcept] = useState(editing?.concept ?? '')
  const [date, setDate] = useState(editing?.date ?? today)
  const [accountId, setAccountId] = useState(
    editing?.accountId ?? (open.find((a) => a.kind === 'checking') ?? open[0])?.id ?? '',
  )
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId ?? '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [repeat, setRepeat] = useState(false)

  const kind = txKindOf(entry)
  // Las cuentas que ya tiene un movimiento antiguo se ofrecen aunque estén archivadas.
  const selectable = (id: string) => open.some((a) => a.id === id) || id === editing?.accountId
  const fromOptions = accounts.filter((a) => selectable(a.id) || a.id === accountId)
  const destKinds = destinationKinds(entry)
  const toOptions = accounts.filter(
    (a) =>
      a.id !== accountId &&
      (!destKinds || destKinds.includes(a.kind)) &&
      (!a.archivedAt || a.id === editing?.toAccountId),
  )
  const effectiveTo = toOptions.some((a) => a.id === toAccountId)
    ? toAccountId
    : (toOptions[0]?.id ?? '')
  const catOptions = categoriesFor(categories, kind)
  const currentCat = categories.find((c) => c.id === categoryId)
  if (currentCat?.archivedAt && currentCat.kind === kind) catOptions.push(currentCat)
  const effectiveCat = catOptions.some((c) => c.id === categoryId) ? categoryId : ''

  const accountOption = (a: AccountWithBalance) => ({
    value: a.id,
    label: a.name,
    dot: projectColor(a.color),
    hint: accountKindLabel(a.kind),
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!amount) return setError(t('form.amountRequired'))
    if (!accountId) return setError(t('form.accountRequired'))
    if (kind === 'transfer' && !effectiveTo) {
      return setError(
        entry === 'saving'
          ? t('form.needSavings')
          : entry === 'investment'
            ? t('form.needInvestment')
            : t('form.needOther'),
      )
    }
    setSaving(true)
    const fields = {
      kind,
      amount,
      date: date || today,
      accountId,
      toAccountId: kind === 'transfer' ? effectiveTo : null,
      categoryId: kind === 'transfer' ? null : effectiveCat || null,
      concept: concept.trim(),
    }
    const recurring = !editing && repeat && kind === 'expense'
    const ok = editing
      ? await updateTransaction(m, qc, editing, fields)
      : recurring
        ? // La suscripción nace con este cobro ya apuntado (y enlazado): la próxima fecha es el mes que viene.
          await createSubscription(
            m,
            qc,
            {
              name: fields.concept || t('form.defaultSubscription'),
              amount,
              frequency: 'monthly',
              accountId,
              categoryId: fields.categoryId,
              nextDate: fields.date,
            },
            { chargeNow: true },
          )
        : await createTransaction(m, qc, fields, { title: t(`toast.txSaved.${entry}`) })
    setSaving(false)
    if (!ok) return
    if (!editing) {
      // El formulario fijo del escritorio se queda listo para el siguiente.
      setAmount(null)
      setConcept('')
      setRepeat(false)
    }
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <SegmentedControl
        aria-label={t('form.type')}
        fill
        size="lg"
        value={entry}
        onValueChange={(v) => {
          setEntry(v)
          setError(undefined)
        }}
        options={ENTRIES.map((v) => ({ value: v, label: entryLabel(v) }))}
        className="[&>button]:px-1"
      />
      <AmountField
        locale={intlLocale()}
        label={t('form.amount')}
        size="lg"
        valueCents={amount}
        onValueChange={(v) => {
          setAmount(v)
          setError(undefined)
        }}
        placeholder={formatAmount(0, intlLocale())}
        className="[&_input]:h-14 [&_input]:font-mono [&_input]:text-[28px]"
        error={error}
      />
      <TextField
        label={t('form.concept')}
        size={large ? 'lg' : 'md'}
        value={concept}
        maxLength={200}
        onChange={(e) => setConcept(e.target.value)}
        placeholder={entry === 'expense' ? t('form.conceptPlaceholder') : ''}
        autoComplete="off"
      />
      <div className="grid grid-cols-2 gap-3">
        {kind === 'transfer' ? null : (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">{t('category')}</span>
            <SelectMenu
              label={t('category')}
              large={large}
              value={effectiveCat}
              onChange={setCategoryId}
              options={[
                { value: '', label: t('noCategory') },
                ...catOptions.map((c) => ({
                  value: c.id,
                  label: c.name,
                  dot: projectColor(c.color),
                })),
              ]}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">
            {kind === 'transfer' ? t('form.from') : t('account')}
          </span>
          <SelectMenu
            label={kind === 'transfer' ? t('form.from') : t('account')}
            large={large}
            value={accountId}
            onChange={setAccountId}
            options={fromOptions.map(accountOption)}
            disabled={fromOptions.length === 0}
          />
        </div>
        {kind === 'transfer' ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">{t('form.to')}</span>
            <SelectMenu
              label={t('form.toAccount')}
              large={large}
              value={effectiveTo}
              onChange={setToAccountId}
              options={toOptions.map(accountOption)}
              disabled={toOptions.length === 0}
              buttonText={toOptions.length === 0 ? t('form.noAccounts') : undefined}
            />
          </div>
        ) : null}
      </div>
      <DateField
        label={t('form.date')}
        size={large ? 'lg' : 'md'}
        value={date}
        onChange={setDate}
        today={m.today()}
      />
      {!editing && entry === 'expense' ? (
        <div className="flex items-center gap-2.5 text-sm">
          <Checkbox id="tx-repeat" checked={repeat} onCheckedChange={setRepeat} touch />
          <label htmlFor="tx-repeat">{t('form.repeat')}</label>
        </div>
      ) : null}
      <Button type="submit" variant="primary" size={large ? 'lg' : 'md'} disabled={saving}>
        {editing ? t('form.saveChanges') : t(`form.saveLabel.${entry}`)}
      </Button>
      {editing ? (
        <Button
          variant="danger"
          size={large ? 'lg' : 'md'}
          disabled={saving}
          onClick={async () => {
            if (await archiveTransaction(m, qc, editing)) onDone?.()
          }}
        >
          <Icon name="archive" />
          {t('form.archive')}
        </Button>
      ) : (
        <p className="text-xs leading-relaxed text-fg-subtle">{t('form.assistantHint')}</p>
      )}
    </form>
  )
}
