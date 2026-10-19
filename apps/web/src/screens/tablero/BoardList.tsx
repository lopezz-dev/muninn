import type { BoardColumn, TaskWithColumn } from '@muninn/core'
import { Checkbox, cn, icons } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { DueDate, LabelChips, PriorityFlag, SourceBadge } from '../../components/task-meta'
import { type BoardData, groupByColumn } from '../../lib/board'
import { type BoardFilter, filterTasks } from '../../lib/board-filter'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { completeTask, reopenTask } from '../../lib/task-actions'
import { ColumnCount, KIND_DOT } from './Column'
import { QuickAdd } from './QuickAdd'
import type { Progress } from './TaskCard'

interface RowProps {
  task: TaskWithColumn
  progress?: Progress
  today: string
  projectId: string
}

/** Fila de la lista: casilla para completar o reabrir, título (enlace al detalle) y sus datos. */
function TaskRow({ task, progress, today, projectId }: RowProps) {
  const m = useMuninn()
  const qc = useQueryClient()
  const done = task.column.kind === 'done'
  const subtasks = progress && progress.total > 0 ? progress : null
  const meta = (
    <>
      <LabelChips labels={task.labels} max={2} />
      {subtasks ? (
        <span className="tabular">
          {subtasks.done}/{subtasks.total}
        </span>
      ) : null}
      {done && task.completedAt ? (
        <span>Hecha {timeAgo(task.completedAt)}</span>
      ) : task.dueDate ? (
        <DueDate due={task.dueDate} today={today} done={done} />
      ) : null}
      <SourceBadge source={task.source} />
    </>
  )
  return (
    <li className="flex items-center gap-3 border-t border-border-subtle px-3 py-2.5 first:border-t-0 hover:bg-surface-hover/60 md:px-4">
      <Checkbox
        checked={done}
        // Las dos acciones son optimistas y avisan con «Deshacer» (ADR-0025).
        onCheckedChange={() => void (done ? reopenTask(m, qc, task) : completeTask(m, qc, task))}
        aria-label={`${done ? 'Reabrir' : 'Completar'}: ${task.title}`}
        touch
        size="lg"
        className="md:size-4 md:rounded-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          to="/proyectos/$projectId/tareas/$taskId"
          params={{ projectId, taskId: task.id }}
          data-task-id={task.id}
          className={cn(
            'truncate rounded-xs text-md outline-none focus-visible:outline-2 focus-visible:outline-accent md:text-base',
            done ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {task.title}
        </Link>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-subtle empty:hidden md:hidden">
          {meta}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-2.5 text-xs text-fg-subtle md:flex">
        {meta}
      </span>
      {done ? null : <PriorityFlag priority={task.priority} className="shrink-0" />}
    </li>
  )
}

interface GroupProps {
  column: BoardColumn
  /** Tareas que pasan el filtro, en el orden del tablero. */
  tasks: TaskWithColumn[]
  /** Tareas de la columna entera. */
  total: number
  filtering: boolean
  counts: BoardData['counts']
  today: string
  projectId: string
}

/** Un grupo de la lista: las tareas de una columna, plegable y con «Añadir tarea» al pie. */
function Group({ column, tasks, total, filtering, counts, today, projectId }: GroupProps) {
  const [open, setOpen] = useState(true)
  const listId = `lista-${column.id}`
  return (
    <section
      aria-label={column.name}
      className="flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-sunken"
    >
      <h2 className="flex">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 text-left text-[13px] font-semibold outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:h-10 md:px-4"
        >
          <icons.chevronDown
            size={12}
            aria-hidden="true"
            className={cn('shrink-0 text-fg-subtle transition-transform', !open && '-rotate-90')}
          />
          <span
            aria-hidden="true"
            className={cn('size-2 shrink-0 rounded-xs', KIND_DOT[column.kind])}
          />
          <span className="truncate">{column.name}</span>
          {filtering && tasks.length !== total ? (
            <span className="shrink-0 text-xs font-normal text-fg-subtle tabular">
              {tasks.length} de {total}
            </span>
          ) : (
            <ColumnCount count={total} limit={column.wipLimit} />
          )}
        </button>
      </h2>
      {open ? (
        <div id={listId} className="flex flex-col bg-surface">
          {tasks.length > 0 ? (
            <ul className="flex flex-col">
              {tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  progress={counts[t.id]}
                  today={today}
                  projectId={projectId}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-fg-faint">
              {total > 0 ? 'Ninguna tarea cumple el filtro.' : `Sin tareas en ${column.name}.`}
            </p>
          )}
          {column.kind === 'done' ? null : (
            <div className="border-t border-border-subtle px-1.5 py-1.5 md:px-2.5">
              <QuickAdd projectId={projectId} columnId={column.id} />
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Vista Lista del tablero: la misma consulta y los mismos filtros, agrupada por columna y sin arrastre.
 * Para mover una tarea a otra columna, se abre su detalle (o se completa con la casilla).
 */
export function BoardList({
  projectId,
  board,
  today,
  filter,
}: {
  projectId: string
  board: BoardData
  today: string
  filter: BoardFilter
}) {
  const visible = useMemo(
    () => filterTasks(board.tasks, filter, today),
    [board.tasks, filter, today],
  )
  const groups = useMemo(() => groupByColumn(board.columns, visible), [board.columns, visible])
  const totals = useMemo(() => groupByColumn(board.columns, board.tasks), [board])
  const filtering = visible !== board.tasks
  return (
    <div className="flex flex-col gap-3">
      {board.columns.map((c) => (
        <Group
          key={c.id}
          column={c}
          tasks={groups[c.id] ?? []}
          total={totals[c.id]?.length ?? 0}
          filtering={filtering}
          counts={board.counts}
          today={today}
          projectId={projectId}
        />
      ))}
    </div>
  )
}
