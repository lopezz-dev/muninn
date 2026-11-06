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
import { useTranslation } from 'react-i18next'
import { EmptyState, Ghost, Page, useDocumentTitle } from '../components/Page'
import { DueDate, PriorityFlag } from '../components/task-meta'
import { currentLocale } from '../i18n'
import { clock, weekdayShort } from '../lib/dates'
import { useEnabledModules } from '../lib/modules'
import { useAuth, useMuninn } from '../lib/muninn'
import { checklistCountsQuery, overviewQuery } from '../lib/queries'
import { completeTask, reopenTask } from '../lib/task-actions'
import { useShell } from '../shell/shell-context'
import { UpcomingCharges } from './finanzas/UpcomingCharges'

type Task = OverviewReport['dueToday'][number]

/** El saludo según la hora: de madrugada y por la noche, el mismo. */
const daypart = (h: number) =>
  h < 6 ? 'night' : h < 14 ? 'morning' : h < 21 ? 'afternoon' : ('night' as const)

/** «lunes, 3 de noviembre» en el idioma activo (ADR-0077). */
const longDate = (d: Date) =>
  new Intl.DateTimeFormat(currentLocale() === 'es' ? 'es-ES' : 'en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)

/** «Alex» de «Alex López»; nada si el nombre es el correo o el de reserva (`lib/auth.ts`). */
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
  const { t } = useTranslation('home')
  const checked = done || pending
  return (
    <li className="flex items-center gap-3 border-t border-border-subtle px-4 py-2.5 first:border-t-0 hover:bg-surface-hover/60">
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(task)}
        aria-label={t(done ? 'row.reopen' : 'row.complete', { title: task.title })}
        touch
        size="lg"
        className="md:size-4 md:rounded-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          to="/projects/$projectId/tasks/$taskId"
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
          <span>{t('row.doneAt', { time: clock(task.completedAt) })}</span>
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
  const { t } = useTranslation('home')
  return (
    <div className="border-t border-border-subtle">
      <div className="flex items-center gap-3.5 px-4 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
          <Icon name="check" size={20} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-md font-semibold">{t('clear.title')}</span>
          <span className="text-sm text-fg-muted">{t('clear.description')}</span>
        </span>
      </div>
      {next ? (
        <Link
          to="/projects/$projectId/tasks/$taskId"
          params={{ projectId: next.projectId, taskId: next.id }}
          className="flex items-center gap-3 border-t border-border-subtle px-4 py-3 transition-colors hover:bg-surface-hover/60"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
              {t('clear.next')}
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
          {t('clear.noDates')}
        </p>
      )}
    </div>
  )
}

export function Inicio() {
  const { t } = useTranslation(['home', 'common', 'finance'])
  const m = useMuninn()
  const qc = useQueryClient()
  const shell = useShell()
  const auth = useAuth()
  const { data } = useQuery(overviewQuery(m))
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())

  const ids = data
    ? [...data.overdue, ...data.dueToday, ...data.inProgress, ...data.upcoming].map(
        (task) => task.id,
      )
    : []
  const counts = useQuery(checklistCountsQuery(m, [...new Set(ids)].sort())).data ?? {}
  const color = new Map(data?.projects.map((p) => [p.id, p.color]))

  const now = new Date()
  const date = longDate(now)
  const name = auth.kind === 'user' ? firstName(auth.account.name) : ''
  const today = data?.today ?? m.today()
  const modules = useEnabledModules()
  // Con Finanzas oculta no se pregunta por cobros (ADR-0028); mientras no se sepa, tampoco.
  const financeOn = modules?.has('finance') ?? false
  const projectCount = data?.projects.length ?? 0
  const part = daypart(now.getHours())
  const title = name ? t(`greetingNamed.${part}`, { name }) : t(`greeting.${part}`)
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
    list.map((task) => (
      <TaskRow
        key={task.id}
        task={task}
        color={color.get(task.projectId) ?? 'gray'}
        today={today}
        progress={counts[task.id]}
        done={done}
        pending={pending.has(task.id)}
        onToggle={(task) => toggle(task, done)}
      />
    ))

  const todayTasks = data ? [...data.overdue, ...data.dueToday] : []
  // Lo que ya está en curso sale en su tarjeta: en «Próximos días» no se repite.
  const inProgressIds = new Set(data?.inProgress.map((task) => task.id))
  const upcoming = data?.upcoming.filter((task) => !inProgressIds.has(task.id)) ?? []
  const summary = data
    ? [
        data.overdue.length ? t('summary.overdue', { count: data.overdue.length }) : null,
        data.dueToday.length ? t('summary.dueToday', { count: data.dueToday.length }) : null,
        data.overdue.length || data.dueToday.length ? null : t('summary.nothingDue'),
        data.inProgress.length ? t('summary.inProgress', { count: data.inProgress.length }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const doneToday = data?.completedTodayTasks ?? []
  const dueTodayDone = doneToday.filter((task) => task.dueDate === today).length
  const week = data?.completedByDay ?? []
  const weekTotal = week.reduce((n, d) => n + d.count, 0)
  const weekMax = Math.max(1, ...week.map((d) => d.count))

  const newTask = (
    <Button variant="primary" onClick={() => shell.openNewTask()}>
      <Icon name="plus" />
      {t('newTask')}
      <Kbd className="border-accent-fg/30 text-accent-fg max-md:hidden">N</Kbd>
    </Button>
  )
  const newProject = (
    <Button variant="primary" onClick={shell.openNewProject}>
      <Icon name="plus" />
      {t('shell.newProject', { ns: 'common' })}
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
            aria-label={t('shell.searchOrAsk', { ns: 'common' })}
            icon={<Icon name="search" size={20} />}
            onClick={() => shell.openPalette()}
          />
          <IconButton
            variant="primary"
            size="lg"
            aria-label={projectCount > 0 ? t('newTask') : t('shell.newProject', { ns: 'common' })}
            icon={<Icon name="plus" size={20} />}
            onClick={() => (projectCount > 0 ? shell.openNewTask() : shell.openNewProject())}
          />
        </div>
        <div className="hidden shrink-0 flex-wrap gap-2 md:flex">
          <Button asChild>
            <Link to="/assistant">
              <Icon name="assistant" className="text-accent" />
              {t('askMuninn')}
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
          title={t('empty.projectsTitle')}
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
          {t('empty.projects')}
        </EmptyState>
      ) : (
        <>
          {/* Una sola franja: en el teléfono, cuatro tarjetas grandes con ceros se comían la pantalla. */}
          <Card
            aria-label={t('stats.label')}
            className="grid shrink-0 grid-cols-4 divide-x divide-border-subtle"
          >
            <Stat
              label={t('stats.dueToday')}
              value={data.dueToday.length}
              total={data.dueToday.length + dueTodayDone}
            />
            <Stat label={t('stats.inProgress')} value={data.inProgress.length} />
            <Stat label={t('stats.overdue')} value={data.overdue.length} tone="danger" />
            <Stat label={t('stats.doneWeek')} value={weekTotal} />
          </Card>

          {totalTasks === 0 ? (
            <EmptyState
              icon="check"
              title={t('empty.tasksTitle')}
              actions={newTask}
              preview={
                <div className="flex flex-col gap-2 pb-6">
                  <Ghost className="h-9" />
                  <Ghost className="h-9 w-4/5" />
                </div>
              }
            >
              {t('empty.tasks')}
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
                    title={t('myTasks.title')}
                    description={t('myTasks.description')}
                    action={
                      <Link to="/projects" className="text-sm text-accent hover:text-accent-hover">
                        {t('myTasks.boards')}
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
                  <CardHeader
                    title={t('inProgress.title')}
                    description={t('inProgress.description')}
                  />
                  {data.inProgress.length === 0 ? (
                    <p className="border-t border-border-subtle px-4 py-6 text-center text-sm text-fg-muted">
                      {t('inProgress.empty')}
                    </p>
                  ) : (
                    <ul className="min-h-0 overflow-y-auto">{rows(data.inProgress)}</ul>
                  )}
                </Card>
              </>
            )}

            <Card className="flex min-w-0 flex-col lg:order-last lg:min-h-0">
              <CardHeader title={t('upcoming.title')} description={t('upcoming.description')} />
              {upcoming.length === 0 ? (
                <p className="border-t border-border-subtle px-4 py-6 text-center text-sm text-fg-muted">
                  {data.upcoming.length ? t('upcoming.allInProgress') : t('upcoming.empty')}
                </p>
              ) : (
                <ul className="min-h-0 overflow-y-auto">
                  {upcoming.slice(0, 6).map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-2.5 border-t border-border-subtle px-4 py-3 first:border-t-0 md:py-2.5"
                    >
                      <ColorDot color={color.get(task.projectId) ?? 'gray'} />
                      <Link
                        to="/projects/$projectId/tasks/$taskId"
                        params={{ projectId: task.projectId, taskId: task.id }}
                        className="min-w-0 flex-1 text-md max-md:line-clamp-2 md:truncate md:text-sm"
                      >
                        {task.title}
                      </Link>
                      {task.dueDate ? (
                        <DueDate due={task.dueDate} today={today} className="shrink-0 text-xs" />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex min-w-0 flex-col gap-3.5 overflow-y-auto p-4 lg:min-h-0">
              <div className="flex items-center">
                <h2 className="text-md font-semibold">{t('projects.title')}</h2>
                <Link
                  to="/projects"
                  className="ml-auto text-sm text-accent hover:text-accent-hover"
                >
                  {t('projects.all')}
                </Link>
              </div>
              {data.projects.map((p) => {
                const total = p.open + p.done
                return (
                  <Link
                    key={p.id}
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="flex flex-col gap-1.5 rounded-sm"
                  >
                    <span className="flex items-center gap-2 text-md md:text-sm">
                      <ColorDot color={p.color} />
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-fg-subtle tabular">
                        {total
                          ? t('projects.progress', { done: p.done, total })
                          : t('projects.noTasks')}
                      </span>
                    </span>
                    <ProgressBar
                      value={total ? p.done / total : 0}
                      color={p.color}
                      label={t('projects.progressLabel', { name: p.name })}
                    />
                  </Link>
                )
              })}
            </Card>

            <Card className="flex min-w-0 flex-col gap-3 p-4">
              <div className="flex items-baseline gap-2">
                <h2 className="text-md font-semibold">{t('week.title')}</h2>
                <span className="ml-auto text-xs text-fg-subtle">
                  {t('week.done', { count: weekTotal })}
                </span>
              </div>
              <div
                role="img"
                aria-label={t('week.chart', {
                  days: week.map((d) => `${weekdayShort(d.date)} ${d.count}`).join(', '),
                })}
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
                          title={t('week.bar', { count: d.count })}
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
                        {isToday ? t('dates.today', { ns: 'common' }) : weekdayShort(d.date)}
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
