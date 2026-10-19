import type { TaskPriority, TaskSource } from '@muninn/core'
import { Chip, cn, Icon, icons } from '@muninn/ui'
import { priorityLabel } from '../lib/board'
import { type DueTone, dueLabel, dueTone } from '../lib/dates'

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

/** Quién creó la tarea, si no fuiste tú. */
export function SourceBadge({ source, className }: { source: TaskSource; className?: string }) {
  if (source === 'manual') return null
  const [icon, label] =
    source === 'github'
      ? (['github', 'GitHub'] as const)
      : source === 'mcp'
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
