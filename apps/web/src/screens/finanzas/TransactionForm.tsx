import type { AccountWithBalance, FinanceCategory, Transaction } from '@muninn/core'
import {
  AmountField,
  Button,
  Checkbox,
  Icon,
  projectColor,
  SegmentedControl,
  TextField,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { SelectMenu } from '../../components/SelectMenu'
import {
  ACCOUNT_KIND_LABEL,
  categoriesFor,
  destinationKinds,
  ENTRY_LABEL,
  type EntryKind,
  entryKindOf,
  txKindOf,
} from '../../lib/finance'
import { archiveTransaction, createTransaction, updateTransaction } from '../../lib/finance-actions'
import { useMuninn } from '../../lib/muninn'
import { createSubscription } from '../../lib/subscription-actions'

const ENTRIES: EntryKind[] = ['expense', 'income', 'saving', 'investment', 'transfer']

const SAVE_LABEL: Record<EntryKind, string> = {
  expense: 'Guardar gasto',
  income: 'Guardar ingreso',
  saving: 'Guardar ahorro',
  investment: 'Guardar inversión',
  transfer: 'Guardar traspaso',
}

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
    hint: ACCOUNT_KIND_LABEL[a.kind],
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!amount) return setError('Escribe el importe')
    if (!accountId) return setError('Elige una cuenta')
    if (kind === 'transfer' && !effectiveTo) {
      return setError(
        entry === 'saving'
          ? 'Crea antes una cuenta de ahorro (Cuentas)'
          : entry === 'investment'
            ? 'Crea antes una cuenta de inversión (Cuentas)'
            : 'Necesitas otra cuenta a la que traspasar',
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
              name: fields.concept || 'Suscripción',
              amount,
              frequency: 'monthly',
              accountId,
              categoryId: fields.categoryId,
              nextDate: fields.date,
            },
            { chargeNow: true },
          )
        : await createTransaction(m, qc, fields, { title: `${ENTRY_LABEL[entry]} guardado` })
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
        aria-label="Tipo"
        fill
        size="lg"
        value={entry}
        onValueChange={(v) => {
          setEntry(v)
          setError(undefined)
        }}
        options={ENTRIES.map((v) => ({ value: v, label: ENTRY_LABEL[v] }))}
        className="[&>button]:px-1"
      />
      <AmountField
        label="Importe"
        size="lg"
        valueCents={amount}
        onValueChange={(v) => {
          setAmount(v)
          setError(undefined)
        }}
        placeholder="0,00"
        className="[&_input]:h-14 [&_input]:font-mono [&_input]:text-[28px]"
        error={error}
      />
      <TextField
        label="Concepto"
        size={large ? 'lg' : 'md'}
        value={concept}
        maxLength={200}
        onChange={(e) => setConcept(e.target.value)}
        placeholder={entry === 'expense' ? 'Cine + palomitas' : ''}
        autoComplete="off"
      />
      <div className="grid grid-cols-2 gap-3">
        {kind === 'transfer' ? null : (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Categoría</span>
            <SelectMenu
              label="Categoría"
              large={large}
              value={effectiveCat}
              onChange={setCategoryId}
              options={[
                { value: '', label: 'Sin categoría' },
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
            {kind === 'transfer' ? 'Desde' : 'Cuenta'}
          </span>
          <SelectMenu
            label={kind === 'transfer' ? 'Desde' : 'Cuenta'}
            large={large}
            value={accountId}
            onChange={setAccountId}
            options={fromOptions.map(accountOption)}
            disabled={fromOptions.length === 0}
          />
        </div>
        {kind === 'transfer' ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">A</span>
            <SelectMenu
              label="A la cuenta"
              large={large}
              value={effectiveTo}
              onChange={setToAccountId}
              options={toOptions.map(accountOption)}
              disabled={toOptions.length === 0}
              buttonText={toOptions.length === 0 ? 'Sin cuentas' : undefined}
            />
          </div>
        ) : null}
      </div>
      <TextField
        label="Fecha"
        type="date"
        size={large ? 'lg' : 'md'}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        leading={<Icon name="calendar" />}
      />
      {!editing && entry === 'expense' ? (
        <div className="flex items-center gap-2.5 text-sm">
          <Checkbox id="tx-repeat" checked={repeat} onCheckedChange={setRepeat} touch />
          <label htmlFor="tx-repeat">Repetir cada mes (suscripción)</label>
        </div>
      ) : null}
      <Button type="submit" variant="primary" size={large ? 'lg' : 'md'} disabled={saving}>
        {editing ? 'Guardar cambios' : SAVE_LABEL[entry]}
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
          Archivar movimiento
        </Button>
      ) : (
        <p className="text-xs leading-relaxed text-fg-subtle">
          También puedes decírselo al asistente: «He gastado 24,90 en el cine».
        </p>
      )}
    </form>
  )
}
