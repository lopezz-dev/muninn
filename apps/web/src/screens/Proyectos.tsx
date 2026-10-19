import { Button, Card, ColorDot, Icon, ProgressBar } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'
import { useMuninn } from '../lib/muninn'
import { overviewQuery, projectsQuery } from '../lib/queries'
import { useShell } from '../shell/shell-context'

export function Proyectos() {
  const m = useMuninn()
  const shell = useShell()
  const { data: projects } = useQuery(projectsQuery(m))
  const { data: overview } = useQuery(overviewQuery(m))
  const stats = new Map(overview?.projects.map((p) => [p.id, p]))

  const newButton = (
    <Button variant="primary" onClick={shell.openNewProject}>
      <Icon name="plus" />
      Nuevo proyecto
    </Button>
  )

  return (
    <Page>
      <PageHeader
        title="Proyectos"
        description="Cada proyecto tiene su tablero, con columnas a tu medida."
        actions={projects?.length ? newButton : undefined}
      />
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
          Un proyecto agrupa tareas en un tablero Kanban. Puedes vincularlo a un repositorio de
          GitHub más adelante.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects?.map((p) => {
            const s = stats.get(p.id)
            const total = (s?.open ?? 0) + (s?.done ?? 0)
            return (
              <li key={p.id}>
                <Card className="transition-colors hover:border-border-strong">
                  <Link
                    to="/proyectos/$projectId"
                    params={{ projectId: p.id }}
                    className="flex flex-col gap-3 rounded-lg p-4"
                  >
                    <span className="flex items-center gap-2 text-md font-semibold">
                      <ColorDot color={p.color} />
                      {p.name}
                    </span>
                    {p.description ? (
                      <span className="line-clamp-2 text-sm text-fg-muted">{p.description}</span>
                    ) : null}
                    <span className="text-xs text-fg-subtle tabular">
                      {total ? `${s?.done ?? 0} de ${total} hechas` : 'Sin tareas todavía'}
                    </span>
                    <ProgressBar
                      value={total ? (s?.done ?? 0) / total : 0}
                      color={p.color}
                      label={`Progreso de ${p.name}`}
                    />
                  </Link>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}
