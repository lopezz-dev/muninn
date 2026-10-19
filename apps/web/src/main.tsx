import '@muninn/ui/fonts.css'
import './index.css'
import { applyAppearance, IconDefaults, Toaster, TooltipProvider } from '@muninn/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { appearanceStore } from './lib/appearance'
import { router } from './router'

const queryClient = new QueryClient()

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
