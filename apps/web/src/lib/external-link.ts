import { notify } from '@muninn/ui'
import type { MouseEvent } from 'react'
import { isTauri } from './auth'

/** Cómo se abre una URL fuera de la app. Se inyecta en los tests. */
export interface OpenerDeps {
  /** Dentro de Tauri: `target="_blank"` no hace nada y hay que pedírselo al sistema. */
  tauri: boolean
  /** `openUrl` de @tauri-apps/plugin-opener: el navegador del sistema. */
  openUrl(url: string): Promise<void>
  /** `window.open` del navegador o la PWA. */
  open(url: string): void
}

// El plugin solo existe dentro de Tauri: se carga al primer clic y no viaja con el arranque.
const defaultDeps: OpenerDeps = {
  tauri: isTauri,
  openUrl: async (url) => (await import('@tauri-apps/plugin-opener')).openUrl(url),
  open: (url) => {
    window.open(url, '_blank', 'noopener')
  },
}

/**
 * Abre una URL externa en el navegador del sistema. En escritorio pasa por `tauri-plugin-opener`; en el
 * navegador y la PWA, `window.open`. Si falla, lo dice con `notify`. Devuelve si se ha podido pedir.
 */
export async function openExternal(url: string, deps: OpenerDeps = defaultDeps): Promise<boolean> {
  try {
    if (deps.tauri) await deps.openUrl(url)
    else deps.open(url)
    return true
  } catch (err) {
    console.warn('[enlaces]', err)
    notify.error('No se ha podido abrir el enlace', { description: url })
    return false
  }
}

/**
 * Props de un `<a>` externo: conserva `href` (copiar enlace, accesibilidad) pero el clic pasa por
 * `openExternal`. `onOpen` corre antes de abrir (p. ej., marcar la noticia como leída).
 */
export function externalLink(url: string, onOpen?: () => void, deps: OpenerDeps = defaultDeps) {
  return {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer',
    onClick: (e: MouseEvent<HTMLElement>) => {
      // En el navegador, ⌘/Ctrl/Mayús-clic sigue siendo cosa del navegador (otra pestaña, otra ventana).
      if (!deps.tauri && (e.metaKey || e.ctrlKey || e.shiftKey)) {
        onOpen?.()
        return
      }
      e.preventDefault()
      onOpen?.()
      void openExternal(url, deps)
    },
  }
}

/** `data:image/…;base64,…` → `Blob`, sin `await`: Safari solo deja abrir ventanas en el mismo clic. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, data = ''] = dataUrl.split(',', 2)
  const type = /^data:([^;,]+)/.exec(head ?? '')?.[1] ?? 'application/octet-stream'
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

/**
 * Abre a tamaño real una imagen adjunta al Asistente (`data:`). El navegador no deja abrir un `data:` en otra
 * pestaña: se pasa a `blob:` y se abre con `window.open`. Solo en el navegador y la PWA: el escritorio no tiene
 * pestañas y el sistema no sabe abrir un `blob:` de la app (ahí la imagen no lleva enlace).
 */
export function openImage(dataUrl: string, open: (url: string) => void = defaultDeps.open): void {
  try {
    const url = URL.createObjectURL(dataUrlToBlob(dataUrl))
    open(url)
    // La pestaña ya la ha cargado: se libera la memoria pasado un rato.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    console.warn('[enlaces]', err)
    notify.error('No se ha podido abrir la imagen')
  }
}
