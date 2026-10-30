import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TaskWithColumn } from '@muninn/core'
import { cn, ProgressBar } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { memo } from 'react'
import { DueDate, LabelChips, PriorityFlag, SourceBadge } from '../../components/task-meta'
import { timeAgo } from '../../lib/dates'

export interface Progress {
  done: number
  total: number
}

interface CardBodyProps {
  task: TaskWithColumn
  progress?: Progress
  today: string
}

/**
 * Lo que se ve dentro de una tarjeta: etiquetas, título, progreso y datos. Diseño: Tablero.dc.html. Memorizada: al
 * arrastrar, cada movimiento repinta las columnas, pero las tarjetas que no cambian conservan sus props (la caché del
 * tablero reutiliza los objetos de las tareas intactas) y no se vuelven a pintar.
 */
export const CardBody = memo(function CardBody({ task, progress, today }: CardBodyProps) {
  const done = task.column.kind === 'done'
  const subtasks = progress && progress.total > 0 ? progress : null
  // Sin nada que mostrar, la fila de datos no existe: la tarjeta no lleva un hueco vacío abajo.
  const hasMeta =
    (done ? Boolean(task.completedAt) : Boolean(task.dueDate) || task.priority !== 'none') ||
    subtasks !== null ||
    task.source !== 'manual'
  return (
    <>
      <LabelChips labels={task.labels} />
      <span className={cn('text-base leading-snug break-words', done && 'text-fg-muted')}>
        {task.title}
      </span>
      {subtasks ? (
        <ProgressBar
          value={subtasks.done / subtasks.total}
          label={`Subtareas de «${task.title}»`}
          className="h-[3px]"
        />
      ) : null}
      {hasMeta ? (
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-subtle">
          {done && task.completedAt ? (
            <span>Hecha {timeAgo(task.completedAt)}</span>
          ) : task.dueDate ? (
            <DueDate due={task.dueDate} today={today} />
          ) : null}
          {subtasks ? (
            <span className="tabular">
              {subtasks.done}/{subtasks.total}
            </span>
          ) : null}
          <SourceBadge source={task.source} externalId={task.externalId} />
          {done ? null : <PriorityFlag priority={task.priority} className="ml-auto" />}
        </span>
      ) : null}
    </>
  )
})

export const card =
  'flex flex-col gap-2 rounded-md border border-border bg-surface-raised px-3 py-2.5 text-fg no-underline outline-none transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent'

interface TaskCardProps extends CardBodyProps {
  projectId: string
  /** En móvil las tarjetas son más grandes (zona táctil). */
  large?: boolean
}

/**
 * Tarjeta del tablero: enlace al detalle y, a la vez, elemento ordenable. Enter abre la tarea y
 * Espacio la recoge para moverla con las flechas (ver `dnd.ts`).
 */
export function SortableTaskCard({ task, progress, today, projectId, large }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'card' },
    attributes: { role: 'link', roleDescription: 'tarjeta ordenable', tabIndex: 0 },
  })
  return (
    <Link
      ref={setNodeRef}
      to="/proyectos/$projectId/tareas/$taskId"
      params={{ projectId, taskId: task.id }}
      data-task-id={task.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        card,
        large && 'gap-2.5 p-3.5',
        // El scroll vertical es del navegador; en móvil, el gesto horizontal es de la tarjeta (deslizar).
        large ? 'touch-pan-y' : 'touch-manipulation',
        isDragging && 'opacity-30',
      )}
      draggable={false}
      {...attributes}
      {...listeners}
    >
      <CardBody task={task} progress={progress} today={today} />
    </Link>
  )
}

/** Copia que sigue al puntero mientras se arrastra (`DragOverlay`): sin enlace, inclinada y con sombra. */
export function TaskCardOverlay({
  task,
  progress,
  today,
  large,
}: Omit<TaskCardProps, 'projectId'>) {
  return (
    <div
      className={cn(
        card,
        large && 'gap-2.5 p-3.5',
        'rotate-[-2deg] cursor-grabbing border-accent shadow-drag',
      )}
    >
      <CardBody task={task} progress={progress} today={today} />
    </div>
  )
}
