import { Button, Card, Icon } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'
import { useMuninn } from '../lib/muninn'
import { overviewQuery } from '../lib/queries'
import { useShell } from '../shell/shell-context'

const greeting = (h: number) =>
  h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'

const dateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <Card className="flex flex-col gap-2 px-4 py-3.5">
      <span className="text-xs font-medium text-fg-subtle">{label}</span>
      <span
        className={`text-[26px] leading-none font-semibold tracking-tight tabular ${tone === 'danger' && value ? 'text-danger' : ''}`}
      >
        {value}
      </span>
    </Card>
  )
}

export function Inicio() {
  const m = useMuninn()
  const shell = useShell()
  const { data } = useQuery(overviewQuery(m))
  const now = new Date()
  const date = dateFmt.format(now)
  const hasProjects = (data?.projects.length ?? 0) > 0
  const nothingToday = data && data.dueToday.length === 0 && data.overdue.length === 0

  return (
    <Page>
      <PageHeader
        title={greeting(now.getHours())}
        description={`${date.charAt(0).toUpperCase()}${date.slice(1)}`}
        actions={
          <>
            <Button asChild>
              <Link to="/asistente">
                <Icon name="assistant" className="text-accent" />
                Preguntar a Muninn
              </Link>
            </Button>
            <Button variant="primary" onClick={shell.openNewProject}>
              <Icon name="plus" />
              Nuevo proyecto
            </Button>
          </>
        }
      />

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Para hoy" value={data?.dueToday.length ?? 0} />
        <Stat label="En curso" value={data?.inProgress.length ?? 0} />
        <Stat label="Vencidas" value={data?.overdue.length ?? 0} tone="danger" />
        <Stat label="Hechas hoy" value={data?.completedToday ?? 0} />
      </section>

      {!hasProjects ? (
        <EmptyState
          icon="projects"
          title="Empieza por un proyecto"
          actions={
            <Button variant="primary" onClick={shell.openNewProject}>
              <Icon name="plus" />
              Nuevo proyecto
            </Button>
          }
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
      ) : nothingToday ? (
        <EmptyState icon="check" title="Nada pendiente para hoy">
          No tienes tareas que venzan hoy ni atrasadas. Cuando las tengas, aparecerán aquí ordenadas
          por urgencia.
        </EmptyState>
      ) : null}
    </Page>
  )
}
