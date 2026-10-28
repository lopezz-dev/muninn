import type { TaskPriority, TaskSource } from '@muninn/core'
import { Chip, cn, Icon, icons } from '@muninn/ui'
import { priorityLabel } from '../lib/board'
import { type DueTone, dueLabel, dueTone } from '../lib/dates'
import { externalLink } from '../lib/external-link'

/** Piezas pequeñas de una tarea que comparten Inicio, el tablero y el detalle. */

export const PRIORITY_TEXT: Record<TaskPriority, string> = {
  none: 'text-fg-subtle',
  low: 'text-fg-subtle',
  medium: 'text-fg-muted',
  high: 'text-accent',
  urgent: 'text-danger',
}

/** Bandera con el nombre de la prioridad. No pinta nada si no hay prioridad. */
export function PriorityFlag({
  priority,
  className,
}: {
  priority: TaskPriority
  className?: string
}) {
  if (priority === 'none') return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        PRIORITY_TEXT[priority],
        className,
      )}
    >
      <icons.flag size={13} aria-hidden="true" />
      {priorityLabel(priority)}
    </span>
  )
}

const DUE_TEXT: Record<DueTone, string> = {
  overdue: 'text-danger',
  today: 'text-accent',
  soon: 'text-fg-muted',
  later: 'text-fg-subtle',
}

/** Fecha de vencimiento con el color de su urgencia. Hecha: sin urgencia. */
export function DueDate({
  due,
  today,
  done,
  className,
}: {
  due: string
  today: string
  done?: boolean
  className?: string
}) {
  const tone = done ? 'later' : dueTone(due, today)
  return (
    <span className={cn('inline-flex items-center gap-1', DUE_TEXT[tone], className)}>
      <icons.calendar size={13} aria-hidden="true" />
      {dueLabel(due, today)}
    </span>
  )
}

/** Número de la issue de un `external_id` de GitHub (`owner/repo#123` → 123). */
export const issueNumber = (externalId: string | null) => {
  const m = externalId ? /#(\d+)$/.exec(externalId) : null
  return m ? Number(m[1]) : null
}

interface SourceBadgeProps {
  source: TaskSource
  externalId?: string | null
  externalUrl?: string | null
  /**
   * Con `link`, la insignia de GitHub es un enlace a la issue. En las tarjetas del tablero no: la tarjeta
   * entera ya es un enlace y no se pueden anidar.
   */
  link?: boolean
  className?: string
}

/** Quién creó la tarea, si no fuiste tú. Las de GitHub llevan su número de issue. */
export function SourceBadge({
  source,
  externalId,
  externalUrl,
  link,
  className,
}: SourceBadgeProps) {
  if (source === 'manual') return null
  if (source === 'github') {
    const n = issueNumber(externalId ?? null)
    const body = (
      <>
        <Icon name="github" size={13} />
        GitHub
        {n ? <span className="font-mono tabular">#{n}</span> : null}
      </>
    )
    return link && externalUrl ? (
      <a
        {...externalLink(externalUrl)}
        href={externalUrl}
        aria-label={n ? `Abrir la issue #${n} en GitHub` : 'Abrir la issue en GitHub'}
        className={cn(
          'inline-flex items-center gap-1 rounded-xs transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
          className,
        )}
      >
        {body}
        <icons.external size={11} aria-hidden="true" />
      </a>
    ) : (
      <span className={cn('inline-flex items-center gap-1', className)}>{body}</span>
    )
  }
  const [icon, label] =
    source === 'mcp'
      ? (['assistant', 'Creada por Claude'] as const)
      : (['branch', 'Agente'] as const)
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Icon name={icon} size={13} />
      {label}
    </span>
  )
}

export function LabelChips({ labels, max = 3 }: { labels: string[]; max?: number }) {
  if (labels.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1.5">
      {labels.slice(0, max).map((l) => (
        <Chip key={l} className="h-5 px-1.5 text-[11.5px]">
          {l}
        </Chip>
      ))}
      {labels.length > max ? (
        <Chip className="h-5 px-1.5 text-[11.5px]">+{labels.length - max}</Chip>
      ) : null}
    </span>
  )
}
