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
  formatAmount,
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
import { useTranslation } from 'react-i18next'
import { SelectMenu } from '../../components/SelectMenu'
import { type Swatch, SwatchPicker } from '../../components/SwatchPicker'
import { intlLocale, t as tr } from '../../i18n'
import { ACCOUNT_KINDS, accountKindLabel, amountText, percentText } from '../../lib/finance'
import {
  archiveAccount,
  createAccount,
  createCategory,
  updateAccount,
  updateCategory,
} from '../../lib/finance-actions'
import { useMuninn } from '../../lib/muninn'
import { SortableCategories } from './SortableCategories'

const COLOR_IDS: FinanceColor[] = ['blue', 'violet', 'teal', 'pink', 'green', 'amber', 'gray']

/** Colores con su nombre como *getter*: se lee al pintar, en el idioma activo (ADR-0077). */
export const COLORS: Swatch<FinanceColor>[] = COLOR_IDS.map((value) => ({
  value,
  color: palette[value],
  get label() {
    return tr(`colors.${value}`, { ns: 'finance' })
  },
}))

const asColor = (c: string): FinanceColor =>
  COLORS.some((s) => s.value === c) ? (c as FinanceColor) : 'gray'

/** Línea secundaria de una cuenta: el tipo, o el objetivo de una hucha con su progreso. */
export function accountDetail(a: AccountWithBalance) {
  if (a.goal) {
    const pct = Math.max(0, Math.min(100, Math.round((a.balance / a.goal) * 100)))
    return tr('accounts.goal', {
      ns: 'finance',
      amount: amountText(a.goal, 'none'),
      pct: percentText(pct / 100),
    })
  }
  return accountKindLabel(a.kind)
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
  const { t } = useTranslation('finance')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? t('editQuoted', { name: editing.name }) : t('accounts.dialogNew')}
        description={editing ? t('accounts.descEdit') : t('accounts.descNew')}
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
  const { t } = useTranslation('finance')
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
    if (!clean) return setError(t('accounts.nameRequired'))
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
        label={t('name')}
        value={name}
        maxLength={80}
        onChange={(e) => {
          setName(e.target.value)
          setError(undefined)
        }}
        error={error}
        placeholder={t('accounts.namePlaceholder')}
        autoComplete="off"
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">{t('type')}</span>
          <SelectMenu
            label={t('type')}
            value={kind}
            onChange={setKind}
            options={ACCOUNT_KINDS.map((k) => ({ value: k, label: accountKindLabel(k) }))}
          />
        </div>
        <AmountField
          locale={intlLocale()}
          label={t('accounts.initialBalance')}
          valueCents={initial}
          onValueChange={setInitial}
          placeholder={formatAmount(0, intlLocale())}
          hint={editing ? undefined : t('accounts.initialHint')}
        />
      </div>
      <div className="flex items-center gap-2.5 text-sm text-fg-muted">
        <Checkbox id="account-negative" checked={negative} onCheckedChange={setNegative} touch />
        <label htmlFor="account-negative">{t('accounts.negative')}</label>
      </div>
      {kind === 'savings' ? (
        <AmountField
          locale={intlLocale()}
          label={t('accounts.goalOptional')}
          valueCents={goal}
          onValueChange={setGoal}
          placeholder={formatAmount(1_200_000, intlLocale())}
        />
      ) : null}
      <SwatchPicker
        legend={t('color')}
        name="account-color"
        value={color}
        options={COLORS}
        onChange={setColor}
      />
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">{t('cancel')}</Button>
        </DialogClose>
        <Button type="submit" variant="primary" disabled={saving}>
          {editing ? t('save') : t('accounts.create')}
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
  const { t } = useTranslation('finance')
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
    if (!clean) return setError(t('nameIt'))
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
            ? t('editQuoted', { name: editing.name })
            : kind === 'expense'
              ? t('categories.newExpense')
              : t('categories.newIncome')
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField
            label={t('name')}
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
            legend={t('color')}
            name="category-color"
            value={color}
            options={COLORS}
            onChange={setColor}
          />
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="ghost">{t('cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant="primary">
              {editing ? t('save') : t('categories.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CategoryList({ kind, categories }: { kind: CategoryKind; categories: FinanceCategory[] }) {
  const { t } = useTranslation('finance')
  const [dialog, setDialog] = useState<{ open: boolean; editing?: FinanceCategory }>({
    open: false,
  })
  const list = categories.filter((c) => c.kind === kind && !c.archivedAt)
  const title = kind === 'expense' ? t('categories.expenseTitle') : t('categories.incomeTitle')
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={title}
        action={
          <Button size="sm" onClick={() => setDialog({ open: true })}>
            <Icon name="plus" />
            {t('new')}
          </Button>
        }
      />
      <ul className="flex flex-col pb-1.5">
        <SortableCategories list={list} onEdit={(c) => setDialog({ open: true, editing: c })} />
        {list.length === 0 ? (
          <li className="border-t border-border-subtle px-4 py-4 text-sm text-fg-subtle">
            {t('categories.empty')}
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
  const { t } = useTranslation('finance')
  const m = useMuninn()
  const qc = useQueryClient()
  const open = accounts.filter((a) => !a.archivedAt)
  const total = open.reduce((s, a) => s + a.balance, 0)
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title={t('accounts.title')}
          description={t(total < 0 ? 'accounts.totalNegative' : 'accounts.total', {
            amount: amountText(total, 'none'),
          })}
          action={
            <Button size="sm" variant="primary" onClick={onNewAccount}>
              <Icon name="plus" />
              {t('accounts.newAccount')}
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
                aria-label={t('edit', { name: a.name })}
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
                      label={t('accounts.goalProgress', { name: a.name })}
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
                aria-label={t('archive', { name: a.name })}
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
