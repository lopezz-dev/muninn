import '@muninn/ui/fonts.css'
import './index.css'
import { applyAppearance, DEFAULT_APPEARANCE, IconDefaults, TooltipProvider } from '@muninn/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const queryClient = new QueryClient()

// Antes del primer render para no parpadear entre sólido y cristal.
applyAppearance(DEFAULT_APPEARANCE)

const root = document.getElementById('root')
if (!root) throw new Error('#root no existe')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <IconDefaults>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </IconDefaults>
    </QueryClientProvider>
  </StrictMode>,
)
