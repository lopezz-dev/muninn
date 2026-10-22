import type { AccountWithBalance, FinanceCategory, Transaction } from '@muninn/core'
import { Card, icons, projectColor } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Ghost } from '../../components/Page'
import { SelectMenu } from '../../components/SelectMenu'
import {
  amountText,
  dayLabel,
  ENTRY_LABEL,
  type EntryKind,
  filterTransactions,
  groupByDay,
  isFilteringTx,
  NO_TX_FILTER,
  type TxFilter,
} from '../../lib/finance'
import { monthTransactionsQuery } from '../../lib/finance-queries'
import { useMuninn } from '../../lib/muninn'
import { TransactionRow } from './TransactionRows'

const KINDS: EntryKind[] = ['expense', 'income', 'saving', 'investment', 'transfer']

interface Props {
  month: string
  today: string
  accounts: AccountWithBalance[]
  categories: FinanceCategory[]
  accountById: Map<string, AccountWithBalance>
  categoryById: Map<string, FinanceCategory>
  onOpen: (tx: Transaction) => void
}

/** Movimientos de un mes, agrupados por día, con búsqueda y filtros de tipo, categoría y cuenta. */
export function Movements({
  month,
  today,
  accounts,
  categories,
  accountById,
  categoryById,
  onOpen,
}: Props) {
  const m = useMuninn()
  const list = useQuery(monthTransactionsQuery(m, month))
  const [filter, setFilter] = useState<TxFilter>(NO_TX_FILTER)
  const shown = useMemo(
    () => (list.data ? filterTransactions(list.data, filter, accountById) : []),
    [list.data, filter, accountById],
  )
  const groups = useMemo(() => groupByDay(shown, filter.accountId), [shown, filter.accountId])
  const filtering = isFilteringTx(filter)

  return (
    <Card aria-label="Movimientos" className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-3">
        <label className="flex h-9 w-full items-center gap-2 rounded-md border border-border px-2.5 text-fg-subtle focus-within:border-accent sm:w-56 md:h-8">
          <icons.search size={14} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar concepto"
            placeholder="Buscar concepto"
            value={filter.query}
            onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-faint"
          />
        </label>
        <SelectMenu
          label="Tipo"
          value={filter.kind ?? ''}
          onChange={(v) => setFilter((f) => ({ ...f, kind: (v || null) as EntryKind | null }))}
          options={[
            { value: '', label: 'Todos los tipos' },
            ...KINDS.map((k) => ({ value: k, label: ENTRY_LABEL[k] })),
          ]}
          className="h-8 text-[12.5px]"
        />
        <SelectMenu
          label="Categoría"
          value={filter.categoryId ?? ''}
          onChange={(v) => setFilter((f) => ({ ...f, categoryId: v || null }))}
          options={[
            { value: '', label: 'Todas las categorías' },
            ...categories
              .filter((c) => !c.archivedAt)
              .map((c) => ({
                value: c.id,
                label: c.name,
                dot: projectColor(c.color),
                hint: c.kind === 'income' ? 'ingreso' : undefined,
              })),
          ]}
          className="h-8 text-[12.5px]"
        />
        <SelectMenu
          label="Cuenta"
          value={filter.accountId ?? ''}
          onChange={(v) => setFilter((f) => ({ ...f, accountId: v || null }))}
          options={[
            { value: '', label: 'Todas las cuentas' },
            ...accounts
              .filter((a) => !a.archivedAt)
              .map((a) => ({ value: a.id, label: a.name, dot: projectColor(a.color) })),
          ]}
          className="h-8 text-[12.5px]"
        />
        <span className="ml-auto text-xs text-fg-subtle">
          {list.data ? `${shown.length} movimiento${shown.length === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-2 p-4" aria-hidden="true">
          <Ghost className="h-10" />
          <Ghost className="h-10 opacity-60" />
          <Ghost className="h-10 opacity-30" />
        </div>
      ) : list.isError ? (
        <p className="px-4 py-8 text-center text-sm text-danger">
          No se pudieron cargar los movimientos.
        </p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-fg-subtle text-pretty">
          {filtering ? 'Nada coincide con estos filtros. ' : 'No hay movimientos este mes.'}
          {filtering ? (
            <button
              type="button"
              onClick={() => setFilter(NO_TX_FILTER)}
              className="cursor-pointer text-accent hover:underline"
            >
              Quitar filtros
            </button>
          ) : null}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.date} aria-label={dayLabel(g.date, today)}>
            <h3 className="flex px-4 pt-3.5 pb-1.5 text-xs font-semibold text-fg-subtle">
              {dayLabel(g.date, today)}
              <span className="ml-auto font-mono font-medium tabular">
                {g.total !== 0
                  ? amountText(g.total)
                  : g.moved
                    ? `${amountText(g.moved, 'none')} movidos`
                    : ''}
              </span>
            </h3>
            {g.items.map((t) => (
              <TransactionRow
                key={t.id}
                tx={t}
                accountById={accountById}
                categoryById={categoryById}
                accountId={filter.accountId}
                onOpen={onOpen}
              />
            ))}
          </section>
        ))
      )}
    </Card>
  )
}
