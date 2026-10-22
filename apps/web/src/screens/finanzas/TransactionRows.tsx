import type { AccountWithBalance, FinanceCategory, Transaction } from '@muninn/core'
import { Chip, cn, Icon, projectColor } from '@muninn/ui'
import { amountText, ENTRY_LABEL, entryKindOf, signedAmount } from '../../lib/finance'

interface RowProps {
  tx: Transaction
  accountById: Map<string, AccountWithBalance>
  categoryById: Map<string, FinanceCategory>
  /** Con una cuenta filtrada, los traspasos llevan signo (sale o entra). */
  accountId?: string | null
  /** Texto pequeño bajo el concepto (móvil y «Últimos movimientos»): «Hoy · Supermercado». */
  sub?: string
  /** Dos columnas también en escritorio (tarjeta «Últimos movimientos»). */
  compact?: boolean
  onOpen: (tx: Transaction) => void
}

const ENTRY_TONE = {
  income: 'text-success bg-success-soft',
  saving: 'text-project-blue bg-project-blue/12',
  investment: 'text-project-violet bg-project-violet/12',
  transfer: '',
  expense: '',
} as const

/**
 * Una fila de movimiento: concepto, categoría (o tipo), cuenta y el importe con su signo. Es un botón que
 * abre la edición.
 */
export function TransactionRow({
  tx,
  accountById,
  categoryById,
  accountId,
  sub,
  compact,
  onOpen,
}: RowProps) {
  const entry = entryKindOf(tx, accountById)
  const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined
  const from = accountById.get(tx.accountId)?.name ?? '?'
  const to = tx.toAccountId ? (accountById.get(tx.toAccountId)?.name ?? '?') : null
  const signed = signedAmount(tx, accountId)
  const concept = tx.concept.trim() || category?.name || ENTRY_LABEL[entry]
  const pending = tx.id.startsWith('tmp-')
  return (
    <button
      type="button"
      onClick={() => onOpen(tx)}
      disabled={pending}
      aria-label={`${concept}, ${amountText(signed || tx.amount, signed ? 'auto' : 'none')}. Editar`}
      className={cn(
        'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-t border-border-subtle px-4 py-2.5 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        !compact && 'md:grid-cols-[minmax(0,1fr)_150px_140px_120px] md:py-2',
        pending && 'cursor-default opacity-60',
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-md md:text-base">{concept}</span>
        <span className={cn('truncate text-xs text-fg-subtle', !compact && 'md:hidden')}>
          {sub ?? [category?.name ?? ENTRY_LABEL[entry], to ? `${from} → ${to}` : from].join(' · ')}
        </span>
      </span>
      <span className={cn('hidden', !compact && 'md:flex')}>
        {entry === 'expense' || (entry === 'income' && category) ? (
          category ? (
            <Chip dot={projectColor(category.color)} className="max-w-full truncate">
              {category.name}
            </Chip>
          ) : entry === 'income' ? (
            <Chip className={ENTRY_TONE.income}>Ingreso</Chip>
          ) : (
            <span className="text-xs text-fg-faint">Sin categoría</span>
          )
        ) : (
          <Chip
            className={ENTRY_TONE[entry]}
            icon={entry === 'transfer' ? <Icon name="move" /> : undefined}
          >
            {ENTRY_LABEL[entry]}
          </Chip>
        )}
      </span>
      <span className={cn('hidden truncate text-sm text-fg-subtle', !compact && 'md:block')}>
        {to ? `${from} → ${to}` : from}
      </span>
      <span
        className={cn(
          'row-span-2 text-right font-mono text-base tabular',
          !compact && 'md:row-span-1',
          signed > 0 && 'text-success',
        )}
      >
        {signed === 0 ? amountText(tx.amount, 'none') : amountText(signed)}
      </span>
    </button>
  )
}
