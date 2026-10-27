import '@muninn/ui/fonts.css'
import './index.css'
import { applyAppearance, IconDefaults, Toaster, TooltipProvider } from '@muninn/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { appearanceStore } from './lib/appearance'
import { queryClient } from './lib/query-client'
import { router } from './router'

// Antes del primer render para no parpadear entre sólido y cristal ni entre acentos.
applyAppearance(appearanceStore.get())

const root = document.getElementById('root')
if (!root) throw new Error('#root no existe')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <IconDefaults>
        <TooltipProvider>
          <RouterProvider router={router} />
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
