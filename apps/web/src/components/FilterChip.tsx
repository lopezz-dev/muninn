import { ColorDot, cn } from '@muninn/ui'
import type { ReactNode } from 'react'

interface FilterChipProps {
  pressed: boolean
  onClick: () => void
  /** Cuadradito de color (proyecto). */
  dot?: string
  /** 36 px, con borde: móvil. */
  touch?: boolean
  children: ReactNode
  className?: string
}

/** Chip de filtro: un botón de dos estados (`aria-pressed`), como en las listas de Notas y del tablero. */
export function FilterChip({ pressed, onClick, dot, touch, children, className }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-accent',
        touch ? 'h-9 rounded-md border px-3 text-[13.5px]' : 'h-[22px] rounded-sm px-2 text-xs',
        pressed
          ? cn('text-fg', touch ? 'border-border-strong bg-surface-raised' : 'bg-fg/[0.12]')
          : cn(
              'text-fg-muted hover:text-fg',
              touch ? 'border-border bg-transparent' : 'bg-surface-raised hover:bg-fg/[0.08]',
            ),
        className,
      )}
    >
      {dot ? <ColorDot color={dot} /> : null}
      {children}
    </button>
  )
}
