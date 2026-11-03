import '@muninn/ui/fonts.css'
import './index.css'
import { applyAppearance, IconDefaults, Toaster, TooltipProvider } from '@muninn/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Fragment, type ReactNode, StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
// Antes que nada que pinte texto: el primer pintado ya sale en su idioma (ADR-0077).
import { i18n } from './i18n'
import { appearanceStore } from './lib/appearance'
import { queryClient } from './lib/query-client'
import { router } from './router'

// Antes del primer render para no parpadear entre sólido y cristal ni entre acentos.
applyAppearance(appearanceStore.get())

/**
 * Al cambiar de idioma se vuelve a montar la app entera (ADR-0077): así cambia también lo que lee `t()` fuera de un
 * componente (etiquetas de `nav.ts`). El router y la caché viven fuera de React y no se pierden.
 */
function LanguageRoot({ children }: { children: ReactNode }) {
  const lng = useSyncExternalStore(
    (cb) => {
      i18n.on('languageChanged', cb)
      return () => i18n.off('languageChanged', cb)
    },
    () => i18n.language,
  )
  return <Fragment key={lng}>{children}</Fragment>
}

const root = document.getElementById('root')
if (!root) throw new Error('#root no existe')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <IconDefaults>
        <TooltipProvider>
          <LanguageRoot>
            <RouterProvider router={router} />
          </LanguageRoot>
          <Toaster />
        </TooltipProvider>
      </IconDefaults>
    </QueryClientProvider>
  </StrictMode>,
)

// App de escritorio compilada: busca una versión nueva al abrir (ADR-0047). En `tauri dev` y en la web, nunca.
if (import.meta.env.TAURI_ENV_PLATFORM && import.meta.env.PROD) {
  void import('./lib/desktop-update').then((m) => m.checkForUpdate())
}
