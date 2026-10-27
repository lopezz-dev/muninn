import type { OverviewReport } from '@muninn/core'
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  ColorDot,
  cn,
  Icon,
  Kbd,
  ProgressBar,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'
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
    <Card className="flex flex-col gap-2 px-4 py-3.5">
      <span className="text-xs font-medium text-fg-subtle">{label}</span>
      <span
        className={cn(
          'text-[26px] leading-none font-semibold tracking-tight tabular',
          tone === 'danger' && value > 0 && 'text-danger',
        )}
      >
        {value}
        {total !== undefined && total > value ? (
          <span className="text-md font-medium text-fg-subtle"> / {total}</span>
        ) : null}
      </span>
    </Card>
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
          className={cn(
            'truncate text-md md:text-base',
            checked ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {task.title}
        </Link>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-fg-subtle md:hidden">
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
      <span className="hidden shrink-0 items-center gap-2.5 text-xs text-fg-subtle md:flex">
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
    // lg: el panel mide la ventana; cada tarjeta lleva el scroll de su lista (ADR-0047).
    <Page className="lg:min-h-0">
      <PageHeader
        title={name ? `${greeting(now.getHours())}, ${name}` : greeting(now.getHours())}
        description={
          <>
            {`${date.charAt(0).toUpperCase()}${date.slice(1)}`}
            {data && projectCount > 0 ? (
              <>
                {' · '}
                {data.dueToday.length === 1
                  ? '1 tarea para hoy'
                  : `${data.dueToday.length} tareas para hoy`}
                {data.overdue.length > 0
                  ? ` · ${data.overdue.length === 1 ? '1 vencida' : `${data.overdue.length} vencidas`}`
                  : ''}
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Button asChild>
              <Link to="/asistente">
                <Icon name="assistant" className="text-accent" />
                Preguntar a Muninn
              </Link>
            </Button>
            {projectCount > 0 ? newTask : newProject}
          </>
        }
      />

      {financeOn ? <UpcomingCharges today={today} /> : null}

      {!data ? (
        <div aria-hidden="true" className="grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Ghost key={i} className="h-[74px]" />
          ))}
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
          <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Para hoy"
              value={data.dueToday.length}
              total={data.dueToday.length + dueTodayDone}
            />
            <Stat label="En curso" value={data.inProgress.length} />
            <Stat label="Vencidas" value={data.overdue.length} tone="danger" />
            <Stat label="Hechas · 7 días" value={weekTotal} />
          </section>

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
          ) : (
            <section className="grid gap-3 lg:min-h-[180px] lg:flex-1 lg:grid-cols-3">
              <Card className="flex flex-col lg:col-span-2 lg:min-h-0">
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
                  <p className="border-t border-border-subtle px-4 py-6 text-center text-sm text-fg-muted">
                    Nada vence hoy ni está atrasado.
                    {data.upcoming[0]
                      ? ` Lo siguiente es «${data.upcoming[0].title}».`
                      : ' Cuando pongas fechas a tus tareas, aparecerán aquí por urgencia.'}
                  </p>
                ) : (
                  <ul className="min-h-0 overflow-y-auto">
                    {rows(todayTasks)}
                    {rows(doneToday, true)}
                  </ul>
                )}
              </Card>

              <Card className="flex flex-col lg:min-h-0">
                <CardHeader title="En curso" description="Lo que tienes entre manos" />
                {data.inProgress.length === 0 ? (
                  <p className="border-t border-border-subtle px-4 py-6 text-center text-sm text-fg-muted">
                    Ninguna tarea en curso. Mueve una a «En curso» en su tablero.
                  </p>
                ) : (
                  <ul className="min-h-0 overflow-y-auto">{rows(data.inProgress)}</ul>
                )}
              </Card>
            </section>
          )}

          <section className="grid gap-3 lg:min-h-[180px] lg:flex-1 lg:grid-cols-3">
            <Card className="flex flex-col gap-3.5 overflow-y-auto p-4 lg:min-h-0">
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
                    <span className="flex items-center gap-2 text-sm">
                      <ColorDot color={p.color} />
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto text-xs text-fg-subtle tabular">
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

            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-baseline gap-2">
                <h2 className="text-md font-semibold">Últimos 7 días</h2>
                <span className="ml-auto text-xs text-fg-subtle">
                  {weekTotal === 1 ? '1 tarea hecha' : `${weekTotal} tareas hechas`}
                </span>
              </div>
              <div
                role="img"
                aria-label={`Tareas hechas por día: ${week.map((d) => `${weekdayShort(d.date)} ${d.count}`).join(', ')}`}
                className="grid min-h-[130px] flex-1 grid-cols-7 items-end gap-2"
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
                      <div className="flex min-h-[84px] w-full flex-1 items-end">
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

            <Card className="flex flex-col lg:min-h-0">
              <CardHeader title="Próximos días" description="Lo que vence en la próxima semana" />
              {data.upcoming.length === 0 ? (
                <p className="border-t border-border-subtle px-4 py-6 text-center text-sm text-fg-muted">
                  Nada vence en los próximos 7 días.
                </p>
              ) : (
                <ul className="min-h-0 overflow-y-auto">
                  {data.upcoming.slice(0, 6).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2.5 border-t border-border-subtle px-4 py-2.5 first:border-t-0"
                    >
                      <ColorDot color={color.get(t.projectId) ?? 'gray'} />
                      <Link
                        to="/proyectos/$projectId/tareas/$taskId"
                        params={{ projectId: t.projectId, taskId: t.id }}
                        className="min-w-0 flex-1 truncate text-sm"
                      >
                        {t.title}
                      </Link>
                      {t.dueDate ? (
                        <DueDate due={t.dueDate} today={today} className="text-xs" />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      )}
    </Page>
  )
}
