import { cn } from '@muninn/ui'
import type { DocStatus } from '../../lib/docs'

const LABEL: Partial<Record<DocStatus, string>> = {
  parcial: 'Parcial',
  proximamente: 'Próximamente',
}

/** «Parcial» o «Próximamente» junto a una guía; las disponibles no llevan marca. */
export function StatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  const label = LABEL[status]
  if (!label) return null
  return (
    <span
      className={cn(
        'rounded-xs bg-accent-soft px-1.5 py-px text-2xs font-semibold tracking-wide whitespace-nowrap text-accent uppercase',
        className,
      )}
    >
      {label}
    </span>
  )
}
