import { cn } from '@muninn/ui'

/**
 * Marca provisional (el logo definitivo está en el backlog). Sigue al color de acento.
 * `mark`: solo el cuervo, en el color del texto, para ponerlo sobre un fondo de acento (botón del Asistente).
 */
export function Logo({
  className,
  variant = 'tile',
  size = 26,
}: {
  className?: string
  variant?: 'tile' | 'mark'
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      aria-hidden="true"
      className={cn(className)}
    >
      {variant === 'tile' ? <rect width="26" height="26" rx="5" className="fill-accent" /> : null}
      <path
        d="M6 17.5 11.5 8.5l8 1.6-3.6 2.6 3.6 4.8z"
        className={variant === 'tile' ? 'fill-accent-fg' : 'fill-current'}
      />
      {/* El ojo es un hueco del color del fondo, que en las dos variantes es el acento. */}
      <circle cx="13.6" cy="11.4" r="1.3" className="fill-accent" />
    </svg>
  )
}
