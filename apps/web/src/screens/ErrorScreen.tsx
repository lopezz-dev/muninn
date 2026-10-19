import { Button } from '@muninn/ui'
import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'
import { EmptyState, Page, PageHeader } from '../components/Page'

/**
 * Error al cargar o pintar una pantalla (chunk que no llega tras desplegar, fallo inesperado).
 * Va en el bundle inicial y sustituye al aviso en inglés de TanStack Router.
 */
export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const message = error instanceof Error ? error.message : String(error)
  // Tras un despliegue, los chunks antiguos dejan de existir: recargar trae los nuevos.
  const isStaleChunk = /dynamically imported module|Importing a module script failed/i.test(message)
  return (
    <Page>
      <PageHeader title="Algo ha fallado" />
      <EmptyState
        icon="warning"
        title={
          isStaleChunk ? 'Hay una versión nueva de Muninn' : 'No se pudo mostrar esta pantalla'
        }
        actions={
          <>
            <Button
              variant="primary"
              onClick={() => {
                if (isStaleChunk) location.reload()
                else {
                  reset()
                  router.invalidate()
                }
              }}
            >
              {isStaleChunk ? 'Recargar' : 'Reintentar'}
            </Button>
            <Button asChild>
              <Link to="/">Ir a Inicio</Link>
            </Button>
          </>
        }
      >
        {isStaleChunk
          ? 'Recarga para seguir con la última versión.'
          : `Tus datos no se han tocado. Detalle: ${message}`}
      </EmptyState>
    </Page>
  )
}
