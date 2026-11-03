import { useSyncExternalStore } from 'react'

/**
 * Menú «Abrir enlace · Copiar enlace» de los enlaces que salen de Muninn en pantallas táctiles (ADR-0073): un toque
 * sin querer no saca de la app. Este módulo es solo el estado (va en el arranque y pesa casi nada); el menú se
 * pinta en `shell/LinkMenu.tsx`, un chunk que se pide al primer toque.
 */

export interface LinkAsk {
  url: string
  /** Dónde está el enlace en la pantalla, para colocar el menú a su lado. */
  rect: { left: number; top: number; width: number; height: number }
  /** Lo que el enlace hace al abrirse (p. ej., marcar la noticia como leída). */
  onOpen?: () => void
}

let current: LinkAsk | null = null
let hosts = 0
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}

/** Pide el menú para un enlace. `false` si no hay nadie que lo pinte (fuera del shell): entonces se abre directo. */
export function askLink(ask: LinkAsk): boolean {
  if (hosts === 0) return false
  current = ask
  emit()
  return true
}

export function closeLinkMenu() {
  if (!current) return
  current = null
  emit()
}

/** El shell se apunta como quien pinta el menú mientras está montado. */
export function registerLinkMenuHost() {
  hosts += 1
  return () => {
    hosts -= 1
    if (hosts === 0) closeLinkMenu()
  }
}

export function useLinkAsk() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
    () => null,
  )
}
