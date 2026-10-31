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

const route = getRouteApi('/_app/proyectos/$projectId')

// La lista y el calendario no viajan con el tablero: solo los descarga quien los abre.
const BoardList = lazy(() =>
  import('./tablero/BoardList').then((mod) => ({ default: mod.BoardList })),
)
const BoardCalendar = lazy(() =>
  import('./tablero/BoardCalendar').then((mod) => ({ default: mod.BoardCalendar })),
)

const VIEWS: { value: BoardView; label: string; icon: ReactNode }[] = [
  { value: 'board', label: 'Tablero', icon: <icons.projects size={14} aria-hidden="true" /> },
  { value: 'list', label: 'Lista', icon: <screenIcons.list size={14} aria-hidden="true" /> },
  { value: 'calendar', label: 'Calendario', icon: <icons.calendar size={14} aria-hidden="true" /> },
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
    from: '/_app/proyectos/$projectId/tareas/$taskId',
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
        <PageHeader title="Tablero" />
        <EmptyState
          icon="projects"
          title="No encontramos este proyecto"
          actions={
            <Button asChild variant="primary">
              <Link to="/proyectos">Ver proyectos</Link>
            </Button>
          }
        >
          Puede que se haya archivado o que el enlace sea de otra cuenta. En modo demo los proyectos
          se pierden al recargar.
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
    if (ok) notify.success('Enlace copiado', { icon: 'link', description: p.name })
    else notify.error('No se pudo copiar el enlace')
  }

  const archive = async () => {
    if (await archiveProjectWithUndo(m, qc, p)) navigate({ to: '/proyectos' })
  }

  return (
    <Page fit>
      <nav aria-label="Ruta" className="-mb-2 flex items-center gap-1.5 text-sm text-fg-subtle">
        <Link to="/proyectos" className="transition-colors hover:text-fg">
          Proyectos
        </Link>
        <icons.chevronRight size={12} aria-hidden="true" />
        <span className="text-fg">{p.name}</span>
      </nav>
      <PageHeader
        title={p.name}
        leading={<ProjectAvatar project={p} size="sm" />}
        description={p.description || undefined}
        actions={
          <>
            {desktop ? (
              <SegmentedControl
                aria-label="Vista"
                value={view}
                onValueChange={changeView}
                options={VIEWS}
                className="self-center"
              />
            ) : null}
            <IconButton
              aria-label={
                activeGroups(filter) ? `Filtrar (${activeGroups(filter)} activos)` : 'Filtrar'
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
                Columna
              </Button>
            ) : null}
            <Button
              variant="primary"
              className="max-md:size-11 max-md:px-0"
              onClick={() => shell.openNewTask({ projectId: p.id })}
            >
              <Icon name="plus" />
              <span className="max-md:sr-only">Nueva tarea</span>
              <Kbd className="max-md:hidden border-accent-fg/30 text-accent-fg">N</Kbd>
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <IconButton
                  aria-label="Opciones del proyecto"
                  icon={<icons.dots />}
                  variant="secondary"
                  className="max-md:size-11"
                />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<icons.edit />} onSelect={() => shell.openEditProject(p)}>
                  Editar proyecto
                </MenuItem>
                <MenuItem icon={<icons.plus />} onSelect={() => setNewColumn(true)}>
                  Nueva columna
                </MenuItem>
                <MenuItem icon={<icons.link />} onSelect={copyLink}>
                  Copiar enlace
                </MenuItem>
                <MenuItem icon={<icons.archive />} onSelect={() => setArchivedOpen(true)}>
                  Tareas archivadas
                </MenuItem>
                <MenuItem icon={<icons.archive />} onSelect={archive}>
                  Archivar proyecto
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
          <SegmentedControl
            aria-label="Vista"
            value={view}
            onValueChange={changeView}
            options={VIEWS}
            size="lg"
            fill
          />
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
        <EmptyState icon="warning" title="No se pudo cargar el tablero">
          Comprueba tu conexión e inténtalo de nuevo.
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
