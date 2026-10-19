import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BoardColumn, TaskWithColumn } from '@muninn/core'
import { cn, IconButton, icons, Tooltip } from '@muninn/ui'
import { colKey } from '../../lib/board'
import { useShell } from '../../shell/shell-context'
import { ColumnMenu } from './ColumnMenu'
import { QuickAdd } from './QuickAdd'
import { type Progress, SortableTaskCard } from './TaskCard'

export const KIND_DOT = {
  backlog: 'bg-kind-backlog',
  todo: 'bg-kind-todo',
  in_progress: 'bg-kind-in-progress',
  review: 'bg-kind-review',
  done: 'bg-kind-done',
} as const

/**
 * «3» o «3 / 3» si hay límite. Al alcanzarlo se pinta en ámbar y al superarlo en rojo (sin chip: la
 * cabecera mide 264 px y el nombre de la columna necesita sitio). El límite avisa, no impide.
 */
export function ColumnCount({ count, limit }: { count: number; limit: number | null }) {
  const over = limit !== null && count > limit
  const full = limit !== null && count === limit
  return (
    <span
      title={over ? 'Límite superado' : full ? 'Límite alcanzado' : undefined}
      className={cn(
        'shrink-0 text-xs whitespace-nowrap tabular',
        over ? 'font-semibold text-danger' : full ? 'font-semibold text-accent' : 'text-fg-subtle',
      )}
    >
      {limit ? `${count} / ${limit}` : count}
      {over || full ? (
        <span className="sr-only"> {over ? 'límite superado' : 'límite alcanzado'}</span>
      ) : null}
    </span>
  )
}

interface ColumnProps {
  column: BoardColumn
  columns: BoardColumn[]
  /** Tareas de la columna, en el orden que se está pintando (puede ser el de un arrastre en curso). */
  tasks: TaskWithColumn[]
  /** Cuántas tareas tiene la columna entera (`tasks` puede ser solo las que pasan el filtro). */
  total?: number
  counts: Record<string, Progress>
  today: string
  projectId: string
  onEdit: (column: BoardColumn) => void
}

/** Columna del tablero de escritorio: ordenable (por su asa) y receptora de tarjetas. */
export function Column({
  column,
  columns,
  tasks,
  total = tasks.length,
  counts,
  today,
  projectId,
  onEdit,
}: ColumnProps) {
  const shell = useShell()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: colKey(column.id),
    data: { type: 'column', hasCards: tasks.length > 0 },
    attributes: { roleDescription: 'columna ordenable' },
  })

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      data-column-id={column.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex w-[280px] shrink-0 flex-col gap-2 rounded-lg border border-border-subtle bg-surface-sunken p-2',
        isDragging && 'opacity-30',
      )}
    >
      <header className="flex h-8 items-center gap-1.5 px-1 text-sm font-semibold">
        <Tooltip content="Arrastra para mover la columna">
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Mover la columna ${column.name}`}
            className="grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-fg-faint outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            {...attributes}
            {...listeners}
          >
            <icons.grip size={14} />
          </button>
        </Tooltip>
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-xs', KIND_DOT[column.kind])}
        />
        <h2 className="min-w-0 truncate" title={column.name}>
          {column.name}
        </h2>
        <ColumnCount count={total} limit={column.wipLimit} />
        <span className="ml-auto flex items-center">
          {column.kind === 'done' ? null : (
            <IconButton
              aria-label={`Añadir tarea en ${column.name}`}
              icon={<icons.plus size={16} />}
              size="sm"
              onClick={() => shell.openNewTask({ projectId, columnId: column.id })}
            />
          )}
          <ColumnMenu column={column} columns={columns} taskCount={total} onEdit={onEdit} />
        </span>
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-10 flex-col gap-2">
          {tasks.length === 0 ? (
            <p className="grid min-h-16 place-items-center rounded-md border border-dashed border-border-strong px-4 text-center text-xs text-fg-faint">
              {total > 0 ? 'Ninguna tarea cumple el filtro.' : 'Sin tareas. Arrastra una aquí.'}
            </p>
          ) : null}
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              progress={counts[t.id]}
              today={today}
              projectId={projectId}
            />
          ))}
        </div>
      </SortableContext>

      {column.kind === 'done' ? null : <QuickAdd projectId={projectId} columnId={column.id} />}
    </section>
  )
}

/** Copia de una columna que sigue al puntero cuando se arrastra entera: solo la cabecera. */
export function ColumnOverlay({ column, count }: { column: BoardColumn; count: number }) {
  return (
    <div className="flex h-12 w-[280px] rotate-[-1.5deg] items-center gap-2 rounded-lg border border-accent bg-surface-raised px-3 text-sm font-semibold shadow-drag">
      <span aria-hidden="true" className={cn('size-2 rounded-xs', KIND_DOT[column.kind])} />
      {column.name}
      <ColumnCount count={count} limit={column.wipLimit} />
    </div>
  )
}
