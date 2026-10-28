import type { OverviewReport } from '@muninn/core'
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  ColorDot,
  cn,
  Icon,
  IconButton,
  icons,
  Kbd,
  ProgressBar,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { EmptyState, Ghost, Page, useDocumentTitle } from '../components/Page'
import { DueDate, PriorityFlag } from '../components/task-meta'
import { clock, weekdayShort } from '../lib/dates'
import { useEnabledModules } from '../lib/modules'
import { useAuth, useMuninn } from '../lib/muninn'
import { checklistCountsQuery, overviewQuery } from '../lib/queries'
import { completeTask, reopenTask } from '../lib/task-actions'
import { useShell } from '../shell/shell-context'
import { UpcomingCharges } from './finanzas/UpcomingCharges'

type Task = OverviewReport['dueToday'][number]

const greeting = (h: number) =>
  h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'

const dateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

/** «Alex» de «Alex López»; nada si el nombre es el correo o el de reserva. */
const firstName = (name: string) => (name.includes('@') || name === 'Tú' ? '' : name.split(' ')[0])

function Stat({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total?: number
  tone?: 'danger'
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-3 py-3 md:px-4 md:py-3.5">
      <span
        className={cn(
          'text-[22px] leading-none font-semibold tracking-tight tabular md:text-[26px]',
          tone === 'danger' && value > 0 && 'text-danger',
        )}
      >
        {value}
        {total !== undefined && total > value ? (
          <span className="text-sm font-medium text-fg-subtle md:text-md"> / {total}</span>
        ) : null}
      </span>
      <span className="text-xs leading-tight font-medium text-pretty text-fg-subtle">{label}</span>
    </div>
  )
}

interface RowProps {
  task: Task
  color: string
  today: string
  progress?: { done: number; total: number }
  /** Es una tarea ya hecha (de «Hechas hoy»): tachada, y la casilla la reabre. */
  done?: boolean
  pending: boolean
  onToggle: (task: Task) => void
}

/** Fila de tarea: casilla para completar, título (enlace al detalle) y sus datos. */
function TaskRow({ task, color, today, progress, done, pending, onToggle }: RowProps) {
  const checked = done || pending
  return (
    <li className="flex items-center gap-3 border-t border-border-subtle px-4 py-2.5 first:border-t-0 hover:bg-surface-hover/60">
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(task)}
        aria-label={`${done ? 'Reabrir' : 'Completar'}: ${task.title}`}
        touch
        size="lg"
        className="md:size-4 md:rounded-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          to="/proyectos/$projectId/tareas/$taskId"
          params={{ projectId: task.projectId, taskId: task.id }}
          // La fila se adapta al ancho de su tarjeta (`@container`), no al de la pantalla: en una tarjeta estrecha
          // (teléfono, tablet o la columna de «En curso») el título ocupa hasta dos líneas y los datos van debajo.
          className={cn(
            'line-clamp-2 text-md @md:line-clamp-1 md:text-base',
            checked ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {task.title}
        </Link>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-fg-subtle @md:hidden">
          <span className="inline-flex items-center gap-1.5">
            <ColorDot color={color} />
            {task.projectName}
          </span>
          {task.dueDate && !done ? <DueDate due={task.dueDate} today={today} /> : null}
          {progress?.total ? (
            <span className="tabular">
              {progress.done}/{progress.total}
            </span>
          ) : null}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-2.5 text-xs text-fg-subtle @md:flex">
        <span className="inline-flex items-center gap-1.5">
          <ColorDot color={color} />
          {task.projectName}
        </span>
        {progress?.total ? (
          <span className="tabular">
            {progress.done}/{progress.total}
          </span>
        ) : null}
        {done && task.completedAt ? (
          <span>Hecha {clock(task.completedAt)}</span>
        ) : task.dueDate ? (
          <DueDate due={task.dueDate} today={today} />
        ) : null}
      </span>
      {done ? null : <PriorityFlag priority={task.priority} className="shrink-0" />}
    </li>
  )
}

/** «Mis tareas» sin nada para hoy: en vez de un hueco, qué viene después. */
function Clear({ next, today }: { next?: Task; today: string }) {
  return (
    <div className="border-t border-border-subtle">
      <div className="flex items-center gap-3.5 px-4 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
          <Icon name="check" size={20} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-md font-semibold">Día despejado</span>
          <span className="text-sm text-fg-muted">Nada vence hoy ni está atrasado.</span>
        </span>
      </div>
      {next ? (
        <Link
          to="/proyectos/$projectId/tareas/$taskId"
          params={{ projectId: next.projectId, taskId: next.id }}
          className="flex items-center gap-3 border-t border-border-subtle px-4 py-3 transition-colors hover:bg-surface-hover/60"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
              Lo siguiente
              {next.dueDate ? (
                <>
                  {' · '}
                  <DueDate due={next.dueDate} today={today} />
                </>
              ) : null}
            </span>
            <span className="text-md max-md:line-clamp-2 md:truncate md:text-base">
              {next.title}
            </span>
          </span>
          <icons.chevronRight aria-hidden="true" className="shrink-0 text-fg-faint" />
        </Link>
      ) : (
        <p className="border-t border-border-subtle px-4 py-3 text-sm text-fg-muted">
          Cuando pongas fechas a tus tareas, aparecerán aquí por urgencia.
        </p>
      )}
    </div>
  )
}

export function Inicio() {
  const m = useMuninn()
  const qc = useQueryClient()
  const shell = useShell()
  const auth = useAuth()
  const { data } = useQuery(overviewQuery(m))
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())

  const ids = data
    ? [...data.overdue, ...data.dueToday, ...data.inProgress, ...data.upcoming].map((t) => t.id)
    : []
  const counts = useQuery(checklistCountsQuery(m, [...new Set(ids)].sort())).data ?? {}
  const color = new Map(data?.projects.map((p) => [p.id, p.color]))

  const now = new Date()
  const date = dateFmt.format(now)
  const name = auth.kind === 'user' ? firstName(auth.account.name) : ''
  const today = data?.today ?? m.today()
  const modules = useEnabledModules()
  // Con Finanzas oculta no se pregunta por cobros (ADR-0028); mientras no se sepa, tampoco.
  const financeOn = modules?.has('finance') ?? false
  const projectCount = data?.projects.length ?? 0
  const title = name ? `${greeting(now.getHours())}, ${name}` : greeting(now.getHours())
  useDocumentTitle(title)
  const totalTasks = data?.projects.reduce((n, p) => n + p.open + p.done, 0) ?? 0

  const toggle = async (task: Task, done: boolean) => {
    setPending((s) => new Set(s).add(task.id))
    await (done ? reopenTask(m, qc, task) : completeTask(m, qc, task))
    setPending((s) => {
      const next = new Set(s)
      next.delete(task.id)
      return next
    })
  }

  const rows = (list: Task[], done = false) =>
    list.map((t) => (
      <TaskRow
        key={t.id}
        task={t}
        color={color.get(t.projectId) ?? 'gray'}
        today={today}
        progress={counts[t.id]}
        done={done}
        pending={pending.has(t.id)}
        onToggle={(task) => toggle(task, done)}
      />
    ))

  const todayTasks = data ? [...data.overdue, ...data.dueToday] : []
  // Lo que ya está en curso sale en su tarjeta: en «Próximos días» no se repite.
  const inProgressIds = new Set(data?.inProgress.map((t) => t.id))
  const upcoming = data?.upcoming.filter((t) => !inProgressIds.has(t.id)) ?? []
  const summary = data
    ? [
        data.overdue.length
          ? data.overdue.length === 1
            ? '1 vencida'
            : `${data.overdue.length} vencidas`
          : null,
        data.dueToday.length
          ? data.dueToday.length === 1
            ? '1 tarea para hoy'
            : `${data.dueToday.length} tareas para hoy`
          : null,
        data.overdue.length || data.dueToday.length ? null : 'Nada vence hoy',
        data.inProgress.length ? `${data.inProgress.length} en curso` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const doneToday = data?.completedTodayTasks ?? []
  const dueTodayDone = doneToday.filter((t) => t.dueDate === today).length
  const week = data?.completedByDay ?? []
  const weekTotal = week.reduce((n, d) => n + d.count, 0)
  const weekMax = Math.max(1, ...week.map((d) => d.count))

  const newTask = (
    <Button variant="primary" onClick={() => shell.openNewTask()}>
      <Icon name="plus" />
      Nueva tarea
      <Kbd className="border-accent-fg/30 text-accent-fg max-md:hidden">N</Kbd>
    </Button>
  )
  const newProject = (
    <Button variant="primary" onClick={shell.openNewProject}>
      <Icon name="plus" />
      Nuevo proyecto
    </Button>
  )

  return (
    // lg: el panel mide la ventana; cada tarjeta lleva el scroll de su lista (ADR-0050).
    <Page className="lg:min-h-0">
      <header className="flex items-start gap-3 md:items-end md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-semibold tracking-wider text-fg-subtle uppercase">{date}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {projectCount > 0 && summary ? (
            <p className="text-base text-fg-muted">{summary}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2 md:hidden">
          <IconButton
            variant="secondary"
            size="lg"
            aria-label="Buscar o preguntar"
            icon={<Icon name="search" size={20} />}
            onClick={() => shell.openPalette()}
          />
          <IconButton
            variant="primary"
            size="lg"
            aria-label={projectCount > 0 ? 'Nueva tarea' : 'Nuevo proyecto'}
            icon={<Icon name="plus" size={20} />}
            onClick={() => (projectCount > 0 ? shell.openNewTask() : shell.openNewProject())}
          />
        </div>
        <div className="hidden shrink-0 flex-wrap gap-2 md:flex">
          <Button asChild>
            <Link to="/asistente">
              <Icon name="assistant" className="text-accent" />
              Preguntar a Muninn
            </Link>
          </Button>
          {projectCount > 0 ? newTask : newProject}
        </div>
      </header>

      {financeOn ? <UpcomingCharges today={today} /> : null}

      {!data ? (
        <div aria-hidden="true">
          <Ghost className="h-[74px]" />
        </div>
      ) : projectCount === 0 ? (
        <EmptyState
          icon="projects"
          title="Empieza por un proyecto"
          actions={newProject}
          preview={
            <div className="grid grid-cols-3 gap-3 pb-6">
              {[0.6, 0.85, 0.4].map((w) => (
                <div key={w} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <Ghost className="h-2.5 w-1/2" />
                  <Ghost className="h-1 w-full" />
                  <div className="h-1 rounded-full bg-accent/40" style={{ width: `${w * 100}%` }} />
                </div>
              ))}
            </div>
          }
        >
          Cada proyecto trae su tablero Kanban. Aquí verás lo que vence hoy, lo que tienes en curso
          y lo que has terminado esta semana.
        </EmptyState>
      ) : (
        <>
          {/* Una sola franja: en el teléfono, cuatro tarjetas grandes con ceros se comían la pantalla. */}
          <Card
            aria-label="Resumen"
            className="grid shrink-0 grid-cols-4 divide-x divide-border-subtle"
          >
            <Stat
              label="Para hoy"
              value={data.dueToday.length}
              total={data.dueToday.length + dueTodayDone}
            />
            <Stat label="En curso" value={data.inProgress.length} />
            <Stat label="Vencidas" value={data.overdue.length} tone="danger" />
            <Stat label="Hechas · 7 días" value={weekTotal} />
          </Card>

          {totalTasks === 0 ? (
            <EmptyState
              icon="check"
              title="Todavía no tienes tareas"
              actions={newTask}
              preview={
                <div className="flex flex-col gap-2 pb-6">
                  <Ghost className="h-9" />
                  <Ghost className="h-9 w-4/5" />
                </div>
              }
            >
              Crea la primera y aparecerá aquí cuando venza hoy, esté en curso o la termines.
            </EmptyState>
          ) : null}

          {/*
           * Una sola rejilla para los tres tamaños (ADR-0054): una columna en el teléfono, dos en tablet y tres en el
           * ordenador. `grid-cols-1` no sobra: sin columnas explícitas, la pista implícita se estira hasta el ancho de
           * un título largo y la pantalla se sale por la derecha. En el ordenador, «Próximos días» pasa al final de la
           * segunda fila y cada lista hace scroll dentro de su tarjeta (ADR-0050).
           */}
          <section
            className={cn(
              'grid grid-cols-1 gap-3 md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-3',
              totalTasks === 0
                ? 'lg:grid-rows-[minmax(180px,1fr)]'
                : 'lg:grid-rows-[minmax(180px,1fr)_minmax(180px,1fr)]',
            )}
          >
            {totalTasks === 0 ? null : (
              <>
                <Card className="@container flex min-w-0 flex-col md:col-span-2 lg:min-h-0">
                  <CardHeader
                    title="Mis tareas"
                    description="Vencidas, de hoy y las que has hecho hoy"
                    action={
                      <Link to="/proyectos" className="text-sm text-accent hover:text-accent-hover">
                        Ver tableros
                      </Link>
                    }
                  />
                  {todayTasks.length === 0 && doneToday.length === 0 ? (
                    <Clear next={upcoming[0] ?? data.upcoming[0]} today={today} />
                  ) : (
                    <ul className="min-h-0 overflow-y-auto">
                      {rows(todayTasks)}
                      {rows(doneToday, true)}
                    </ul>
                  )}
                </Card>

                <Card className="@container flex min-w-0 flex-col lg:min-h-0">
                  <CardHeader title="En curso" description="Lo que tienes entre manos" />
                  {data.inProgress.length === 0 ? (
                    <p className="border-t border-border-subtle px-4 py-6 text-center text-sm text-fg-muted">
                      Ninguna tarea en curso. Mueve una a «En curso» en su tablero.
                    </p>
                  ) : (
                    <ul className="min-h-0 overflow-y-auto">{rows(data.inProgress)}</ul>
                  )}
                </Card>
              </>
            )}

            <Card className="flex min-w-0 flex-col lg:order-last lg:min-h-0">
              <CardHeader
                title="Próximos días"
                description="Lo que vence esta semana y no está en curso"
              />
              {upcoming.length === 0 ? (
                <p className="border-t border-border-subtle px-4 py-6 text-center text-sm text-fg-muted">
                  {data.upcoming.length
                    ? 'Todo lo que vence esta semana ya está en curso.'
                    : 'Nada vence en los próximos 7 días.'}
                </p>
              ) : (
                <ul className="min-h-0 overflow-y-auto">
                  {upcoming.slice(0, 6).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2.5 border-t border-border-subtle px-4 py-3 first:border-t-0 md:py-2.5"
                    >
                      <ColorDot color={color.get(t.projectId) ?? 'gray'} />
                      <Link
                        to="/proyectos/$projectId/tareas/$taskId"
                        params={{ projectId: t.projectId, taskId: t.id }}
                        className="min-w-0 flex-1 text-md max-md:line-clamp-2 md:truncate md:text-sm"
                      >
                        {t.title}
                      </Link>
                      {t.dueDate ? (
                        <DueDate due={t.dueDate} today={today} className="shrink-0 text-xs" />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex min-w-0 flex-col gap-3.5 overflow-y-auto p-4 lg:min-h-0">
              <div className="flex items-center">
                <h2 className="text-md font-semibold">Proyectos</h2>
                <Link
                  to="/proyectos"
                  className="ml-auto text-sm text-accent hover:text-accent-hover"
                >
                  Todos
                </Link>
              </div>
              {data.projects.map((p) => {
                const total = p.open + p.done
                return (
                  <Link
                    key={p.id}
                    to="/proyectos/$projectId"
                    params={{ projectId: p.id }}
                    className="flex flex-col gap-1.5 rounded-sm"
                  >
                    <span className="flex items-center gap-2 text-md md:text-sm">
                      <ColorDot color={p.color} />
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-fg-subtle tabular">
                        {total ? `${p.done} de ${total}` : 'Sin tareas'}
                      </span>
                    </span>
                    <ProgressBar
                      value={total ? p.done / total : 0}
                      color={p.color}
                      label={`Progreso de ${p.name}`}
                    />
                  </Link>
                )
              })}
            </Card>

            <Card className="flex min-w-0 flex-col gap-3 p-4">
              <div className="flex items-baseline gap-2">
                <h2 className="text-md font-semibold">Últimos 7 días</h2>
                <span className="ml-auto text-xs text-fg-subtle">
                  {weekTotal === 1 ? '1 tarea hecha' : `${weekTotal} tareas hechas`}
                </span>
              </div>
              <div
                role="img"
                aria-label={`Tareas hechas por día: ${week.map((d) => `${weekdayShort(d.date)} ${d.count}`).join(', ')}`}
                className="grid min-h-[96px] flex-1 grid-cols-7 items-end gap-2 md:min-h-[130px]"
              >
                {week.map((d, i) => {
                  const isToday = i === week.length - 1
                  return (
                    <div
                      key={d.date}
                      className="flex h-full flex-col items-center justify-end gap-1.5"
                    >
                      <span className="text-2xs text-fg-subtle tabular">{d.count || ''}</span>
                      {/* Las barras crecen con la tarjeta: alto en % del hueco libre, mínimo 4 px. */}
                      <div className="flex min-h-[52px] w-full flex-1 items-end md:min-h-[84px]">
                        <div
                          title={`${d.count} hechas`}
                          className={cn(
                            'min-h-1 w-full rounded-xs',
                            isToday ? 'bg-accent' : 'bg-border-strong',
                          )}
                          style={{ height: `${(d.count / weekMax) * 100}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          'text-[11.5px]',
                          isToday ? 'font-semibold text-fg' : 'text-fg-subtle',
                        )}
                      >
                        {isToday ? 'Hoy' : weekdayShort(d.date)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </section>
        </>
      )}
    </Page>
  )
}
