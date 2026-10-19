import { Button } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'
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
  const s = SECTIONS[section]
  const mod = SECTION_MODULE[section]

  useEffect(() => {
    document.title = `${s.label} · Muninn`
  }, [s.label])

  return (
    <Page>
      <EmptyState
        icon={s.icon}
        title={`${s.label} está desactivado`}
        actions={
          <>
            {mod ? (
              <Button
                variant="primary"
                onClick={() => setModuleEnabled(m, qc, mod, true, { label: s.label, icon: s.icon })}
              >
                Activar {s.label}
              </Button>
            ) : null}
            <Button asChild>
              <Link to="/ajustes/$seccion" params={{ seccion: 'modulos' }}>
                Ir a Módulos
              </Link>
            </Button>
          </>
        }
      >
        No aparece en el menú ni en el buscador. Tus datos siguen guardados: al activarlo vuelven a
        verse.
      </EmptyState>
    </Page>
  )
}
