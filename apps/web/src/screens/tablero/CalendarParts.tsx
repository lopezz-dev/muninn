import { useDndContext, useDraggable } from '@dnd-kit/core'
import type { BoardColumn, TaskWithColumn } from '@muninn/core'
import {
  Button,
  Chip,
  cn,
  DatePicker,
  Icon,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ProgressBar,
  TextField,
  Tooltip,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type FormEvent, type ReactNode, useState } from 'react'
import { PRIORITY_TEXT } from '../../components/task-meta'
import { useAgentColumn } from '../../lib/agent'
import { priorityLabel } from '../../lib/board'
import { type BoardFilter, toggle } from '../../lib/board-filter'
import { dayShort, isOverdue } from '../../lib/calendar'
import { useMuninn } from '../../lib/muninn'
import { createTask } from '../../lib/task-actions'
import { useShell } from '../../shell/shell-context'
import { ColumnDot } from './Column'
import { CardBody, type Progress } from './TaskCard'

/** Lo que dnd-kit necesita de una tarea arrastrable del calendario: enlace al detalle y asa a la vez. */
function useTaskDrag(task: TaskWithColumn, disabled: boolean) {
  return useDraggable({
    id: task.id,
    disabled,
    // Enter abre la tarea (es un enlace); Espacio la recoge para moverla con las flechas.
    attributes: { role: 'link', roleDescription: 'tarea arrastrable', tabIndex: 0 },
  })
}

/**
 * Píldora de una tarea en una celda del mes: color de su columna, título y bandera de prioridad. Vencida, en
 * rojo; hecha, tachada con su ✓. Al pasar el ratón (o con foco) enseña la tarjeta completa.
 */
export function TaskPill({
  task,
  today,
  projectId,
  progress,
  disabled,
  row,
}: {
  task: TaskWithColumn
  today: string
  projectId: string
  progress?: Progress
  disabled: boolean
  /** Fila del desplegable «+N más»: más alta y sin tarjeta flotante. */
  row?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useTaskDrag(task, disabled)
  const dragging = useDndContext().active !== null
  const done = task.column.kind === 'done'
  const overdue = isOverdue(task, today)
  const flag = !done && task.priority !== 'none' && task.priority !== 'low'
  const pill = (
    <Link
      ref={setNodeRef}
      to="/proyectos/$projectId/tareas/$taskId"
      params={{ projectId, taskId: task.id }}
      data-task-id={task.id}
      draggable={false}
      {...attributes}
      {...listeners}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-sm border border-border bg-surface-raised px-1.5 text-xs no-underline outline-none transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent',
        row ? 'h-8 text-sm' : 'h-[22px]',
        done ? 'text-fg-subtle' : overdue ? 'text-danger' : 'text-fg',
        !disabled && 'touch-manipulation',
        isDragging && 'opacity-30',
      )}
    >
      {done ? (
        <icons.check size={12} weight="bold" className="shrink-0 text-success" aria-label="Hecha" />
      ) : (
        <ColumnDot column={task.column} />
      )}
      <span className={cn('min-w-0 flex-1 truncate', done && 'line-through')}>{task.title}</span>
      {overdue ? <span className="sr-only">(vencida)</span> : null}
      {flag ? (
        <icons.flag
          size={12}
          className={cn('shrink-0', PRIORITY_TEXT[task.priority])}
          aria-label={`Prioridad ${priorityLabel(task.priority).toLowerCase()}`}
        />
      ) : null}
    </Link>
  )
  if (row) return pill
  return (
    <Tooltip
      side="right"
      disabled={dragging}
      content={
        <span className="flex w-60 flex-col gap-2 py-1 text-sm">
          <CardBody task={task} progress={progress} today={today} />
        </span>
      }
    >
      {pill}
    </Tooltip>
  )
}

/**
 * Lo que se ve de una tarea en el calendario fuera del mes: hasta dos etiquetas, el título, las subtareas y una línea
 * con su columna (en el calendario es lo que no se ve), «Vencida» si toca y la bandera si es alta o urgente. Sin la
 * fecha: ya la dice el día. `large`, para el móvil.
 */
export function CompactBody({
  task,
  today,
  progress,
  large,
}: {
  task: TaskWithColumn
  today: string
  progress?: Progress
  large?: boolean
}) {
  const done = task.column.kind === 'done'
  const overdue = isOverdue(task, today)
  const flag = !done && (task.priority === 'high' || task.priority === 'urgent')
  const subtasks = progress && progress.total > 0 ? progress : null
  return (
    <>
      {task.labels.length > 0 ? (
        <span className="flex min-w-0 flex-wrap gap-1">
          {task.labels.slice(0, 2).map((l) => (
            <Chip
              key={l}
              className={cn(
                'max-w-full truncate px-1.5',
                large ? 'h-5 text-[11.5px]' : 'h-[18px] text-[11px]',
              )}
            >
              {l}
            </Chip>
          ))}
          {task.labels.length > 2 ? (
            <Chip className={cn('px-1.5', large ? 'h-5 text-[11.5px]' : 'h-[18px] text-[11px]')}>
              +{task.labels.length - 2}
            </Chip>
          ) : null}
        </span>
      ) : null}
      <span
        className={cn(
          'line-clamp-3 leading-snug break-words',
          large ? 'text-md' : 'text-sm',
          done && 'text-fg-subtle line-through',
        )}
      >
        {task.title}
      </span>
      {subtasks ? (
        <ProgressBar
          value={subtasks.done / subtasks.total}
          label={`Subtareas de «${task.title}»`}
          className="h-[3px]"
        />
      ) : null}
      <span
        className={cn(
          'flex min-w-0 items-center gap-1.5 text-fg-subtle',
          large ? 'text-[13px]' : 'text-xs',
        )}
      >
        {done ? (
          <icons.check
            size={12}
            weight="bold"
            className="shrink-0 text-success"
            aria-hidden="true"
          />
        ) : (
          <ColumnDot column={task.column} />
        )}
        {overdue ? null : <span className="min-w-0 truncate">{task.column.name}</span>}
        {overdue ? (
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-danger">
            <icons.clock size={12} aria-hidden="true" />
            Vencida
          </span>
        ) : null}
        {subtasks ? (
          <span className="shrink-0 tabular">
            {subtasks.done}/{subtasks.total}
          </span>
        ) : null}
        {flag ? (
          <span
            className={cn(
              'ml-auto inline-flex shrink-0 items-center gap-1 font-medium',
              PRIORITY_TEXT[task.priority],
            )}
          >
            <icons.flag size={12} aria-hidden="true" />
            {large ? (
              priorityLabel(task.priority)
            ) : (
              <span className="sr-only">{`Prioridad ${priorityLabel(task.priority).toLowerCase()}`}</span>
            )}
          </span>
        ) : null}
      </span>
    </>
  )
}

/** Tarjeta compacta y arrastrable del calendario: la de la semana y la de la bandeja «Sin fecha». */
export function CompactCard({
  task,
  today,
  projectId,
  progress,
  disabled,
}: {
  task: TaskWithColumn
  today: string
  projectId: string
  progress?: Progress
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useTaskDrag(task, disabled)
  return (
    <Link
      ref={setNodeRef}
      to="/proyectos/$projectId/tareas/$taskId"
      params={{ projectId, taskId: task.id }}
      data-task-id={task.id}
      draggable={false}
      {...attributes}
      {...listeners}
      className={cn(
        'flex shrink-0 flex-col gap-1.5 rounded-md border border-border bg-surface-raised px-2.5 py-2 text-fg no-underline outline-none transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent touch-manipulation',
        isDragging && 'border-dashed opacity-30',
      )}
    >
      <CompactBody task={task} today={today} progress={progress} />
    </Link>
  )
}

/** Columna donde nace una tarea creada desde el calendario: la primera «Por hacer», como el core. */
export function defaultColumnOf(columns: BoardColumn[], agentColumnId: string | null) {
  const open = columns.filter((c) => c.kind !== 'done' && c.id !== agentColumnId)
  return open.find((c) => c.kind === 'todo') ?? open[0] ?? null
}

/**
 * «Añadir» en un día (o en «Sin fecha»): título, fecha ya puesta y columna. Enter crea y el campo sigue abierto
 * para la siguiente, como el «Añadir tarea» de una columna; «Más opciones…» abre el diálogo de Nueva tarea.
 */
export function AddTaskPopover({
  projectId,
  columns,
  date,
  today,
  open,
  onOpenChange,
  children,
}: {
  projectId: string
  columns: BoardColumn[]
  /** `null`: la tarea nace sin fecha. */
  date: string | null
  today: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** El botón que lo abre. */
  children: ReactNode
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const shell = useShell()
  const agent = useAgentColumn(projectId).columnId
  const choices = columns.filter((c) => c.kind !== 'done' && c.id !== agent)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(date ?? '')
  const [columnId, setColumnId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const column =
    choices.find((c) => c.id === columnId) ?? defaultColumnOf(columns, agent) ?? undefined

  const change = (next: boolean) => {
    if (next) {
      setTitle('')
      setDue(date ?? '')
      setColumnId(undefined)
    }
    onOpenChange(next)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = title.trim()
    if (!clean || busy) return
    setBusy(true)
    const task = await createTask(m, qc, {
      projectId,
      columnId: column?.id,
      title: clean,
      dueDate: due || null,
    })
    setBusy(false)
    if (task) setTitle('')
  }

  const label = date ? `Nueva tarea el ${dayShort(date)}` : 'Nueva tarea sin fecha'
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" aria-label={label}>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <TextField
            label="Título de la nueva tarea"
            hideLabel
            placeholder="Título de la tarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            autoComplete="off"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            <DatePicker value={due} onChange={setDue} clearable today={today}>
              <Button type="button" size="sm" className={cn(due && 'text-accent')}>
                <Icon name="calendar" size={13} />
                {due ? dayShort(due) : 'Sin fecha'}
              </Button>
            </DatePicker>
            {choices.length > 1 ? (
              <Menu>
                <MenuTrigger asChild>
                  <Button type="button" size="sm" aria-label={`Columna: ${column?.name ?? ''}`}>
                    {column ? <ColumnDot column={column} /> : null}
                    {column?.name}
                    <icons.chevronDown size={11} aria-hidden="true" />
                  </Button>
                </MenuTrigger>
                <MenuContent align="start">
                  {choices.map((c) => (
                    <MenuItem key={c.id} onSelect={() => setColumnId(c.id)}>
                      <span className="flex items-center gap-2">
                        <ColumnDot column={c} />
                        {c.name}
                      </span>
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-fg-subtle">
            Enter crea · Esc cierra
            <button
              type="button"
              className="ml-auto cursor-pointer font-medium text-accent hover:underline"
              onClick={() => {
                change(false)
                shell.openNewTask({
                  projectId,
                  columnId: column?.id,
                  title: title.trim() || undefined,
                  dueDate: due || undefined,
                })
              }}
            >
              Más opciones…
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/** «N vencidas»: un atajo al filtro «Vence: Vencidas» de la barra de filtros. */
export function OverdueToggle({
  count,
  filter,
  onFilterChange,
  touch,
}: {
  count: number
  filter: BoardFilter
  onFilterChange: (next: BoardFilter) => void
  touch?: boolean
}) {
  if (count === 0) return null
  const on = filter.due.includes('overdue')
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onFilterChange({ ...filter, due: toggle(filter.due, 'overdue') })}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 border font-medium whitespace-nowrap text-danger transition-colors',
        touch ? 'h-9 rounded-full px-3 text-sm' : 'h-7 rounded-md px-2.5 text-[12.5px]',
        on ? 'border-danger bg-danger-soft' : 'border-danger/35 hover:bg-danger-soft',
      )}
    >
      <icons.clock size={touch ? 15 : 13} aria-hidden="true" />
      {count === 1 ? '1 vencida' : `${count} vencidas`}
    </button>
  )
}
