import { Button } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { EmptyState, Page, PageHeader } from '../components/Page'

/** Ruta desconocida. Va en el bundle inicial: es la que se ve si un chunk no existe. */
export function NotFound() {
  return (
    <Page>
      <PageHeader title="No encontrado" />
      <EmptyState
        icon="warning"
        title="Esta página no existe"
        actions={
          <Button asChild variant="primary">
            <Link to="/">Ir a Inicio</Link>
          </Button>
        }
      >
        Puede que el enlace sea antiguo o que lo que buscabas se haya archivado.
      </EmptyState>
    </Page>
  )
}
