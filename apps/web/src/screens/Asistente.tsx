import { Button, Card, Icon } from '@muninn/ui'
import { getRouteApi, Link } from '@tanstack/react-router'
import { EmptyState, Page, PageHeader } from '../components/Page'

const route = getRouteApi('/asistente')

export function Asistente() {
  const { q } = route.useSearch()
  return (
    <Page>
      <PageHeader title="Asistente" description="Pregunta por tus tareas, notas y finanzas." />
      {q ? (
        <Card className="flex items-start gap-3 p-4">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-raised text-fg-subtle">
            <Icon name="user" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-fg-subtle">Tu pregunta</span>
            <p className="text-base break-words">{q}</p>
          </div>
        </Card>
      ) : null}
      <EmptyState
        icon="assistant"
        title={q ? 'Aún no puedo responderte aquí' : 'Muninn aún no habla desde aquí'}
        soon="Fase 4"
        actions={
          <Button asChild>
            <Link to="/documentacion">Cómo usarlo con Claude</Link>
          </Button>
        }
      >
        El asistente con voz y modelo local llega en la fase 4. Mientras, puedes trabajar con tus
        proyectos desde Claude Desktop o Claude Code con el servidor MCP de Muninn.
      </EmptyState>
    </Page>
  )
}
