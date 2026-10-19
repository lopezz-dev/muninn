import type { ColumnKind } from '@muninn/core'
import {
  Button,
  ColorDot,
  copyText,
  Icon,
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  notify,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { EmptyState, Page, PageHeader } from '../components/Page'
import { useMuninn } from '../lib/muninn'
import { archiveProjectWithUndo, columnsQuery, projectQuery, tasksQuery } from '../lib/queries'

const route = getRouteApi('/proyectos/$projectId')

const KIND_BG: Record<ColumnKind, string> = {
  backlog: 'bg-kind-backlog',
  todo: 'bg-kind-todo',
  in_progress: 'bg-kind-in-progress',
  review: 'bg-kind-review',
  done: 'bg-kind-done',
}

export function Tablero() {
  const { projectId } = route.useParams()
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const project = useQuery(projectQuery(m, projectId))
  const columns = useQuery({ ...columnsQuery(m, projectId), enabled: project.isSuccess })
  const tasks = useQuery({ ...tasksQuery(m, projectId), enabled: project.isSuccess })
  const countIn = (columnId: string) =>
    tasks.data?.filter((t) => t.columnId === columnId).length ?? 0

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
          Puede que se haya archivado o que el enlace sea de otra sesión. En modo demo los proyectos
          se pierden al recargar.
        </EmptyState>
      </Page>
    )
  }
  const p = project.data
  if (!p) return null

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
      <PageHeader
        title={p.name}
        leading={<ColorDot color={p.color} className="size-3" />}
        description={p.description || 'Tablero Kanban'}
        actions={
          <Menu>
            <MenuTrigger asChild>
              <IconButton aria-label="Opciones del proyecto" icon={<icons.dots />} />
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
        }
      />

      <section
        aria-label="Columnas"
        className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0"
      >
        {columns.data?.map((c) => (
          <div
            key={c.id}
            className="flex w-[272px] shrink-0 snap-start flex-col gap-2 rounded-lg bg-surface-sunken p-2"
          >
            <h2 className="flex h-8 items-center gap-2 px-1.5 text-sm font-semibold">
              <span aria-hidden="true" className={`size-2 rounded-xs ${KIND_BG[c.kind]}`} />
              {c.name}
              <span className="text-xs font-normal text-fg-faint tabular">{countIn(c.id)}</span>
            </h2>
            <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-border-strong px-4 text-center text-xs text-fg-faint">
              {countIn(c.id) ? `${countIn(c.id)} tareas` : 'Sin tareas'}
            </div>
          </div>
        ))}
      </section>

      <p className="flex items-center gap-2 text-sm text-fg-subtle">
        <Icon name="info" />
        Crear y mover tareas desde el tablero llega en el siguiente paso.
      </p>
    </Page>
  )
}
