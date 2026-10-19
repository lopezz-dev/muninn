import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../cn'
import { projectColor } from '../tokens'

/** Cuadradito de color de proyecto o categoría (`'blue'`, `'violet'`… o un hex). */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2 shrink-0 rounded-xs', className)}
      style={{ background: color.startsWith('#') ? color : projectColor(color) }}
    />
  )
}

export const chipVariants = cva(
  'inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-raised text-fg-muted',
        outline: 'border border-border-strong text-fg-muted',
        accent: 'border border-accent/35 text-accent',
        danger: 'bg-danger-soft text-danger',
        success: 'bg-success-soft text-success',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface ChipProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {
  /** Color del cuadradito a la izquierda (proyecto, categoría). */
  dot?: string
  icon?: ReactNode
}

export function Chip({ variant, dot, icon, className, children, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ variant }), className)} {...props}>
      {dot ? <ColorDot color={dot} /> : null}
      {icon}
      {children}
    </span>
  )
}

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] items-center whitespace-nowrap rounded-xs border border-border-strong px-1.5 font-mono text-2xs text-fg-subtle',
        className,
      )}
      {...props}
    />
  )
}

const avatarSizes = { sm: 'size-6 text-2xs', md: 'size-7 text-xs', lg: 'size-12 text-md' } as const

/** Avatar cuadrado con iniciales (radio pequeño, coherente con el resto). */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: keyof typeof avatarSizes
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-md bg-border-strong font-semibold text-fg',
        avatarSizes[size],
        className,
      )}
    >
      {initials}
    </span>
  )
}

export interface ProgressBarProps {
  /** 0–1 */
  value: number
  color?: string
  label: string
  className?: string
}

export function ProgressBar({ value, color, label, className }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-1 overflow-hidden rounded-full bg-border', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', !color && 'bg-accent')}
        style={{
          width: `${pct}%`,
          ...(color ? { background: color.startsWith('#') ? color : projectColor(color) } : {}),
        }}
      />
    </div>
  )
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return (
    <hr
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn(
        'shrink-0 border-0 bg-border-subtle',
        vertical ? 'mx-0 h-full w-px' : 'my-0 h-px w-full',
        className,
      )}
    />
  )
}
