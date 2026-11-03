import type { AccountWithBalance, FinanceCategory } from '@muninn/core'
import { Button, Dialog, projectColor, SheetContent } from '@muninn/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterChip } from '../../components/FilterChip'
import { type EntryKind, entryLabel, NO_TX_FILTER, type TxFilter } from '../../lib/finance'

export const TX_KINDS: EntryKind[] = ['expense', 'income', 'saving', 'investment', 'transfer']

/** Cuántos filtros de lista (tipo, categoría, cuenta) hay puestos; la búsqueda va aparte. */
export const activeTxFilters = (f: TxFilter) =>
  Number(f.kind !== null) + Number(f.categoryId !== null) + Number(f.accountId !== null)

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-2.5 text-xs font-semibold tracking-wider text-fg-subtle uppercase">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

/**
 * Filtros de Movimientos en el móvil: una hoja desde abajo con chips grandes (como la del tablero), para que
 * en la pantalla solo quede una línea con la búsqueda y el botón de filtrar. Cada grupo elige uno o «Todos».
 */
export function MovementFilterSheet({
  open,
  onOpenChange,
  filter,
  onChange,
  accounts,
  categories,
  shown,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  filter: TxFilter
  onChange: (f: TxFilter) => void
  accounts: AccountWithBalance[]
  categories: FinanceCategory[]
  shown: number
}) {
  const { t } = useTranslation('finance')
  const set = (patch: Partial<TxFilter>) => onChange({ ...filter, ...patch })
  const expense = categories.filter((c) => !c.archivedAt && c.kind === 'expense')
  const income = categories.filter((c) => !c.archivedAt && c.kind === 'income')
  const category = (c: FinanceCategory) => (
    <FilterChip
      key={c.id}
      touch
      dot={projectColor(c.color)}
      pressed={filter.categoryId === c.id}
      onClick={() => set({ categoryId: filter.categoryId === c.id ? null : c.id })}
    >
      {c.name}
    </FilterChip>
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        title={t('movements.sheetTitle')}
        footer={
          <>
            <Button
              size="lg"
              className="flex-1"
              disabled={activeTxFilters(filter) === 0}
              onClick={() => onChange({ ...NO_TX_FILTER, query: filter.query })}
            >
              {t('movements.clearFilters')}
            </Button>
            <Button
              size="lg"
              variant="primary"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              {t('movements.show', { count: shown })}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5 pb-2">
          <Group label={t('type')}>
            <FilterChip touch pressed={filter.kind === null} onClick={() => set({ kind: null })}>
              {t('movements.all')}
            </FilterChip>
            {TX_KINDS.map((k) => (
              <FilterChip
                key={k}
                touch
                pressed={filter.kind === k}
                onClick={() => set({ kind: filter.kind === k ? null : k })}
              >
                {entryLabel(k)}
              </FilterChip>
            ))}
          </Group>
          {expense.length ? (
            <Group label={t('categories.expenseTitle')}>{expense.map(category)}</Group>
          ) : null}
          {income.length ? (
            <Group label={t('categories.incomeTitle')}>{income.map(category)}</Group>
          ) : null}
          <Group label={t('account')}>
            <FilterChip
              touch
              pressed={filter.accountId === null}
              onClick={() => set({ accountId: null })}
            >
              {t('movements.allFem')}
            </FilterChip>
            {accounts
              .filter((a) => !a.archivedAt)
              .map((a) => (
                <FilterChip
                  key={a.id}
                  touch
                  dot={projectColor(a.color)}
                  pressed={filter.accountId === a.id}
                  onClick={() => set({ accountId: filter.accountId === a.id ? null : a.id })}
                >
                  {a.name}
                </FilterChip>
              ))}
          </Group>
        </div>
      </SheetContent>
    </Dialog>
  )
}
