import type {
  AccountKind,
  AccountWithBalance,
  CategoryKind,
  FinanceCategory,
  FinanceColor,
} from '@muninn/core'
import {
  AmountField,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  Icon,
  IconButton,
  icons,
  ProgressBar,
  palette,
  projectColor,
  TextField,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { SelectMenu } from '../../components/SelectMenu'
import { type Swatch, SwatchPicker } from '../../components/SwatchPicker'
import { ACCOUNT_KIND_LABEL, amountText } from '../../lib/finance'
import {
  archiveAccount,
  createAccount,
  createCategory,
  updateAccount,
  updateCategory,
} from '../../lib/finance-actions'
import { useMuninn } from '../../lib/muninn'
import { SortableCategories } from './SortableCategories'

export const COLORS: Swatch<FinanceColor>[] = [
  { value: 'blue', label: 'Azul', color: palette.blue },
  { value: 'violet', label: 'Violeta', color: palette.violet },
  { value: 'teal', label: 'Verde azulado', color: palette.teal },
  { value: 'pink', label: 'Rosa', color: palette.pink },
  { value: 'green', label: 'Verde', color: palette.green },
  { value: 'amber', label: 'Ámbar', color: palette.amber },
  { value: 'gray', label: 'Gris', color: palette.gray },
]

const asColor = (c: string): FinanceColor =>
  COLORS.some((s) => s.value === c) ? (c as FinanceColor) : 'gray'

const KINDS = Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]

/** Línea secundaria de una cuenta: el tipo, o el objetivo de una hucha con su progreso. */
export function accountDetail(a: AccountWithBalance) {
  if (a.goal) {
    const pct = Math.max(0, Math.min(100, Math.round((a.balance / a.goal) * 100)))
    return `Objetivo ${amountText(a.goal, 'none')} · ${pct} %`
  }
  return ACCOUNT_KIND_LABEL[a.kind]
}

/** Alta y edición de una cuenta. */
export function AccountDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: AccountWithBalance
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? `Editar «${editing.name}»` : 'Nueva cuenta'}
        description={
          editing
            ? 'El saldo sale del saldo inicial y de los movimientos.'
            : 'Una cuenta corriente, una hucha, un fondo o el efectivo.'
        }
      >
        {open ? (
          <AccountForm
            key={editing?.id ?? 'new'}
            editing={editing}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AccountForm({ editing, onDone }: { editing?: AccountWithBalance; onDone: () => void }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [name, setName] = useState(editing?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(editing?.kind ?? 'checking')
  const [color, setColor] = useState<FinanceColor>(asColor(editing?.color ?? 'blue'))
  const [initial, setInitial] = useState<number | null>(
    editing ? Math.abs(editing.initialBalance) || null : null,
  )
  const [negative, setNegative] = useState((editing?.initialBalance ?? 0) < 0)
  const [goal, setGoal] = useState<number | null>(editing?.goal ?? null)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Ponle un nombre a la cuenta')
    setSaving(true)
    const fields = {
      name: clean,
      kind,
      color,
      initialBalance: (initial ?? 0) * (negative ? -1 : 1),
      goal: kind === 'savings' ? goal : null,
    }
    const ok = editing
      ? await updateAccount(m, qc, editing, fields)
      : await createAccount(m, qc, fields)
    setSaving(false)
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
        error={error}
        placeholder="Imagin · cuenta"
        autoComplete="off"
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">Tipo</span>
          <SelectMenu
            label="Tipo"
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({ value: k, label: ACCOUNT_KIND_LABEL[k] }))}
          />
        </div>
        <AmountField
          label="Saldo inicial"
          valueCents={initial}
          onValueChange={setInitial}
          placeholder="0,00"
          hint={editing ? undefined : 'Lo que hay hoy en la cuenta.'}
        />
      </div>
      <div className="flex items-center gap-2.5 text-sm text-fg-muted">
        <Checkbox id="account-negative" checked={negative} onCheckedChange={setNegative} touch />
        <label htmlFor="account-negative">Empieza en negativo (descubierto)</label>
      </div>
      {kind === 'savings' ? (
        <AmountField
          label="Objetivo (opcional)"
          valueCents={goal}
          onValueChange={setGoal}
          placeholder="12.000,00"
        />
      ) : null}
      <SwatchPicker
        legend="Color"
        name="account-color"
        value={color}
        options={COLORS}
        onChange={setColor}
      />
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" disabled={saving}>
          {editing ? 'Guardar' : 'Crear cuenta'}
        </Button>
      </div>
    </form>
  )
}

/** Alta y edición de una categoría. */
function CategoryDialog({
  open,
  onOpenChange,
  editing,
  kind,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: FinanceCategory
  kind: CategoryKind
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState<FinanceColor>('gray')
  const [error, setError] = useState<string>()
  const [lastOpen, setLastOpen] = useState(false)
  // Al abrir, parte de la categoría que se edita (o de cero).
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setName(editing?.name ?? '')
      setColor(asColor(editing?.color ?? 'gray'))
      setError(undefined)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Ponle un nombre')
    const ok = editing
      ? await updateCategory(m, qc, editing, { name: clean, color })
      : await createCategory(m, qc, { name: clean, kind, color })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={
          editing
            ? `Editar «${editing.name}»`
            : kind === 'expense'
              ? 'Nueva categoría de gastos'
              : 'Nueva categoría de ingresos'
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Nombre"
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value)
              setError(undefined)
            }}
            error={error}
            autoComplete="off"
            autoFocus
          />
          <SwatchPicker
            legend="Color"
            name="category-color"
            value={color}
            options={COLORS}
            onChange={setColor}
          />
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="primary">
              {editing ? 'Guardar' : 'Crear categoría'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CategoryList({ kind, categories }: { kind: CategoryKind; categories: FinanceCategory[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; editing?: FinanceCategory }>({
    open: false,
  })
  const list = categories.filter((c) => c.kind === kind && !c.archivedAt)
  const title = kind === 'expense' ? 'Categorías de gastos' : 'Categorías de ingresos'
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={title}
        action={
          <Button size="sm" onClick={() => setDialog({ open: true })}>
            <Icon name="plus" />
            Nueva
          </Button>
        }
      />
      <ul className="flex flex-col pb-1.5">
        <SortableCategories list={list} onEdit={(c) => setDialog({ open: true, editing: c })} />
        {list.length === 0 ? (
          <li className="border-t border-border-subtle px-4 py-4 text-sm text-fg-subtle">
            Sin categorías: los movimientos irán «Sin categoría».
          </li>
        ) : null}
      </ul>
      <CategoryDialog
        open={dialog.open}
        editing={dialog.editing}
        kind={kind}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </Card>
  )
}

/** Vista «Cuentas»: las cuentas con su saldo (editar, archivar) y las categorías editables. */
export function Accounts({
  accounts,
  categories,
  onNewAccount,
  onEditAccount,
}: {
  accounts: AccountWithBalance[]
  categories: FinanceCategory[]
  onNewAccount: () => void
  onEditAccount: (a: AccountWithBalance) => void
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const open = accounts.filter((a) => !a.archivedAt)
  const total = open.reduce((s, a) => s + a.balance, 0)
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Cuentas"
          description={`Total ${amountText(total, 'none')}${total < 0 ? ' en negativo' : ''}`}
          action={
            <Button size="sm" variant="primary" onClick={onNewAccount}>
              <Icon name="plus" />
              Nueva cuenta
            </Button>
          }
        />
        <ul className="flex flex-col pb-1.5">
          {open.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 border-t border-border-subtle py-2 pr-2 pl-4"
            >
              <button
                type="button"
                onClick={() => onEditAccount(a)}
                aria-label={`Editar ${a.name}`}
                className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 text-left outline-none focus-visible:underline"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-raised text-xs font-semibold"
                  style={{ color: projectColor(a.color) }}
                >
                  {a.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-base">{a.name}</span>
                  <span className="truncate text-xs text-fg-subtle">{accountDetail(a)}</span>
                  {a.goal ? (
                    <ProgressBar
                      value={Math.max(0, Math.min(1, a.balance / a.goal))}
                      color={projectColor(a.color)}
                      label={`Progreso hacia el objetivo de ${a.name}`}
                      className="max-w-60"
                    />
                  ) : null}
                </span>
                <span
                  className={`font-mono text-base tabular ${a.balance < 0 ? 'text-danger' : ''}`}
                >
                  {a.balance < 0 ? amountText(a.balance) : amountText(a.balance, 'none')}
                </span>
              </button>
              <IconButton
                aria-label={`Archivar ${a.name}`}
                icon={<icons.archive />}
                onClick={() => archiveAccount(m, qc, a)}
                className="size-11 md:size-8"
              />
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CategoryList kind="expense" categories={categories} />
        <CategoryList kind="income" categories={categories} />
      </div>
    </div>
  )
}
