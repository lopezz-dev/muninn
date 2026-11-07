import { Button } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Page } from '../components/Page'
import { setModuleEnabled } from '../lib/module-actions'
import { useMuninn } from '../lib/muninn'
import { SECTION_MODULE, SECTIONS, type SectionId } from './nav'

/**
 * Lo que se ve al entrar en una sección cuyo módulo está desactivado (con un enlace antiguo, por ejemplo):
 * decirlo y ofrecer activarlo. Se carga en diferido: casi nadie llega aquí.
 */
export function ModuleOff({ section }: { section: SectionId }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const s = SECTIONS[section]
  const mod = SECTION_MODULE[section]

  useEffect(() => {
    document.title = `${s.label} · Muninn`
  }, [s.label])

  return (
    <Page>
      <EmptyState
        icon={s.icon}
        title={t('module.off', { name: s.label })}
        actions={
          <>
            {mod ? (
              <Button
                variant="primary"
                onClick={() => setModuleEnabled(m, qc, mod, true, { label: s.label, icon: s.icon })}
              >
                {t('module.turnOn', { name: s.label })}
              </Button>
            ) : null}
            <Button asChild>
              <Link to="/settings/$seccion" params={{ seccion: 'modules' }}>
                {t('module.goToModules')}
              </Link>
            </Button>
          </>
        }
      >
        {t('module.offHint')}
      </EmptyState>
    </Page>
  )
}
