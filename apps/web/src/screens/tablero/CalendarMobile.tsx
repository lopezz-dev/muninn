import type { TaskWithColumn } from '@muninn/core'
import { Button, cn, DateField, Dialog, IconButton, icons, SheetContent } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { filterTasks } from '../../lib/board-filter'
import {
  dayLong,
  dayShort,
  isOverdue,
  monthGrid,
  monthTitle,
  quickDates,
  shiftMonth,
  tasksByDay,
  undatedTasks,
} from '../../lib/calendar'
import { useMuninn } from '../../lib/muninn'
import { completeTask, setDueDate } from '../../lib/task-actions'
import { useOnline } from '../../lib/use-online'
import { useShell } from '../../shell/shell-context'
import type { CalendarProps } from './BoardCalendar'
import { OverdueToggle } from './CalendarParts'
import { KIND_DOT } from './Column'
import { SwipeToComplete } from './SwipeToComplete'
import { CardBody, card } from './TaskCard'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const LONG_PRESS_MS = 500

/**
 * Mantener pulsado (con el dedo) abre «Cambiar fecha». El clic que llega al levantar el dedo no abre la tarea, y
 * moverse más de 10 px (scroll o deslizar para completar) lo cancela.
 */
function useLongPress(onLong: () => void, disabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const cancel = () => {
    clearTimeout(timer.current)
    start.current = null
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false
      if (disabled || e.pointerType !== 'touch') return
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(10)
        onLong()
      }, LONG_PRESS_MS)
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // Android abre su menú contextual con la pulsación larga.
    onContextMenu: (e: React.MouseEvent) => {
      if (!disabled) e.preventDefault()
    },
    onClick: (e: React.MouseEvent) => {
      if (fired.current) e.preventDefault()
      fired.current = false
    },
  }
}

/** Tarea del día: la tarjeta del tablero (desliza para completar, mantén pulsado para cambiar la fecha). */
function DayTask({
  task,
  today,
  projectId,
  progress,
  canWrite,
  onDate,
}: {
  task: TaskWithColumn
  today: string
  projectId: string
  progress?: { done: number; total: number }
  canWrite: boolean
  onDate: () => void
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const press = useLongPress(onDate, !canWrite)
  return (
    <SwipeToComplete
      disabled={!canWrite}
      onComplete={() => {
        if (task.column.kind !== 'done') void completeTask(m, qc, task)
      }}
    >
      <div className="flex items-stretch gap-2">
        <Link
          to="/proyectos/$projectId/tareas/$taskId"
          params={{ projectId, taskId: task.id }}
          data-task-id={task.id}
          draggable={false}
          {...press}
          className={cn(
            card,
            'min-w-0 flex-1 touch-pan-y gap-2.5 p-3.5 select-none [-webkit-touch-callout:none]',
          )}
        >
          <CardBody task={task} progress={progress} today={today} />
        </Link>
        {canWrite ? (
          <IconButton
            aria-label={`Cambiar la fecha de «${task.title}»`}
            icon={<icons.calendar size={18} />}
            variant="secondary"
            size="lg"
            className="h-auto min-h-11"
            onClick={onDate}
          />
        ) : null}
      </div>
    </SwipeToComplete>
  )
}

/** Hoja «Cambiar fecha»: atajos, el selector del sistema (ADR-0049) y «Quitar fecha». */
function DateSheet({
  task,
  today,
  onClose,
}: {
  task: TaskWithColumn | null
  today: string
  onClose: () => void
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const pick = (date: string | null) => {
    if (task) void setDueDate(m, qc, task, date)
    onClose()
  }
  return (
    <Dialog open={task !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent side="bottom" title="Cambiar fecha">
        {task ? (
          <div className="flex flex-col gap-1 pb-2">
            <p className="mb-2 text-md text-fg-muted">
              {task.title}
              {task.dueDate ? ` · vence el ${dayShort(task.dueDate)}` : ' · sin fecha'}
            </p>
            {quickDates(today).map((q) => {
              const current = task.dueDate === q.date
              return (
                <button
                  key={q.label}
                  type="button"
                  aria-pressed={current}
                  onClick={() => pick(q.date)}
                  className={cn(
                    '-mx-3 flex h-14 cursor-pointer items-center gap-3.5 rounded-lg px-3 text-left text-md font-medium hover:bg-surface-hover',
                    current ? 'text-accent' : 'text-fg',
                  )}
                >
                  <icons.calendar
                    size={20}
                    aria-hidden="true"
                    className={current ? '' : 'text-fg-subtle'}
                  />
                  {q.label}
                  <span className="ml-auto text-sm font-normal text-fg-subtle">
                    {dayShort(q.date)}
                  </span>
                  {current ? <icons.check size={18} aria-label="Fecha actual" /> : null}
                </button>
              )
            })}
            <DateField
              label="Otra fecha"
              size="lg"
              value={task.dueDate ?? ''}
              today={today}
              onChange={(iso) => pick(iso || null)}
              className="mt-2"
            />
            {task.dueDate ? (
              <Button size="lg" className="mt-3" onClick={() => pick(null)}>
                Quitar fecha
              </Button>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Dialog>
  )
}

/**
 * Calendario del móvil (ADR-0068): mes compacto con puntos y, debajo, las tareas del día elegido. Sin arrastre:
 * la fecha se cambia con la hoja «Cambiar fecha» (mantener pulsado o el botón del calendario).
 */
export function CalendarMobile({ projectId, board, today, filter, onFilterChange }: CalendarProps) {
  const shell = useShell()
  const canWrite = useOnline()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [sel, setSel] = useState(today)
  const [dateTask, setDateTask] = useState<TaskWithColumn | null>(null)
  const [undatedOpen, setUndatedOpen] = useState(false)

  const visible = useMemo(
    () => filterTasks(board.tasks, filter, today),
    [board.tasks, filter, today],
  )
  const byDay = useMemo(() => tasksByDay(visible, board.columns), [visible, board.columns])
  const allByDay = useMemo(
    () => tasksByDay(board.tasks, board.columns),
    [board.tasks, board.columns],
  )
  const undated = useMemo(() => undatedTasks(visible), [visible])
  const overdue = useMemo(
    () => board.tasks.filter((t) => isOverdue(t, today)).length,
    [board.tasks, today],
  )
  const days = monthGrid(month)
  const list = byDay[sel] ?? []
  const total = allByDay[sel]?.length ?? 0

  const choose = (iso: string) => {
    setSel(iso)
    if (!iso.startsWith(month)) setMonth(iso.slice(0, 7))
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={monthTitle(month)} className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <h2 aria-live="polite" className="flex-1 text-lg font-semibold tracking-tight">
            {monthTitle(month)}
          </h2>
          <Button size="sm" className="h-9 rounded-full px-3.5" onClick={() => choose(today)}>
            Hoy
          </Button>
          <IconButton
            aria-label="Mes anterior"
            icon={<icons.chevronLeft size={18} />}
            size="lg"
            onClick={() => setMonth((mo) => shiftMonth(mo, -1))}
          />
          <IconButton
            aria-label="Mes siguiente"
            icon={<icons.chevronRight size={18} />}
            size="lg"
            onClick={() => setMonth((mo) => shiftMonth(mo, 1))}
          />
        </div>
        <div
          aria-hidden="true"
          className="grid grid-cols-7 text-center text-[11.5px] font-semibold tracking-wider text-fg-subtle"
        >
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((iso) => {
            const tasks = byDay[iso] ?? []
            const isToday = iso === today
            const selected = iso === sel
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={selected}
                aria-label={`${dayLong(iso)}${tasks.length ? `, ${tasks.length === 1 ? '1 tarea' : `${tasks.length} tareas`}` : ''}`}
                onClick={() => choose(iso)}
                className={cn(
                  'flex h-[46px] cursor-pointer flex-col items-center gap-1 rounded-lg pt-1 text-sm tabular transition-colors',
                  selected
                    ? isToday
                      ? 'bg-accent font-bold text-accent-fg'
                      : 'bg-surface-hover font-bold text-fg'
                    : isToday
                      ? 'font-bold text-accent'
                      : iso.startsWith(month)
                        ? 'font-medium text-fg'
                        : 'font-medium text-fg-subtle',
                )}
              >
                {Number(iso.slice(8))}
                <span className="flex h-[5px] gap-[3px]">
                  {tasks.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={cn(
                        'size-[5px] rounded-full',
                        selected && isToday
                          ? 'bg-accent-fg'
                          : isOverdue(t, today)
                            ? 'bg-danger'
                            : KIND_DOT[t.column.kind],
                      )}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setUndatedOpen(true)}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium whitespace-nowrap text-fg-muted"
        >
          <icons.calendar size={15} aria-hidden="true" />
          Sin fecha · {undated.length}
        </button>
        <OverdueToggle count={overdue} filter={filter} onFilterChange={onFilterChange} touch />
      </div>

      <section aria-label={dayLong(sel)} className="flex flex-col gap-3">
        <h3 className="flex items-baseline gap-2 text-md font-semibold">
          {dayLong(sel)}
          {sel === today ? ' · Hoy' : ''}
          <span className="text-sm font-normal text-fg-subtle">
            {list.length === 0 ? '' : list.length === 1 ? '1 tarea' : `${list.length} tareas`}
          </span>
        </h3>
        {list.map((t) => (
          <DayTask
            key={t.id}
            task={t}
            today={today}
            projectId={projectId}
            progress={board.counts[t.id]}
            canWrite={canWrite}
            onDate={() => setDateTask(t)}
          />
        ))}
        {list.length === 0 ? (
          <p className="text-sm text-fg-faint">
            {board.tasks.length === 0
              ? 'Este proyecto aún no tiene tareas. Crea la primera con fecha desde aquí.'
              : total > 0
                ? 'Ninguna tarea de este día cumple el filtro.'
                : 'Nada para este día.'}
          </p>
        ) : null}
        {canWrite ? (
          <button
            type="button"
            onClick={() => shell.openNewTask({ projectId, dueDate: sel })}
            className="flex h-13 cursor-pointer items-center gap-2.5 rounded-md border border-dashed border-border-strong px-4 text-md font-medium text-fg-muted"
          >
            <icons.plus size={18} aria-hidden="true" />
            Añadir el {dayShort(sel)}
          </button>
        ) : null}
        {list.length > 0 && canWrite ? (
          <p className="text-center text-xs text-fg-subtle">
            Mantén pulsado para cambiar la fecha · desliza a la izquierda para completar
          </p>
        ) : null}
      </section>

      <Dialog open={undatedOpen} onOpenChange={setUndatedOpen}>
        <SheetContent
          side="bottom"
          title={`Sin fecha · ${undated.length}`}
          footer={
            canWrite ? (
              <Button
                size="lg"
                className="flex-1"
                onClick={() => {
                  setUndatedOpen(false)
                  shell.openNewTask({ projectId })
                }}
              >
                <icons.plus size={16} aria-hidden="true" />
                Añadir sin fecha
              </Button>
            ) : undefined
          }
        >
          <ul className="flex flex-col gap-2 pb-2">
            {undated.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised py-2 pr-2 pl-3.5"
              >
                <span
                  aria-hidden="true"
                  className={cn('size-2 shrink-0 rounded-xs', KIND_DOT[t.column.kind])}
                />
                <Link
                  to="/proyectos/$projectId/tareas/$taskId"
                  params={{ projectId, taskId: t.id }}
                  onClick={() => setUndatedOpen(false)}
                  className="min-w-0 flex-1 text-md text-fg no-underline"
                >
                  {t.title}
                </Link>
                {canWrite ? (
                  <Button
                    size="lg"
                    aria-label={`Poner fecha a «${t.title}»`}
                    onClick={() => {
                      setUndatedOpen(false)
                      setDateTask(t)
                    }}
                  >
                    <icons.calendar size={16} aria-hidden="true" />
                    Fecha
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {undated.length === 0 ? (
            <p className="text-sm text-fg-faint">Todas las tareas tienen fecha.</p>
          ) : null}
        </SheetContent>
      </Dialog>

      <DateSheet task={dateTask} today={today} onClose={() => setDateTask(null)} />
    </div>
  )
}
