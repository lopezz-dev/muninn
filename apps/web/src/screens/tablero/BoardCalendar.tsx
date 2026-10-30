import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  pointerWithin,
  type ScreenReaderInstructions,
  useDroppable,
} from '@dnd-kit/core'
import type { TaskWithColumn } from '@muninn/core'
import {
  Button,
  cn,
  IconButton,
  icons,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BoardData } from '../../lib/board'
import { type BoardFilter, filterTasks, isFiltering } from '../../lib/board-filter'
import {
  type CalendarScale,
  cellSlots,
  dayKey,
  dayLong,
  dayOf,
  dayShort,
  isDayKey,
  isOverdue,
  keyboardTarget,
  monthGrid,
  monthName,
  monthTitle,
  NAV_NEXT,
  NAV_PREV,
  nextDueAfter,
  shiftMonth,
  tasksByDay,
  UNDATED,
  undatedTasks,
  visibleInCell,
  weekDays,
  weekTitle,
} from '../../lib/calendar'
import { addDays } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { setDueDate } from '../../lib/task-actions'
import { useOnline } from '../../lib/use-online'
import { useShell } from '../../shell/shell-context'
import { CalendarMobile } from './CalendarMobile'
import { AddTaskPopover, CompactCard, OverdueToggle, TaskPill } from './CalendarParts'
import { useBoardSensors } from './dnd'
import { TaskCardOverlay } from './TaskCard'

export interface CalendarProps {
  projectId: string
  board: BoardData
  today: string
  filter: BoardFilter
  onFilterChange: (next: BoardFilter) => void
  scale: CalendarScale
  onScaleChange: (next: CalendarScale) => void
}

const SCALES: { value: CalendarScale; label: string }[] = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
]

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Lo que tarda en cambiar de mes (o de semana) una tarea arrastrada que se queda sobre ‹ o ›. */
const NAV_HOVER_MS = 600

/**
 * Vista Calendario del tablero (ADR-0068): un chunk aparte, como la Lista. Escritorio con arrastre; en el
 * móvil, mes compacto y lista del día, sin arrastre (`CalendarMobile`).
 */
export function BoardCalendar(props: CalendarProps & { desktop: boolean }) {
  const { desktop, ...rest } = props
  return desktop ? <CalendarDesktop {...rest} /> : <CalendarMobile {...rest} />
}

/** Flecha de mes que, además, recibe tareas arrastradas: quedarse encima cambia de mes. */
function NavArrow({ id, label, onClick }: { id: string; label: string; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const Chevron = id === NAV_PREV ? icons.chevronLeft : icons.chevronRight
  return (
    <span ref={setNodeRef} className="flex">
      <IconButton
        aria-label={label}
        icon={<Chevron />}
        onClick={onClick}
        className={cn(isOver && 'bg-accent-soft text-accent')}
      />
    </span>
  )
}

interface DayProps {
  /** Plazas de la celda del mes (píldoras más «+N más»), según su alto: `cellSlots`. */
  slots?: number
  iso: string
  tasks: TaskWithColumn[]
  inMonth: boolean
  weekend: boolean
  today: string
  projectId: string
  board: BoardData
  canWrite: boolean
  adding: boolean
  onAdding: (open: boolean) => void
  more: boolean
  onMore: (open: boolean) => void
}

/** Celda del mes: número, hasta tres píldoras (o dos y «+N más») y crear al hacer clic en el hueco. */
function MonthCell({
  slots = 3,
  iso,
  tasks,
  inMonth,
  weekend,
  today,
  projectId,
  board,
  canWrite,
  adding,
  onAdding,
  more,
  onMore,
}: DayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(iso), disabled: !canWrite })
  const isToday = iso === today
  const { shown, more: hidden } = visibleInCell(tasks, slots)
  const label = `${dayLong(iso)}${tasks.length ? `, ${tasks.length === 1 ? '1 tarea' : `${tasks.length} tareas`}` : ''}`
  return (
    <li
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        'group relative flex min-h-0 min-w-0 flex-col gap-[3px] overflow-hidden border-t border-r border-border-subtle px-1.5 py-1',
        weekend ? 'bg-surface-sunken' : 'bg-surface',
        isToday && 'bg-accent-soft/40',
        isOver && 'bg-accent-soft outline-[1.5px] -outline-offset-2 outline-accent/60',
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className={cn(
            'grid size-5 place-items-center rounded-full text-xs tabular',
            isToday
              ? 'bg-accent font-bold text-accent-fg'
              : inMonth
                ? 'font-medium text-fg'
                : 'font-medium text-fg-subtle',
          )}
        >
          {Number(iso.slice(8))}
        </span>
        {isToday ? <span className="text-[11px] font-semibold text-accent">Hoy</span> : null}
        {canWrite ? (
          <AddTaskPopover
            projectId={projectId}
            columns={board.columns}
            date={iso}
            today={today}
            open={adding}
            onOpenChange={onAdding}
          >
            <IconButton
              aria-label={`Añadir tarea el ${dayShort(iso)}`}
              icon={<icons.plus size={13} />}
              size="sm"
              className="ml-auto size-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            />
          </AddTaskPopover>
        ) : null}
      </div>
      {shown.map((t) => (
        <TaskPill
          key={t.id}
          task={t}
          today={today}
          projectId={projectId}
          progress={board.counts[t.id]}
          disabled={!canWrite}
        />
      ))}
      {hidden > 0 ? (
        <Popover open={more} onOpenChange={onMore}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-5 shrink-0 cursor-pointer rounded-xs px-1.5 text-left text-[11.5px] font-medium text-fg-muted hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-hover"
            >
              +{hidden} más
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="flex w-80 flex-col gap-1"
            aria-label={dayLong(iso)}
          >
            <p className="flex items-baseline gap-2 border-b border-border-subtle px-2 pt-1 pb-2 text-sm font-semibold">
              {dayLong(iso)}
              <span className="text-xs font-normal text-fg-subtle">{tasks.length} tareas</span>
            </p>
            {tasks.map((t) => (
              <TaskPill
                key={t.id}
                task={t}
                today={today}
                projectId={projectId}
                disabled={!canWrite}
                row
              />
            ))}
            {canWrite ? (
              <button
                type="button"
                onClick={() => {
                  onMore(false)
                  onAdding(true)
                }}
                className="mt-1 flex h-8 cursor-pointer items-center gap-1.5 rounded-md border-t border-border-subtle px-2 text-sm font-medium text-fg-subtle hover:bg-surface-hover hover:text-fg"
              >
                <icons.plus size={14} aria-hidden="true" />
                Añadir tarea el {dayShort(iso)}
              </button>
            ) : null}
          </PopoverContent>
        </Popover>
      ) : null}
      {canWrite ? (
        // El hueco de la celda también crea: es un atajo de ratón; con teclado está el «+» de arriba.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => onAdding(true)}
          className="min-h-1 flex-1 cursor-pointer"
        />
      ) : null}
    </li>
  )
}

/** «Hoy», «Mañana» o «Ayer» junto al número del día en la semana. */
const relative = (iso: string, today: string) =>
  iso === today
    ? 'Hoy'
    : iso === addDays(today, 1)
      ? 'Mañana'
      : iso === addDays(today, -1)
        ? 'Ayer'
        : ''

/**
 * Columna de un día en la vista Semana: cabecera con el día, las tareas (`CompactCard`) y «Añadir» justo debajo de la
 * última. Un día vacío no dice nada: el hueco ya se entiende, y al arrastrar se ilumina entero.
 */
function WeekColumn({
  iso,
  tasks,
  total,
  weekend,
  today,
  projectId,
  board,
  canWrite,
  adding,
  onAdding,
}: Omit<DayProps, 'inMonth' | 'more' | 'onMore'> & { total: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(iso), disabled: !canWrite })
  const isToday = iso === today
  const rel = relative(iso, today)
  return (
    <section
      ref={setNodeRef}
      aria-label={`${dayLong(iso)}${total ? `, ${total === 1 ? '1 tarea' : `${total} tareas`}` : ''}`}
      className={cn(
        'group flex min-h-0 min-w-0 flex-col rounded-lg border transition-colors',
        isToday ? 'border-accent/35 bg-accent-soft/40' : 'border-border-subtle',
        !isToday && (weekend ? 'bg-surface-sunken' : 'bg-surface'),
        isOver && 'border-accent bg-accent-soft',
      )}
    >
      <h3 className="flex shrink-0 flex-col gap-0.5 border-b border-border-subtle px-2.5 pt-2 pb-2">
        <span
          className={cn(
            'text-[11.5px] font-semibold tracking-wider uppercase',
            isToday ? 'text-accent' : 'text-fg-subtle',
          )}
        >
          {WEEKDAYS[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]}
        </span>
        <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
          <span
            className={cn(
              'text-2xl font-semibold tracking-tight tabular',
              isToday && 'text-accent',
            )}
          >
            {Number(iso.slice(8))}
          </span>
          {rel ? (
            <span
              className={cn(
                'truncate text-xs font-medium',
                isToday ? 'text-accent' : 'text-fg-subtle',
              )}
            >
              {rel}
            </span>
          ) : null}
          {total > 0 ? (
            <span className="ml-auto text-xs text-fg-subtle tabular">
              {tasks.length === total ? total : `${tasks.length} de ${total}`}
            </span>
          ) : null}
        </span>
      </h3>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {tasks.map((t) => (
          <CompactCard
            key={t.id}
            task={t}
            today={today}
            projectId={projectId}
            progress={board.counts[t.id]}
            disabled={!canWrite}
          />
        ))}
        {tasks.length === 0 && total > 0 ? (
          <p className="px-1 py-1 text-xs text-fg-faint">Ninguna cumple el filtro.</p>
        ) : null}
        {canWrite ? (
          <AddTaskPopover
            projectId={projectId}
            columns={board.columns}
            date={iso}
            today={today}
            open={adding}
            onOpenChange={onAdding}
          >
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Añadir tarea el ${dayShort(iso)}`}
              className={cn(
                'shrink-0 justify-start px-1.5 text-fg-subtle',
                // En un día con tareas aparece al pasar por la columna; en uno vacío está siempre.
                tasks.length > 0 &&
                  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
              )}
            >
              <icons.plus size={14} aria-hidden="true" />
              Añadir
            </Button>
          </AddTaskPopover>
        ) : null}
      </div>
    </section>
  )
}

/** Bandeja plegada: un raíl estrecho que la vuelve a abrir y que también recibe tareas (quitar la fecha). */
function UndatedRail({
  count,
  dragging,
  canWrite,
  onOpen,
}: {
  count: number
  dragging: boolean
  canWrite: boolean
  onOpen: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNDATED, disabled: !canWrite })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      aria-label={`Abrir «Sin fecha» (${count})`}
      className={cn(
        'flex w-10 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-lg border bg-surface-sunken py-3 text-fg-subtle transition-colors hover:text-fg',
        isOver
          ? 'border-dashed border-accent bg-accent-soft text-accent'
          : dragging
            ? 'border-dashed border-border-strong'
            : 'border-border-subtle',
      )}
    >
      <icons.calendar size={15} aria-hidden="true" />
      <span className="text-xs font-semibold tabular">{count}</span>
      <span className="text-xs font-medium [writing-mode:vertical-rl]">
        {dragging ? 'Soltar para quitar la fecha' : 'Sin fecha'}
      </span>
    </button>
  )
}

/** Bandeja «Sin fecha»: sus tarjetas se arrastran a un día, y soltar aquí quita la fecha. */
function UndatedTray({
  tasks,
  dragging,
  today,
  projectId,
  board,
  canWrite,
  adding,
  onAdding,
  onClose,
}: {
  tasks: TaskWithColumn[]
  dragging: boolean
  today: string
  projectId: string
  board: BoardData
  canWrite: boolean
  adding: boolean
  onAdding: (open: boolean) => void
  onClose: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNDATED, disabled: !canWrite })
  return (
    <aside
      ref={setNodeRef}
      aria-label="Sin fecha"
      className={cn(
        'flex min-h-0 w-[248px] shrink-0 flex-col gap-2 rounded-lg border bg-surface-sunken p-2',
        isOver ? 'border-dashed border-accent bg-accent-soft' : 'border-border-subtle',
      )}
    >
      <h2 className="flex items-center gap-2 px-1.5 pt-1 text-[13px] font-semibold">
        Sin fecha
        <span className="text-xs font-normal text-fg-subtle tabular">{tasks.length}</span>
        <IconButton
          aria-label="Ocultar «Sin fecha»"
          icon={<icons.chevronRight size={14} />}
          size="sm"
          className="ml-auto"
          onClick={onClose}
        />
      </h2>
      <p className="px-1.5 text-xs text-fg-subtle">
        {!canWrite
          ? 'Sin conexión no se pueden cambiar las fechas.'
          : dragging
            ? 'Suelta aquí para quitarle la fecha.'
            : 'Arrastra una tarea a un día para ponerle fecha.'}
      </p>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {tasks.map((t) => (
          <CompactCard
            key={t.id}
            task={t}
            today={today}
            projectId={projectId}
            progress={board.counts[t.id]}
            disabled={!canWrite}
          />
        ))}
      </div>
      {canWrite ? (
        <AddTaskPopover
          projectId={projectId}
          columns={board.columns}
          date={null}
          today={today}
          open={adding}
          onOpenChange={onAdding}
        >
          <Button variant="ghost" size="sm" className="justify-start">
            <icons.plus size={14} aria-hidden="true" />
            Añadir sin fecha
          </Button>
        </AddTaskPopover>
      ) : null}
    </aside>
  )
}

/** Aviso flotante sobre la rejilla: proyecto vacío o nada en lo que se ve. */
function GridNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
      <div
        role="status"
        className="glass-raised pointer-events-auto flex max-w-sm flex-col items-center gap-2 rounded-lg border border-border-strong px-5 py-4 text-center shadow-popover"
      >
        <p className="text-md font-semibold">{title}</p>
        {children}
      </div>
    </div>
  )
}

const instructions: ScreenReaderInstructions = {
  draggable:
    'Para cambiar la fecha, pulsa Espacio, muévete con las flechas (izquierda y derecha, un día; arriba y abajo, una semana) o pulsa S para «Sin fecha», y vuelve a pulsar Espacio para soltar. Escape cancela. Enter abre la tarea.',
}

/** Calendario de escritorio: mes o semana, bandeja «Sin fecha» y arrastre con ratón, tacto o teclado. */
function CalendarDesktop({
  projectId,
  board,
  today,
  filter,
  onFilterChange,
  scale,
  onScaleChange,
}: CalendarProps) {
  const m = useMuninn()
  const qc = useQueryClient()
  const shell = useShell()
  const canWrite = useOnline()
  // El día que manda en lo que se ve: su mes o su semana. Siempre abre en hoy.
  const [anchor, setAnchor] = useState(today)
  // La bandeja empieza abierta en el mes y plegada en la semana, donde el ancho es para los días.
  // En el mes, mientras no se toque, se abre sola si hay algo dentro (vacía solo quita ancho a los días).
  const [trayByScale, setTrayByScale] = useState<Record<CalendarScale, boolean | null>>({
    month: null,
    week: false,
  })
  const [dragId, setDragId] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [moreDay, setMoreDay] = useState<string | null>(null)

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
  const taskById = useMemo(() => new Map(board.tasks.map((t) => [t.id, t])), [board.tasks])
  const trayOpen = trayByScale[scale] ?? undated.length > 0
  const setTrayOpen = (open: boolean | ((o: boolean) => boolean)) =>
    setTrayByScale((t) => ({ ...t, [scale]: typeof open === 'function' ? open(trayOpen) : open }))

  // Cuántas píldoras caben en una celda del mes: se mide el alto de las filas, no se supone.
  const [slots, setSlots] = useState(3)
  // Ref con limpieza (React 19): observa la rejilla mientras está montada (solo en el mes).
  const gridRef = useCallback((el: HTMLOListElement | null) => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setSlots(cellSlots(el.clientHeight / 6)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const month = anchor.slice(0, 7)
  const days = scale === 'month' ? monthGrid(month) : weekDays(anchor)
  const range = scale === 'month' ? days.filter((d) => d.startsWith(month)) : days
  const inRange = range.reduce((n, d) => n + (byDay[d]?.length ?? 0), 0)
  const shift = (n: number) =>
    setAnchor((a) => (scale === 'month' ? `${shiftMonth(a.slice(0, 7), n)}-01` : addDays(a, 7 * n)))
  const goToday = () => setAnchor(today)

  // Al cambiar de escala, se queda en hoy si hoy está en lo que se veía; si no, en el primer día.
  const changeScale = (next: CalendarScale) => {
    if (next === 'week' && !anchor.startsWith(today.slice(0, 7))) setAnchor(`${month}-01`)
    onScaleChange(next)
  }

  // Quedarse sobre ‹ o › con una tarea cogida cambia de mes (o de semana).
  const navTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const clearNav = () => clearTimeout(navTimer.current)
  useEffect(() => () => clearTimeout(navTimer.current), [])

  // Teclado: la tarea salta de día en día (o a la bandeja con S). La reserva, hoy o el primer día que se ve.
  // Con teclado, «dónde está» no lo decide la geometría (la tarjeta flotante es más ancha que una celda y
  // caería en el día de al lado): lo lleva `keyTarget`, que empieza en el día de la tarea.
  const fallback = useRef(today)
  fallback.current = days.includes(today) ? today : (range[0] ?? today)
  const keyTarget = useRef<string | null>(null)
  const keyboard = useMemo<KeyboardCoordinateGetter>(
    () =>
      (event, { context, currentCoordinates }) => {
        const over = keyTarget.current
        const target =
          event.code === 'KeyS'
            ? UNDATED
            : (() => {
                const d = keyboardTarget(
                  event.code,
                  isDayKey(over) ? dayOf(over) : null,
                  fallback.current,
                )
                return d ? dayKey(d) : null
              })()
        if (!target) return undefined
        event.preventDefault()
        const rect = context.droppableRects.get(target)
        const self = context.collisionRect
        // Fuera de lo que se ve (o bandeja cerrada): se queda donde está.
        if (!rect || !self) return currentCoordinates
        keyTarget.current = target
        return {
          x: rect.left + rect.width / 2 - self.width / 2,
          y: rect.top + Math.min(rect.height / 2, 60) - self.height / 2,
        }
      },
    [],
  )

  const sensors = useBoardSensors(keyboard)

  // Con puntero, lo que hay bajo él; con teclado, el día más cercano al centro (sin las flechas de mes).
  const collision = useMemo<CollisionDetection>(
    () => (args) => {
      if (args.pointerCoordinates) return pointerWithin(args)
      const id = keyTarget.current
      const container = id ? args.droppableContainers.find((c) => c.id === id) : undefined
      return container
        ? [{ id: container.id, data: { droppableContainer: container, value: 0 } }]
        : []
    },
    [],
  )

  const name = (id: string | number) => `«${taskById.get(String(id))?.title ?? ''}»`
  const where = (id: string | number | undefined) =>
    id === UNDATED
      ? 'sobre «Sin fecha»'
      : isDayKey(id)
        ? `sobre el ${dayLong(dayOf(id)).toLowerCase()}`
        : 'fuera del calendario'
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Has cogido ${name(active.id)}.`,
    onDragOver: ({ active, over }) => `${name(active.id)} ${where(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over && over.id !== NAV_PREV && over.id !== NAV_NEXT
        ? `${name(active.id)} soltada ${where(over.id)}.`
        : `${name(active.id)} no se ha movido.`,
    onDragCancel: ({ active }) => `Cancelado: ${name(active.id)} no se ha movido.`,
  }

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const due = taskById.get(String(active.id))?.dueDate
    keyTarget.current =
      activatorEvent instanceof KeyboardEvent ? (due ? dayKey(due) : UNDATED) : null
    setDragId(String(active.id))
    setMoreDay(null)
    setAdding(null)
  }

  const onDragOver = ({ over }: DragOverEvent) => {
    clearNav()
    if (over?.id === NAV_PREV || over?.id === NAV_NEXT) {
      const n = over.id === NAV_PREV ? -1 : 1
      navTimer.current = setTimeout(() => shift(n), NAV_HOVER_MS)
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    clearNav()
    setDragId(null)
    keyTarget.current = null
    const task = taskById.get(String(active.id))
    if (!task || !over) return
    if (over.id === UNDATED) void setDueDate(m, qc, task, null)
    else if (isDayKey(over.id)) void setDueDate(m, qc, task, dayOf(over.id))
  }

  const dragTask = dragId ? taskById.get(dragId) : undefined
  const filtering = isFiltering(filter)
  const label = scale === 'month' ? monthTitle(month) : weekTitle(anchor)
  const lastDay = range[range.length - 1] ?? anchor
  const next = nextDueAfter(visible, lastDay)

  const notice =
    board.tasks.length === 0 ? (
      <GridNotice title="Este proyecto aún no tiene tareas">
        <p className="text-sm text-fg-muted">
          Crea una con fecha para verla aquí. También puedes pulsar en cualquier día para crearla ya
          con esa fecha.
        </p>
        <Button variant="primary" onClick={() => shell.openNewTask({ projectId })}>
          <icons.plus size={14} aria-hidden="true" />
          Nueva tarea
        </Button>
      </GridNotice>
    ) : inRange === 0 && !dragTask ? (
      <GridNotice
        title={
          filtering
            ? `Ninguna tarea ${scale === 'month' ? `de ${monthName(month)}` : 'de esta semana'} cumple el filtro`
            : `Nada vence ${scale === 'month' ? `en ${monthName(month)}` : 'esta semana'}`
        }
      >
        {next ? (
          <p className="text-sm text-fg-muted">La siguiente es el {dayShort(next)}.</p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          {next ? (
            <Button size="sm" onClick={() => setAnchor(next)}>
              Ir al {dayShort(next)}
            </Button>
          ) : null}
          {undated.length > 0 && !trayOpen ? (
            <Button size="sm" onClick={() => setTrayOpen(true)}>
              Ver {undated.length} sin fecha
            </Button>
          ) : null}
        </div>
      </GridNotice>
    ) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{ announcements, screenReaderInstructions: instructions }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        clearNav()
        setDragId(null)
        keyTarget.current = null
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <NavArrow
          id={NAV_PREV}
          label={scale === 'month' ? 'Mes anterior' : 'Semana anterior'}
          onClick={() => shift(-1)}
        />
        <NavArrow
          id={NAV_NEXT}
          label={scale === 'month' ? 'Mes siguiente' : 'Semana siguiente'}
          onClick={() => shift(1)}
        />
        <h2 aria-live="polite" className="mr-1.5 ml-1 text-[17px] font-semibold tracking-tight">
          {label}
        </h2>
        <Button size="sm" onClick={goToday}>
          Hoy
        </Button>
        <OverdueToggle count={overdue} filter={filter} onFilterChange={onFilterChange} />
        <div className="ml-auto flex items-center gap-2">
          <SegmentedControl
            aria-label="Escala del calendario"
            value={scale}
            onValueChange={changeScale}
            options={SCALES}
          />
          <button
            type="button"
            aria-pressed={trayOpen}
            onClick={() => setTrayOpen((o) => !o)}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors',
              trayOpen
                ? 'border-border-strong bg-surface-raised text-fg'
                : 'border-border text-fg-muted hover:text-fg',
            )}
          >
            <icons.calendar size={14} aria-hidden="true" />
            Sin fecha · {undated.length}
          </button>
        </div>
      </div>

      <div className="flex min-h-[560px] flex-1 gap-3 md:min-h-0">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {scale === 'month' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle">
              {/* Cada día ya dice su nombre («Miércoles 4 de noviembre»): la cabecera es solo visual. */}
              <div aria-hidden="true" className="grid h-7 shrink-0 grid-cols-7 bg-surface">
                {WEEKDAYS.map((w) => (
                  <span
                    key={w}
                    className="flex items-center px-2.5 text-[11.5px] font-semibold tracking-wider text-fg-subtle uppercase"
                  >
                    {w}
                  </span>
                ))}
              </div>
              <ol
                ref={gridRef}
                aria-label={label}
                className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[repeat(6,minmax(84px,1fr))]"
              >
                {days.map((iso, i) => (
                  <MonthCell
                    key={iso}
                    slots={slots}
                    iso={iso}
                    tasks={byDay[iso] ?? []}
                    inMonth={iso.startsWith(month)}
                    weekend={i % 7 >= 5}
                    today={today}
                    projectId={projectId}
                    board={board}
                    canWrite={canWrite}
                    adding={adding === iso}
                    onAdding={(o) => setAdding(o ? iso : null)}
                    more={moreDay === iso}
                    onMore={(o) => setMoreDay(o ? iso : null)}
                  />
                ))}
              </ol>
            </div>
          ) : (
            <div
              className="grid min-h-0 flex-1 gap-2 transition-[grid-template-columns] duration-200 ease-out"
              // Los días con tareas (y hoy) se llevan el ancho; los vacíos, como un fin de semana libre, se estrechan.
              style={{
                gridTemplateColumns: days
                  .map((d) =>
                    (byDay[d]?.length ?? 0) > 0 || d === today
                      ? 'minmax(0,1fr)'
                      : 'minmax(0,0.55fr)',
                  )
                  .join(' '),
              }}
            >
              {days.map((iso, c) => (
                <WeekColumn
                  key={iso}
                  iso={iso}
                  tasks={byDay[iso] ?? []}
                  total={allByDay[iso]?.length ?? 0}
                  weekend={c >= 5}
                  today={today}
                  projectId={projectId}
                  board={board}
                  canWrite={canWrite}
                  adding={adding === iso}
                  onAdding={(o) => setAdding(o ? iso : null)}
                />
              ))}
            </div>
          )}
          {notice}
        </div>

        {trayOpen ? (
          <UndatedTray
            tasks={undated}
            dragging={dragTask !== undefined}
            today={today}
            projectId={projectId}
            board={board}
            canWrite={canWrite}
            adding={adding === UNDATED}
            onAdding={(o) => setAdding(o ? UNDATED : null)}
            onClose={() => setTrayOpen(false)}
          />
        ) : (
          <UndatedRail
            count={undated.length}
            dragging={dragTask !== undefined}
            canWrite={canWrite}
            onOpen={() => setTrayOpen(true)}
          />
        )}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}>
        {dragTask ? (
          <div className="w-[240px]">
            <TaskCardOverlay task={dragTask} progress={board.counts[dragTask.id]} today={today} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
