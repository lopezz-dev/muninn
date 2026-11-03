import { Button } from '@muninn/ui'
import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState, Page, PageHeader } from '../components/Page'

/**
 * Error al cargar o pintar una pantalla (chunk que no llega tras desplegar, fallo inesperado).
 * Va en el bundle inicial y sustituye al aviso en inglés de TanStack Router. Sus textos, en `common` (siempre cargado).
 */
export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const message = error instanceof Error ? error.message : String(error)
  // Tras un despliegue, los chunks antiguos dejan de existir: recargar trae los nuevos.
  const isStaleChunk = /dynamically imported module|Importing a module script failed/i.test(message)
  return (
    <Page>
      <PageHeader title={t('errors.failed')} />
      <EmptyState
        icon="warning"
        title={isStaleChunk ? t('errors.newVersion') : t('errors.cantShow')}
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
              {isStaleChunk ? t('errors.reload') : t('errors.retry')}
            </Button>
            <Button asChild>
              <Link to="/">{t('errors.goHome')}</Link>
            </Button>
          </>
        }
      >
        {isStaleChunk ? t('errors.reloadHint') : t('errors.detail', { message })}
      </EmptyState>
    </Page>
  )
}
