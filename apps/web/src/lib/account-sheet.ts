import { useSyncExternalStore } from 'react'

/**
 * Hoja «Tu cuenta» del teléfono (ADR-0072). No es una ruta: se abre encima de la pantalla en la que estés y, al
 * cerrarla, sigues ahí. Vive fuera de React para que el router (enlaces directos a `/ajustes/<sección>`, `/mas`) la
 * pueda abrir antes de pintar.
 *
 * `stack` es la navegación dentro de la hoja: `'root'` y, encima, las secciones de Ajustes abiertas («‹» vuelve).
 */
export interface AccountSheetState {
  open: boolean
  stack: string[]
}

let state: AccountSheetState = { open: false, stack: ['root'] }
const listeners = new Set<() => void>()
const set = (next: AccountSheetState) => {
  state = next
  for (const l of listeners) l()
}

export const accountSheet = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /**
   * Abre la hoja; con `view`, ya en esa sección (con «‹ Tu cuenta» para subir). Si ya está abierta, la sección se
   * apila encima de lo que había.
   */
  open(view?: string) {
    if (!view || view === 'root') set({ open: true, stack: ['root'] })
    else if (state.open) {
      if (state.stack.at(-1) !== view) set({ open: true, stack: [...state.stack, view] })
    } else set({ open: true, stack: ['root', view] })
  },
  push(view: string) {
    set({ ...state, stack: [...state.stack, view] })
  },
  pop() {
    if (state.stack.length > 1) set({ ...state, stack: state.stack.slice(0, -1) })
  },
  close() {
    if (state.open) set({ ...state, open: false })
  },
}

export const useAccountSheet = () => useSyncExternalStore(accountSheet.subscribe, accountSheet.get)

/** Mismo corte que el shell (ADR-0054): por debajo de 768 px, teléfono. */
export const isPhone = () =>
  typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches

/** La sección de Ajustes de una ruta (`/ajustes/notificaciones` → `notificaciones`; `/ajustes` → `root`). */
export function settingsViewOf(pathname: string): string | null {
  const m = /^\/ajustes(?:\/([^/?#]+))?\/?$/.exec(pathname)
  if (!m) return null
  return m[1] ? decodeURIComponent(m[1]) : 'root'
}
