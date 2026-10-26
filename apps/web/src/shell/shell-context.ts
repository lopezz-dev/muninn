import { createContext, useContext } from 'react'

/** Dónde empieza una tarea nueva si se abre el diálogo desde un tablero o una columna. */
export interface NewTaskPreset {
  projectId?: string
  columnId?: string
  /** Título y descripción ya escritos (p. ej. «Crear tarea» desde una noticia). */
  title?: string
  description?: string
}

/** Acciones globales del shell que cualquier pantalla puede disparar. */
export interface ShellApi {
  /** Abre el buscador ⌘K, opcionalmente con texto. */
  openPalette: (query?: string) => void
  openNewProject: () => void
  openNewTask: (preset?: NewTaskPreset) => void
}

export const ShellContext = createContext<ShellApi>({
  openPalette: () => {},
  openNewProject: () => {},
  openNewTask: () => {},
})

export const useShell = () => useContext(ShellContext)

/** macOS e iOS usan ⌘; el resto, Ctrl. */
export const isApple =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)

export const PALETTE_SHORTCUT = isApple ? '⌘K' : 'Ctrl K'
