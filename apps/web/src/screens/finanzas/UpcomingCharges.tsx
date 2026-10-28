import type { Subscription } from '@muninn/core'
import { Button, Card, CardHeader, cn } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { amountText, chargeLabel } from '../../lib/finance'
import { upcomingChargesQuery } from '../../lib/finance-queries'
import { useMuninn } from '../../lib/muninn'
import { chargeSubscription, skipSubscription } from '../../lib/subscription-actions'

/*
 * Aparte del resto de suscripciones: Inicio solo carga esto (sin formularios, menús ni diálogos).
 */

const initial = (name: string) => name.trim().charAt(0).toUpperCase()

export function Logo({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-raised text-xs font-semibold"
    >
      {initial(name)}
    </span>
  )
}

export const tone = (s: Subscription, today: string) =>
  s.nextDate < today
    ? 'text-danger'
    : s.nextDate <= addOne(today)
      ? 'text-accent'
      : 'text-fg-subtle'

function addOne(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Cobros que hay que avisar (dentro de sus días de aviso, o vencidos), con «Apuntar» y «Saltar». Lo usan Inicio y
 * Finanzas › Resumen. No pinta nada si no hay ninguno.
 */
export function UpcomingCharges({ today, className }: { today: string; className?: string }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const upcoming = useQuery(upcomingChargesQuery(m)).data
  if (!upcoming?.length) return null
  return (
    <Card aria-label="Próximos cobros" className={cn('flex flex-col', className)}>
      <CardHeader
        title="Próximos cobros"
        description="Muninn no apunta nada solo: confirma cada cobro o sáltalo."
      />
      <ul className="flex flex-col pb-1.5">
        {upcoming.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-subtle px-4 py-2.5"
          >
            <Logo name={s.name} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base">{s.name}</span>
              <span className={cn('text-xs', tone(s, today))}>{chargeLabel(s, today)}</span>
            </span>
            <span className="font-mono text-base tabular">{amountText(s.amount, 'none')}</span>
            <span className="flex gap-1.5">
              <Button size="sm" variant="primary" onClick={() => chargeSubscription(m, qc, s)}>
                Apuntar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => skipSubscription(m, qc, s)}>
                Saltar
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
