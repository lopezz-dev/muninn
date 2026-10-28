import { cn, icons, screenIcons } from '@muninn/ui'
import type { DocStatus } from '../../lib/docs'

const LOOK: Partial<
  Record<DocStatus, { label: string; className: string; icon: typeof icons.clock }>
> = {
  parcial: {
    label: 'Parcial',
    className: 'bg-accent-soft text-accent',
    icon: screenIcons.partial,
  },
  proximamente: {
    label: 'Próximamente',
    className: 'border border-dashed border-border-strong bg-surface-raised text-fg-muted',
    icon: icons.clock,
  },
}

/**
 * «Parcial» (círculo a medias) o «Próximamente» (reloj) junto a una guía; las disponibles no llevan marca.
 * Con `compact`, solo el icono (con su nombre para lectores de pantalla).
 */
export function StatusBadge({
  status,
  compact,
  className,
}: {
  status: DocStatus
  compact?: boolean
  className?: string
}) {
  const look = LOOK[status]
  if (!look) return null
  const { icon: Glyph } = look
  if (compact) {
    return (
      <span
        title={look.label}
        className={cn(status === 'parcial' ? 'text-accent' : 'text-fg-faint', className)}
      >
        <Glyph size={12} aria-hidden="true" />
        <span className="sr-only">{look.label}</span>
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs px-1.5 py-px text-2xs font-semibold tracking-wide whitespace-nowrap uppercase',
        look.className,
        className,
      )}
    >
      <Glyph size={10} aria-hidden="true" />
      {look.label}
    </span>
  )
}
