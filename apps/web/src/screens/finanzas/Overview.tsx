import type { AccountWithBalance, FinanceCategory, Transaction } from '@muninn/core'
import { Card, CardHeader, projectColor } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Ghost } from '../../components/Page'
import { dueLabel } from '../../lib/dates'
import { amountText, ENTRY_LABEL, entryKindOf } from '../../lib/finance'
import { recentTransactionsQuery } from '../../lib/finance-queries'
import { useMuninn } from '../../lib/muninn'
import { accountDetail } from './Accounts'
import { TransactionRow } from './TransactionRows'

interface Props {
  today: string
  accounts: AccountWithBalance[]
  accountById: Map<string, AccountWithBalance>
  categoryById: Map<string, FinanceCategory>
  onOpen: (tx: Transaction) => void
  onAllMovements: () => void
  onAccounts: () => void
  /** Lo que va encima (el panel del mes, las suscripciones). */
  children?: ReactNode
}

/** Vista «Resumen»: cuentas con su saldo y los últimos movimientos. */
export function Overview({
  today,
  accounts,
  accountById,
  categoryById,
  onOpen,
  onAllMovements,
  onAccounts,
  children,
}: Props) {
  const m = useMuninn()
  const recent = useQuery(recentTransactionsQuery(m))
  const open = accounts.filter((a) => !a.archivedAt)
  const total = open.reduce((s, a) => s + a.balance, 0)
  const link = 'cursor-pointer text-sm text-accent hover:text-accent-hover'

  return (
    <div className="flex flex-col gap-4">
      {children}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader
            title="Cuentas"
            description={`Total ${total < 0 ? amountText(total) : amountText(total, 'none')}`}
            action={
              <button type="button" className={link} onClick={onAccounts}>
                Gestionar
              </button>
            }
          />
          <ul className="flex flex-col pb-1.5">
            {open.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 border-t border-border-subtle px-4 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-raised text-xs font-semibold"
                  style={{ color: projectColor(a.color) }}
                >
                  {a.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base">{a.name}</span>
                  <span className="truncate text-xs text-fg-subtle">{accountDetail(a)}</span>
                </span>
                <span
                  className={`font-mono text-base tabular ${a.balance < 0 ? 'text-danger' : ''}`}
                >
                  {a.balance < 0 ? amountText(a.balance) : amountText(a.balance, 'none')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col overflow-hidden">
          <CardHeader
            title="Últimos movimientos"
            action={
              <button type="button" className={link} onClick={onAllMovements}>
                Ver todos
              </button>
            }
          />
          {recent.isPending ? (
            <div className="flex flex-col gap-2 px-4 pb-4" aria-hidden="true">
              <Ghost className="h-10" />
              <Ghost className="h-10 opacity-50" />
            </div>
          ) : recent.data?.length ? (
            <div className="flex flex-col pb-1">
              {recent.data.map((t) => {
                const cat = t.categoryId ? categoryById.get(t.categoryId) : undefined
                return (
                  <TransactionRow
                    key={t.id}
                    tx={t}
                    accountById={accountById}
                    categoryById={categoryById}
                    compact
                    sub={`${dueLabel(t.date, today)} · ${cat?.name ?? ENTRY_LABEL[entryKindOf(t, accountById)]}`}
                    onOpen={onOpen}
                  />
                )
              })}
            </div>
          ) : (
            <p className="border-t border-border-subtle px-4 py-6 text-sm text-fg-subtle">
              Aún no hay movimientos. Apunta el primero con «Movimiento».
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
