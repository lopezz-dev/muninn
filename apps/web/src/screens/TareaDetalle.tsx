import {
  Button,
  ColorDot,
  columnKinds,
  copyText,
  Dialog,
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  notify,
  SheetContent,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { EmptyState, Page } from '../components/Page'
import { SelectMenu } from '../components/SelectMenu'
import { useMuninn } from '../lib/muninn'
import { boardQuery, projectQuery } from '../lib/queries'
import { archiveTask, completeTask, moveTask, reopenTask } from '../lib/task-actions'
import { useIsDesktop } from '../lib/use-media'
import { TaskBody } from './tarea/TaskBody'

const route = getRouteApi('/_app/proyectos/$projectId/tareas/$taskId')

/**
 * Detalle de una tarea (Tarea.dc.html y M-Tarea.dc.html). Una sola ruta con dos presentaciones: panel
 * lateral sobre el tablero en escritorio y pantalla completa en móvil. El tablero (`Tablero.tsx`) es
 * quien decide si se pinta debajo.
 */
export function TareaDetalle() {
  const { projectId, taskId } = route.useParams()
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const project = useQuery(projectQuery(m, projectId)).data
  const board = useQuery(boardQuery(m, projectId))
  const task = board.data?.tasks.find((t) => t.id === taskId)

  useEffect(() => {
    if (task) document.title = `${task.title} · Muninn`
  }, [task])

  const close = () => navigate({ to: '/proyectos/$projectId', params: { projectId } })

  if (!board.data) return null
  if (!task) {
    return desktop ? (
      <Dialog open onOpenChange={(o) => !o && close()}>
        <SheetContent title="Tarea no encontrada">
          <Missing projectId={projectId} />
        </SheetContent>
      </Dialog>
    ) : (
      <Page>
        <Missing projectId={projectId} />
      </Page>
    )
  }

  const done = task.column.kind === 'done'
  const copyLink = async () => {
    const ok = await copyText(location.href)
    if (ok) notify.success('Enlace copiado', { icon: 'link', description: task.title })
    else notify.error('No se pudo copiar el enlace')
  }
  const archive = async () => {
    if (await archiveTask(m, qc, task)) close()
  }
  const toggleDone = () => (done ? reopenTask(m, qc, task) : completeTask(m, qc, task))

  const actions = (size?: 'lg') => (
    <>
      <IconButton aria-label="Copiar enlace" icon={<icons.link />} size={size} onClick={copyLink} />
      <Menu>
        <MenuTrigger asChild>
          <IconButton aria-label="Más acciones" icon={<icons.dots />} size={size} />
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<icons.link />} onSelect={copyLink}>
            Copiar enlace
          </MenuItem>
          <MenuItem icon={<icons.archive />} onSelect={archive}>
            Archivar tarea
          </MenuItem>
        </MenuContent>
      </Menu>
    </>
  )

  if (desktop) {
    return (
      <Dialog open onOpenChange={(o) => !o && close()}>
        <SheetContent
          title={
            <span className="flex items-center gap-1.5">
              {project ? <ColorDot color={project.color} /> : null}
              {project?.name}
              <icons.chevronRight size={12} aria-hidden="true" />
              {task.column.name}
            </span>
          }
          toolbar={actions()}
          footer={
            <Button variant="primary" className="ml-auto h-9 px-4" onClick={toggleDone}>
              <icons.check size={14} weight="bold" />
              {done ? 'Reabrir' : 'Completar'}
            </Button>
          }
        >
          <TaskBody task={task} board={board.data} />
        </SheetContent>
      </Dialog>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Button asChild variant="secondary" className="size-11 px-0">
          <Link to="/proyectos/$projectId" params={{ projectId }} aria-label="Volver al tablero">
            <icons.chevronLeft size={18} />
          </Link>
        </Button>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-fg-subtle">
          {project ? <ColorDot color={project.color} /> : null}
          <span className="truncate">{project?.name}</span>
        </span>
        {actions('lg')}
      </header>

      <TaskBody task={task} board={board.data} touch />

      <div className="glass fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-border-subtle px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
        <SelectMenu
          label="Mover a"
          buttonText="Mover a…"
          large
          className="h-12 flex-1 justify-center text-md"
          value={task.columnId}
          options={board.data.columns.map((c) => ({
            value: c.id,
            label: c.name,
            dot: columnKinds[c.kind],
          }))}
          onChange={(columnId) => {
            if (columnId !== task.columnId) {
              void moveTask(m, qc, { projectId, taskId: task.id, columnId })
            }
          }}
        />
        <Button
          variant="primary"
          size="lg"
          className="h-12 flex-[1.3] text-md"
          onClick={toggleDone}
        >
          <icons.check size={16} weight="bold" />
          {done ? 'Reabrir' : 'Completar'}
        </Button>
      </div>
    </div>
  )
}

function Missing({ projectId }: { projectId: string }) {
  return (
    <EmptyState
      icon="notes"
      title="No encontramos esta tarea"
      actions={
        <Button asChild variant="primary">
          <Link to="/proyectos/$projectId" params={{ projectId }}>
            Volver al tablero
          </Link>
        </Button>
      }
    >
      Puede que se haya archivado o que el enlace sea de otra cuenta.
    </EmptyState>
  )
}
