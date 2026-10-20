import { Button } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'

export function GitHub() {
  return (
    <Page>
      <PageHeader title="GitHub" description="Issues como tareas y agentes que abren PRs." />
      <EmptyState
        icon="github"
        title="Conecta tus repositorios"
        soon="Fase 2"
        actions={
          <Button asChild variant="primary">
            <Link to="/ajustes/$seccion" params={{ seccion: 'integraciones' }}>
              Vincular repositorios
            </Link>
          </Button>
        }
        preview={
          <div className="flex flex-col gap-2 pb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-border p-2.5"
              >
                <span className="size-3 rounded-full border-2 border-kind-done" />
                <Ghost className="h-2.5 flex-1" />
                <Ghost className="h-2.5 w-10" />
              </div>
            ))}
          </div>
        }
      >
        Las issues de cada repositorio entrarán como tareas del proyecto vinculado, y al cerrar una
        se completará la otra. Ya puedes vincular un repositorio a cada proyecto en Ajustes ›
        Integraciones; la sincronización se activa en el servidor y aún no está en marcha. Esta
        pantalla, con los repositorios y los agentes, llegará después.
      </EmptyState>
    </Page>
  )
}
