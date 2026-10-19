import { createContext, useContext } from 'react'

/** Acciones globales del shell que cualquier pantalla puede disparar. */
export interface ShellApi {
  /** Abre el buscador ⌘K, opcionalmente con texto. */
  openPalette: (query?: string) => void
  openNewProject: () => void
}

export const ShellContext = createContext<ShellApi>({
  openPalette: () => {},
  openNewProject: () => {},
})

export const useShell = () => useContext(ShellContext)

/** macOS e iOS usan ⌘; el resto, Ctrl. */
export const isApple =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)

export const PALETTE_SHORTCUT = isApple ? '⌘K' : 'Ctrl K'
