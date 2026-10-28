import type { AccountWithBalance, FinanceCategory, Transaction } from '@muninn/core'
import { Card, cn, IconButton, icons, projectColor } from '@muninn/ui'
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
import { useIsDesktop } from '../../lib/use-media'
import { activeTxFilters, MovementFilterSheet, TX_KINDS } from './MovementFilters'
import { TransactionRow } from './TransactionRows'

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
  const desktop = useIsDesktop()
  const [sheet, setSheet] = useState(false)

  const count = list.data ? `${shown.length} movimiento${shown.length === 1 ? '' : 's'}` : ''
  const lists = activeTxFilters(filter)
  const search = (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-2.5 text-fg-subtle focus-within:border-accent md:h-8 md:w-56 md:flex-none">
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
  )

  return (
    // lg: la tarjeta llena el alto de la rejilla y solo la lista de días hace scroll (ADR-0050).
    <Card
      aria-label="Movimientos"
      className="flex min-w-0 flex-col overflow-hidden lg:max-h-full lg:self-stretch"
    >
      {desktop ? null : (
        // Móvil: una línea (búsqueda + filtrar); los filtros de lista van en una hoja.
        <div className="flex flex-col gap-2 border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            {search}
            <IconButton
              aria-label={lists ? `Filtrar (${lists} activos)` : 'Filtrar'}
              icon={<icons.filter />}
              variant="secondary"
              onClick={() => setSheet(true)}
              className={cn('relative size-11', lists > 0 && 'text-accent')}
            />
          </div>
          <p role="status" className="flex items-center gap-2 text-xs text-fg-subtle">
            {count}
            {lists ? (
              <button
                type="button"
                onClick={() => setFilter((f) => ({ ...NO_TX_FILTER, query: f.query }))}
                className="ml-auto h-7 cursor-pointer px-1 text-sm font-medium text-accent"
              >
                Quitar filtros
              </button>
            ) : null}
          </p>
          <MovementFilterSheet
            open={sheet}
            onOpenChange={setSheet}
            filter={filter}
            onChange={setFilter}
            accounts={accounts}
            categories={categories}
            shown={shown.length}
          />
        </div>
      )}
      <div
        className={cn(
          'flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-3',
          desktop ? 'flex' : 'hidden',
        )}
      >
        {search}
        <SelectMenu
          label="Tipo"
          value={filter.kind ?? ''}
          onChange={(v) => setFilter((f) => ({ ...f, kind: (v || null) as EntryKind | null }))}
          options={[
            { value: '', label: 'Todos los tipos' },
            ...TX_KINDS.map((k) => ({ value: k, label: ENTRY_LABEL[k] })),
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
        <span className="ml-auto text-xs text-fg-subtle">{count}</span>
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
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {groups.map((g) => (
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
          ))}
        </div>
      )}
    </Card>
  )
}
