import {
  Button,
  cn,
  copyText,
  Icon,
  IconButton,
  icons,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  notify,
  SegmentedControl,
  screenIcons,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Outlet, useMatch, useNavigate } from '@tanstack/react-router'
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'
import { ProjectAvatar } from '../components/ProjectAvatar'
import { activeGroups, type BoardFilter, labelsOf, NO_FILTER } from '../lib/board-filter'
import { useBoardGroups } from '../lib/board-groups'
import {
  type BoardView,
  readBoardView,
  readCalendarFolded,
  readCalendarScale,
  saveBoardView,
} from '../lib/board-view'
import type { CalendarScale } from '../lib/calendar'
import { useMuninn } from '../lib/muninn'
import { archiveProjectWithUndo, boardQuery, projectQuery } from '../lib/queries'
import { useIsDesktop } from '../lib/use-media'
import { useShell } from '../shell/shell-context'
import { ArchivedTasks } from './tablero/ArchivedTasks'
import { BoardDesktop } from './tablero/BoardDesktop'
import { BoardMobile } from './tablero/BoardMobile'
import { ColumnDialog } from './tablero/ColumnDialog'
import { FilterBar, FilterSheet, FilterSummary } from './tablero/FilterBar'

const route = getRouteApi('/_app/projects/$projectId')

// La lista y el calendario no viajan con el tablero: solo los descarga quien los abre.
const BoardList = lazy(() =>
  import('./tablero/BoardList').then((mod) => ({ default: mod.BoardList })),
)
const BoardCalendar = lazy(() =>
  import('./tablero/BoardCalendar').then((mod) => ({ default: mod.BoardCalendar })),
)

const VIEW_ICONS: { value: BoardView; icon: (size: number) => ReactNode }[] = [
  { value: 'board', icon: (size) => <icons.projects size={size} aria-hidden="true" /> },
  { value: 'list', icon: (size) => <screenIcons.list size={size} aria-hidden="true" /> },
  { value: 'calendar', icon: (size) => <icons.calendar size={size} aria-hidden="true" /> },
]

/** Mientras llega el calendario: su rejilla de verdad, con fantasmas, para que no salte de alto. */
function CalendarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid min-h-[560px] flex-1 grid-cols-7 grid-rows-6 overflow-hidden rounded-lg border border-border-subtle"
    >
      {Array.from({ length: 42 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: celdas fijas de relleno
          key={i}
          className="flex flex-col gap-1.5 border-t border-r border-border-subtle p-1.5"
        >
          <Ghost className="h-3 w-4" />
          {i % 3 === 0 ? null : <Ghost className={i % 2 ? 'h-4 w-4/5' : 'h-4 w-3/5'} />}
        </div>
      ))}
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-3 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex w-[280px] shrink-0 flex-col gap-2 rounded-lg bg-surface-sunken p-2"
        >
          <Ghost className="h-5 w-24" />
          <Ghost className="h-16" />
          <Ghost className="h-12" />
        </div>
      ))}
    </div>
  )
}

/** Tablero Kanban de un proyecto (Tablero.dc.html y M-Tablero.dc.html). El detalle de tarea cuelga de aquí. */
export function Tablero() {
  const { projectId } = route.useParams()
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const shell = useShell()
  const desktop = useIsDesktop()
  const { t } = useTranslation(['board', 'common', 'task'])
  // Las vistas con su nombre en el idioma activo. En el móvil, solo los iconos (el nombre queda para el lector
  // de pantalla).
  const views = VIEW_ICONS.map((v) => ({
    value: v.value,
    label: t(`views.${v.value}`),
    icon: v.icon(14),
  }))
  const compactViews = VIEW_ICONS.map((v) => ({
    value: v.value,
    label: <span className="sr-only">{t(`views.${v.value}`)}</span>,
    icon: v.icon(18),
  }))
  // Los filtros viven aquí, en la ruta padre: sobreviven a abrir y cerrar una tarea.
  const [filter, setFilter] = useState<BoardFilter>(NO_FILTER)
  const [sheet, setSheet] = useState(false)
  const [newColumn, setNewColumn] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  // Tablero, Lista o Calendario (con su escala y, en el móvil, el mes plegado o no), recordado por proyecto en
  // este dispositivo (`lib/board-view.ts`).
  const [view, setView] = useState<BoardView>(() => readBoardView(projectId))
  const [scale, setScale] = useState<CalendarScale>(() => readCalendarScale(projectId))
  const [folded, setFolded] = useState(() => readCalendarFolded(projectId))
  useEffect(() => {
    setView(readBoardView(projectId))
    setScale(readCalendarScale(projectId))
    setFolded(readCalendarFolded(projectId))
  }, [projectId])
  const changeView = (next: BoardView) => {
    setView(next)
    saveBoardView(projectId, next, undefined, scale, folded)
  }
  const changeScale = (next: CalendarScale) => {
    setScale(next)
    saveBoardView(projectId, 'calendar', undefined, next, folded)
  }
  const changeFolded = (next: boolean) => {
    setFolded(next)
    saveBoardView(projectId, 'calendar', undefined, scale, next)
  }
  const project = useQuery(projectQuery(m, projectId))
  const board = useQuery({ ...boardQuery(m, projectId), enabled: project.isSuccess })
  const tasks = board.data?.tasks
  const labels = useMemo(() => labelsOf(tasks ?? []), [tasks])
  // El mismo reparto que pinta la vista (memorizado igual): aquí solo se cuenta.
  const shown = useBoardGroups(board.data, filter, m.today()).visible.length
  const openTask = useMatch({
    from: '/_app/projects/$projectId/tasks/$taskId',
    shouldThrow: false,
  })?.params.taskId

  // Al cerrar el panel, el foco vuelve a la tarjeta de la que se abrió.
  const lastTask = useRef<string>(undefined)
  useEffect(() => {
    if (openTask) {
      lastTask.current = openTask
      return
    }
    const id = lastTask.current
    lastTask.current = undefined
    if (id) document.querySelector<HTMLElement>(`[data-task-id="${id}"]`)?.focus()
  }, [openTask])

  if (project.isError) {
    return (
      <Page>
        <PageHeader title={t('views.board')} />
        <EmptyState
          icon="projects"
          title={t('notFound.title')}
          actions={
            <Button asChild variant="primary">
              <Link to="/projects">{t('notFound.action')}</Link>
            </Button>
          }
        >
          {t('notFound.body')}
        </EmptyState>
      </Page>
    )
  }
  const p = project.data
  if (!p) return null

  // En móvil el detalle ocupa toda la pantalla: el tablero se queda debajo, sin pintarse.
  if (openTask && !desktop) return <Outlet />

  const copyLink = async () => {
    const ok = await copyText(location.href)
    if (ok)
      notify.success(t('link.copied', { ns: 'common' }), { icon: 'link', description: p.name })
    else notify.error(t('link.copyFailed', { ns: 'common' }))
  }

  const archive = async () => {
    if (await archiveProjectWithUndo(m, qc, p)) navigate({ to: '/projects' })
  }

  return (
    <Page fit>
      {desktop ? (
        <nav
          aria-label={t('breadcrumb')}
          className="-mb-2 flex items-center gap-1.5 text-sm text-fg-subtle"
        >
          <Link to="/projects" className="transition-colors hover:text-fg">
            {t('nav.projects', { ns: 'common' })}
          </Link>
          <icons.chevronRight size={12} aria-hidden="true" />
          <span className="text-fg">{p.name}</span>
        </nav>
      ) : (
        // Móvil (lienzo «Muninn — Móvil 2.0»): la ruta se queda en «‹ Proyectos» (el nombre ya es el título) y el
        // selector de vista, solo con iconos, comparte su fila. Así la cabecera son dos filas y no tres.
        <div className="-mb-2 flex items-center justify-between gap-2">
          <Link
            to="/projects"
            className="-ml-1 inline-flex h-11 items-center gap-0.5 pr-2 text-sm text-fg-subtle transition-colors hover:text-fg"
          >
            <icons.chevronLeft size={16} aria-hidden="true" />
            {t('nav.projects', { ns: 'common' })}
          </Link>
          {board.data ? (
            <SegmentedControl
              aria-label={t('views.label')}
              value={view}
              onValueChange={changeView}
              options={compactViews}
              size="lg"
            />
          ) : null}
        </div>
      )}
      <PageHeader
        title={p.name}
        leading={<ProjectAvatar project={p} size="sm" />}
        description={p.description || undefined}
        actions={
          <>
            {desktop ? (
              <SegmentedControl
                aria-label={t('views.label')}
                value={view}
                onValueChange={changeView}
                options={views}
                className="self-center"
              />
            ) : null}
            <IconButton
              aria-label={
                activeGroups(filter)
                  ? t('filter.buttonActive', { count: activeGroups(filter) })
                  : t('filter.button')
              }
              icon={<icons.filter />}
              variant="secondary"
              onClick={() => setSheet(true)}
              className={cn(
                'relative size-11 md:hidden',
                activeGroups(filter) > 0 && 'text-accent',
              )}
            />
            {desktop && view === 'board' ? (
              // Aquí y no al final de las columnas: así no hay que hacer scroll lateral para crear una.
              <Button onClick={() => setNewColumn(true)}>
                <Icon name="plus" />
                {t('header.column')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              className="max-md:size-11 max-md:px-0"
              onClick={() => shell.openNewTask({ projectId: p.id })}
            >
              <Icon name="plus" />
              <span className="max-md:sr-only">{t('header.newTask')}</span>
              <Kbd className="max-md:hidden border-accent-fg/30 text-accent-fg">N</Kbd>
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <IconButton
                  aria-label={t('header.projectOptions')}
                  icon={<icons.dots />}
                  variant="secondary"
                  className="max-md:size-11"
                />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<icons.edit />} onSelect={() => shell.openEditProject(p)}>
                  {t('header.editProject')}
                </MenuItem>
                <MenuItem icon={<icons.plus />} onSelect={() => setNewColumn(true)}>
                  {t('header.newColumn')}
                </MenuItem>
                <MenuItem icon={<icons.link />} onSelect={copyLink}>
                  {t('link.copy', { ns: 'common' })}
                </MenuItem>
                <MenuItem icon={<icons.archive />} onSelect={() => setArchivedOpen(true)}>
                  {t('header.archivedTasks')}
                </MenuItem>
                <MenuItem icon={<icons.archive />} onSelect={archive}>
                  {t('header.archiveProject')}
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      {board.data && desktop ? (
        <FilterBar
          filter={filter}
          onChange={setFilter}
          labels={labels}
          shown={shown}
          total={board.data.tasks.length}
        />
      ) : null}
      {board.data && !desktop ? (
        <>
          <FilterSummary
            filter={filter}
            onClear={() => setFilter(NO_FILTER)}
            shown={shown}
            total={board.data.tasks.length}
          />
          <FilterSheet
            open={sheet}
            onOpenChange={setSheet}
            filter={filter}
            onChange={setFilter}
            labels={labels}
            shown={shown}
          />
        </>
      ) : null}

      {board.data ? (
        view === 'list' ? (
          <Suspense fallback={<BoardSkeleton />}>
            <BoardList projectId={p.id} board={board.data} today={m.today()} filter={filter} />
          </Suspense>
        ) : view === 'calendar' ? (
          <Suspense fallback={<CalendarSkeleton />}>
            <BoardCalendar
              projectId={p.id}
              board={board.data}
              today={m.today()}
              filter={filter}
              onFilterChange={setFilter}
              scale={scale}
              onScaleChange={changeScale}
              folded={folded}
              onFoldedChange={changeFolded}
              desktop={desktop}
            />
          </Suspense>
        ) : desktop ? (
          <BoardDesktop projectId={p.id} board={board.data} today={m.today()} filter={filter} />
        ) : (
          <BoardMobile projectId={p.id} board={board.data} today={m.today()} filter={filter} />
        )
      ) : board.isError ? (
        <EmptyState icon="warning" title={t('loadFailed.title')}>
          {t('loadFailed.body')}
        </EmptyState>
      ) : view === 'calendar' ? (
        <CalendarSkeleton />
      ) : (
        <BoardSkeleton />
      )}

      <ColumnDialog
        projectId={p.id}
        target={newColumn ? 'new' : null}
        onClose={() => setNewColumn(false)}
      />
      <ArchivedTasks projectId={p.id} open={archivedOpen} onOpenChange={setArchivedOpen} />
      <Outlet />
    </Page>
  )
}
