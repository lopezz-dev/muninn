import {
  Button,
  ColorDot,
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
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Outlet, useMatch, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'
import { useMuninn } from '../lib/muninn'
import { archiveProjectWithUndo, boardQuery, projectQuery } from '../lib/queries'
import { useIsDesktop } from '../lib/use-media'
import { useShell } from '../shell/shell-context'
import { BoardDesktop } from './tablero/BoardDesktop'
import { BoardMobile } from './tablero/BoardMobile'

const route = getRouteApi('/_app/proyectos/$projectId')

/** Tablero Kanban de un proyecto (Tablero.dc.html y M-Tablero.dc.html). El detalle de tarea cuelga de aquí. */
export function Tablero() {
  const { projectId } = route.useParams()
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const shell = useShell()
  const desktop = useIsDesktop()
  const project = useQuery(projectQuery(m, projectId))
  const board = useQuery({ ...boardQuery(m, projectId), enabled: project.isSuccess })
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
    if (await archiveProjectWithUndo(m, qc, p.id, p.name)) navigate({ to: '/proyectos' })
  }

  return (
    <Page className="max-w-none">
      <nav aria-label="Ruta" className="-mb-2 flex items-center gap-1.5 text-sm text-fg-subtle">
        <Link to="/proyectos" className="transition-colors hover:text-fg">
          Proyectos
        </Link>
        <icons.chevronRight size={12} aria-hidden="true" />
        <span className="text-fg">{p.name}</span>
      </nav>
      <PageHeader
        title={p.name}
        leading={<ColorDot color={p.color} className="size-3" />}
        description={p.description || undefined}
        actions={
          <>
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
                <MenuItem icon={<icons.link />} onSelect={copyLink}>
                  Copiar enlace
                </MenuItem>
                <MenuItem icon={<icons.archive />} onSelect={archive}>
                  Archivar proyecto
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      {board.data ? (
        desktop ? (
          <BoardDesktop projectId={p.id} board={board.data} today={m.today()} />
        ) : (
          <BoardMobile projectId={p.id} board={board.data} today={m.today()} />
        )
      ) : board.isError ? (
        <EmptyState icon="warning" title="No se pudo cargar el tablero">
          Comprueba tu conexión e inténtalo de nuevo.
        </EmptyState>
      ) : (
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
      )}

      <Outlet />
    </Page>
  )
}
