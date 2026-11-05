import { cn, icons, screenIcons } from '@muninn/ui'
import { useTranslation } from 'react-i18next'
import type { DocStatus } from '../../lib/docs'

/** Cómo se ve cada marca; su nombre sale de `status.<estado>`, en el idioma activo. */
const LOOK: Partial<Record<DocStatus, { className: string; icon: typeof icons.clock }>> = {
  parcial: {
    className: 'bg-accent-soft text-accent',
    icon: screenIcons.partial,
  },
  proximamente: {
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
  const { t } = useTranslation('docs')
  const look = LOOK[status]
  if (!look || status === 'disponible') return null
  const { icon: Glyph } = look
  const label = t(`status.${status}`)
  if (compact) {
    return (
      <span
        title={label}
        className={cn(status === 'parcial' ? 'text-accent' : 'text-fg-faint', className)}
      >
        <Glyph size={12} aria-hidden="true" />
        <span className="sr-only">{label}</span>
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
      {label}
    </span>
  )
}
