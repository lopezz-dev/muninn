import { Button } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState, Page, PageHeader } from '../components/Page'
import { useNoIndex } from '../lib/seo'

/** Ruta desconocida. Va en el bundle inicial: es la que se ve si un chunk no existe (textos en `common`, siempre cargado). */
export function NotFound() {
  const { t } = useTranslation()
  // La app responde 200 a cualquier ruta: sin esto, Google indexaría la página de «no existe».
  useNoIndex()
  return (
    <Page>
      <PageHeader title={t('errors.notFound')} />
      <EmptyState
        icon="warning"
        title={t('errors.notFoundTitle')}
        actions={
          <Button asChild variant="primary">
            <Link to="/">{t('errors.goHome')}</Link>
          </Button>
        }
      >
        {t('errors.notFoundHint')}
      </EmptyState>
    </Page>
  )
}
