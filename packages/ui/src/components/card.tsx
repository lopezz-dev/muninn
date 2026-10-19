import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../cn'

/** Superficie base. Respeta el modo cristal. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass rounded-lg border border-border', className)} {...props} />
}

export interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Acción a la derecha (enlace «Ver todo», botón…). */
  action?: ReactNode
  /** Nivel del título para mantener la jerarquía de la página. */
  as?: 'h2' | 'h3'
  className?: string
}

export function CardHeader({
  title,
  description,
  action,
  as: H = 'h2',
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('flex items-start gap-3 px-4 pt-3.5 pb-2.5', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <H className="text-md font-semibold">{title}</H>
        {description ? <p className="text-xs text-fg-subtle">{description}</p> : null}
      </div>
      {action ? <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}
