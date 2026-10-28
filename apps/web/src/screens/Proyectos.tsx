import type { OverviewReport, Project } from '@muninn/core'
import { Button, Card, cn, Icon, IconButton, icons, SegmentedControl, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { EmptyState, Ghost, Page, useDocumentTitle } from '../components/Page'
import { ProjectAvatar, ProjectCover } from '../components/ProjectAvatar'
import { SelectMenu } from '../components/SelectMenu'
import { DueDate } from '../components/task-meta'
import { timeAgo } from '../lib/dates'
import { useEnabledModules } from '../lib/modules'
import { useMuninn } from '../lib/muninn'
import {
  archivedProjectsQuery,
  overviewQuery,
  projectsQuery,
  unarchiveProjectWithUndo,
} from '../lib/queries'
import { useIsDesktop } from '../lib/use-media'
import { useShell } from '../shell/shell-context'

type Stats = OverviewReport['projects'][number]
type Filter = 'all' | 'overdue' | 'github'
type Sort = 'urgency' | 'activity' | 'name'

/** Segmentos de la barra por estado, con el color de cada tipo de columna. */
const KINDS = [
  { key: 'backlog', one: 'en backlog', many: 'en backlog', bar: 'bg-kind-backlog' },
  { key: 'todo', one: 'pendiente', many: 'pendientes', bar: 'bg-kind-todo' },
  { key: 'in_progress', one: 'en curso', many: 'en curso', bar: 'bg-kind-in-progress' },
  { key: 'review', one: 'en revisión', many: 'en revisión', bar: 'bg-kind-review' },
] as const

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Lo urgente primero: más vencidas, luego la fecha más cercana, luego lo que se movió hace menos. */
function byUrgency(a?: Stats, b?: Stats) {
  if (!a || !b) return a ? -1 : b ? 1 : 0
  return (
    b.overdue - a.overdue ||
    (a.next[0]?.dueDate ?? '9999').localeCompare(b.next[0]?.dueDate ?? '9999') ||
    b.lastActivityAt.localeCompare(a.lastActivityAt)
  )
}

/** Barra apilada por estado: abiertas por tipo de columna y hechas. */
function StateBar({ s }: { s: Stats }) {
  const total = s.open + s.done
  const parts = [
    ...KINDS.map((k) => ({ n: s.byKind[k.key], bar: k.bar })),
    { n: s.done, bar: 'bg-kind-done' },
  ].filter((p) => p.n > 0)
  return (
    <div
      role="img"
      aria-label={`${plural(s.open, 'abierta', 'abiertas')} y ${plural(s.done, 'hecha', 'hechas')}`}
      className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-border"
    >
      {total
        ? parts.map((p) => <span key={p.bar} className={p.bar} style={{ flex: `${p.n} 0 0` }} />)
        : null}
    </div>
  )
}

function Chips({ s }: { s: Stats }) {
  const chip = 'inline-flex h-[22px] items-center rounded-sm px-1.5 text-xs font-medium'
  const any = s.overdue || s.inProgress || s.agent || s.githubRepo
  return (
    <div className="flex flex-wrap gap-1.5">
      {s.overdue ? (
        <span className={cn(chip, 'bg-danger-soft text-danger')}>
          {plural(s.overdue, 'vencida', 'vencidas')}
        </span>
      ) : null}
      {s.byKind.in_progress ? (
        <span className={cn(chip, 'bg-accent-soft text-accent')}>
          {s.byKind.in_progress} en curso
        </span>
      ) : null}
      {s.agent ? (
        <span className={cn(chip, 'bg-project-violet/15 text-project-violet')}>
          {s.agent} con el agente
        </span>
      ) : null}
      {s.githubRepo ? (
        <span className={cn(chip, 'gap-1 bg-surface-raised text-fg-muted')}>
          <icons.github size={12} aria-hidden="true" />
          {s.githubRepo}
        </span>
      ) : null}
      {any ? null : <span className={cn(chip, 'bg-success-soft text-success')}>Al día</span>}
    </div>
  )
}

/**
 * Tarjeta de proyecto (ADR-0055). Una sola para los tres tamaños: en tablet y ordenador lleva portada y las dos
 * próximas tareas; en el teléfono es compacta, con el icono, una línea de resumen y las acciones abajo.
 * Diseño: lienzo «Muninn — Móvil 2.0» (P-Escritorio, P-Tablet, Proyectos).
 */
function ProjectCard({ project, s, today }: { project: Project; s?: Stats; today: string }) {
  const shell = useShell()
  const look = { ...project, imagePath: project.imagePath ?? null }
  return (
    <li>
      <Card className="relative flex h-full flex-col overflow-hidden transition-colors hover:border-border-strong">
        <ProjectCover project={look} className="hidden h-24 md:block" />
        <div className="flex flex-1 flex-col gap-3.5 p-4">
          <div className="flex items-start gap-3">
            <ProjectAvatar
              project={look}
              size="md"
              className="md:relative md:z-10 md:-mt-10 md:border-2 md:border-surface md:shadow-popover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 max-md:self-center">
              {/* El nombre lleva el enlace; su `::after` cubre la tarjeta para que se pueda tocar entera. */}
              <Link
                to="/proyectos/$projectId"
                params={{ projectId: project.id }}
                className="truncate text-lg font-semibold after:absolute after:inset-0 md:text-md"
              >
                {project.name}
              </Link>
              <span className="text-xs text-fg-subtle md:hidden">
                {s
                  ? `${plural(s.open, 'abierta', 'abiertas')} · ${plural(s.done, 'hecha', 'hechas')} · ${timeAgo(s.lastActivityAt)}`
                  : 'Sin tareas todavía'}
              </span>
              {project.description ? (
                <p className="line-clamp-2 text-sm text-fg-muted max-md:hidden">
                  {project.description}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => shell.openEditProject(project)}
                  className="relative z-10 self-start text-sm text-fg-faint transition-colors hover:text-fg max-md:hidden"
                >
                  + Añade una descripción
                </button>
              )}
            </div>
            <IconButton
              aria-label={`Editar ${project.name}`}
              icon={<icons.edit />}
              onClick={() => shell.openEditProject(project)}
              className="relative z-10 -mt-1 -mr-1 max-md:hidden"
            />
          </div>

          {project.description ? (
            <p className="line-clamp-2 text-sm text-fg-muted md:hidden">{project.description}</p>
          ) : null}

          {s ? (
            <>
              <div className="flex flex-col gap-2">
                <StateBar s={s} />
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle max-md:hidden">
                  {KINDS.filter((k) => s.byKind[k.key]).map((k) => (
                    <span key={k.key} className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className={cn('size-[7px] rounded-xs', k.bar)} />
                      {plural(s.byKind[k.key], k.one, k.many)}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-[7px] rounded-xs bg-kind-done" />
                    {plural(s.done, 'hecha', 'hechas')}
                  </span>
                </div>
              </div>
              <Chips s={s} />
              {s.next.length ? (
                <div className="-mx-4 flex flex-col border-t border-border-subtle pt-1">
                  <span className="px-4 pt-2 pb-1 text-2xs font-semibold tracking-wider text-fg-faint uppercase">
                    Lo próximo
                  </span>
                  {s.next.map((t, i) => (
                    <Link
                      key={t.id}
                      to="/proyectos/$projectId/tareas/$taskId"
                      params={{ projectId: project.id, taskId: t.id }}
                      className={cn(
                        'relative z-10 flex min-h-10 items-center gap-2.5 px-4 text-sm transition-colors hover:bg-surface-hover md:min-h-8',
                        i > 0 && 'max-md:hidden',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {t.dueDate ? (
                        <DueDate due={t.dueDate} today={today} className="shrink-0 text-xs" />
                      ) : (
                        <span className="shrink-0 text-xs text-fg-faint">Sin fecha</span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="relative z-10 flex items-center border-t border-border-subtle bg-surface-sunken text-xs text-fg-faint md:gap-2 md:px-4 md:py-1.5">
          {s ? <span className="max-md:hidden">Actividad {timeAgo(s.lastActivityAt)}</span> : null}
          <span className="flex-1 max-md:hidden" />
          <Button
            variant="ghost"
            size="sm"
            className="text-accent hover:text-accent-hover max-md:h-11 max-md:flex-1 max-md:text-sm"
            onClick={() => shell.openNewTask({ projectId: project.id })}
          >
            <Icon name="plus" />
            Tarea
          </Button>
          <span aria-hidden="true" className="h-6 w-px bg-border-subtle md:hidden" />
          <Button
            variant="ghost"
            size="sm"
            className="h-11 flex-1 text-sm md:hidden"
            onClick={() => shell.openEditProject(project)}
          >
            <Icon name="edit" />
            Editar
          </Button>
        </div>
      </Card>
    </li>
  )
}

function Archived() {
  const m = useMuninn()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const archived = useQuery(archivedProjectsQuery(m)).data ?? []
  if (!archived.length) return null
  return (
    <section aria-label="Archivados" className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 self-start rounded-md px-1 text-sm font-medium text-fg-muted transition-colors hover:text-fg md:min-h-8"
      >
        <icons.chevronRight
          aria-hidden="true"
          className={cn('transition-transform', open && 'rotate-90')}
        />
        Archivados
        <span className="text-fg-faint tabular">{archived.length}</span>
      </button>
      {open ? (
        <Card className="overflow-hidden">
          <ul>
            {archived.map((p) => (
              <li
                key={p.id}
                className="flex min-h-14 items-center gap-3 border-t border-border-subtle px-4 first:border-t-0 md:min-h-12"
              >
                <ProjectAvatar project={p} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <Button
                  size="sm"
                  className="max-md:h-10"
                  onClick={() => unarchiveProjectWithUndo(m, qc, p)}
                >
                  Recuperar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  )
}

export function Proyectos() {
  const m = useMuninn()
  const shell = useShell()
  const modules = useEnabledModules()
  const desktop = useIsDesktop()
  const githubOn = modules?.has('github') ?? false
  const { data: projects } = useQuery(projectsQuery(m))
  const { data: overview } = useQuery(overviewQuery(m))
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('urgency')
  const [search, setSearch] = useState('')
  useDocumentTitle('Proyectos')

  const stats = new Map(overview?.projects.map((p) => [p.id, p]))
  const today = overview?.today ?? m.today()
  const all = projects ?? []
  const tests: Record<Filter, (p: Project) => boolean> = {
    all: () => true,
    overdue: (p) => (stats.get(p.id)?.overdue ?? 0) > 0,
    github: (p) => Boolean(p.githubRepo),
  }
  const needle = search.trim().toLocaleLowerCase('es')
  const shown = all
    .filter(tests[filter])
    .filter((p) => !needle || p.name.toLocaleLowerCase('es').includes(needle))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'es')
        : sort === 'activity'
          ? (stats.get(b.id)?.lastActivityAt ?? '').localeCompare(
              stats.get(a.id)?.lastActivityAt ?? '',
            )
          : byUrgency(stats.get(a.id), stats.get(b.id)),
    )
  const openTasks = overview?.projects.reduce((n, p) => n + p.open, 0) ?? 0
  const overdue = overview?.projects.reduce((n, p) => n + p.overdue, 0) ?? 0

  const newButton = (
    <Button variant="primary" onClick={shell.openNewProject}>
      <Icon name="plus" />
      Nuevo proyecto
    </Button>
  )

  return (
    <Page>
      <header className="flex items-start gap-3 md:flex-wrap md:items-end md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          {all.length ? (
            <p className="text-base text-fg-muted">
              {plural(all.length, 'activo', 'activos')}
              <span className="max-md:hidden">
                {' '}
                · {plural(openTasks, 'tarea abierta', 'tareas abiertas')}
              </span>
              {overdue ? (
                <>
                  {' · '}
                  <span className="text-danger">{plural(overdue, 'vencida', 'vencidas')}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {all.length ? (
          <>
            <div className="flex shrink-0 gap-2 md:hidden">
              <IconButton
                variant="primary"
                size="lg"
                aria-label="Nuevo proyecto"
                icon={<Icon name="plus" size={20} />}
                onClick={shell.openNewProject}
              />
            </div>
            <div className="hidden items-end gap-2 md:flex">
              <TextField
                label="Buscar proyecto"
                hideLabel
                type="search"
                placeholder="Buscar proyecto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              {newButton}
            </div>
          </>
        ) : null}
      </header>

      {projects && projects.length === 0 ? (
        <EmptyState
          icon="projects"
          title="Todavía no hay proyectos"
          actions={newButton}
          preview={
            <div className="flex gap-3 pb-6">
              {['bg-kind-backlog', 'bg-kind-todo', 'bg-kind-in-progress', 'bg-kind-review'].map(
                (c) => (
                  <div key={c} className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-xs ${c}`} />
                      <Ghost className="h-2 w-12" />
                    </div>
                    <Ghost className="h-12" />
                    <Ghost className="h-9" />
                  </div>
                ),
              )}
            </div>
          }
        >
          Un proyecto agrupa tareas en un tablero Kanban. Ponle una imagen y una descripción para
          reconocerlo de un vistazo, y vincúlalo a un repositorio de GitHub si quieres.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<Filter>
              aria-label="Filtrar proyectos"
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: 'all', label: `Todos · ${all.length}` },
                { value: 'overdue', label: `Con vencidas · ${all.filter(tests.overdue).length}` },
                ...(githubOn
                  ? [
                      {
                        value: 'github' as const,
                        label: `Con GitHub · ${all.filter(tests.github).length}`,
                      },
                    ]
                  : []),
              ]}
              className="max-md:w-full"
              fill={!desktop}
            />
            <span className="flex-1 max-md:hidden" />
            <SelectMenu<Sort>
              label="Orden"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'urgency', label: 'Urgencia' },
                { value: 'activity', label: 'Actividad reciente' },
                { value: 'name', label: 'Nombre' },
              ]}
              className="max-md:hidden"
            />
          </div>

          {!projects ? (
            <div
              aria-hidden="true"
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {[0, 1, 2].map((i) => (
                <Ghost key={i} className="h-64" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
              {needle
                ? `Ningún proyecto se llama «${search.trim()}».`
                : 'Ningún proyecto con este filtro.'}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {shown.map((p) => (
                <ProjectCard key={p.id} project={p} s={stats.get(p.id)} today={today} />
              ))}
            </ul>
          )}
          <Archived />
        </>
      )}
    </Page>
  )
}
