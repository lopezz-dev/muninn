import type { AnyRouter } from '@tanstack/react-router'
import { i18n, NAMESPACES } from '../i18n'

/** Lo que espera como mucho el navegador ocioso antes de empezar igualmente. */
const IDLE_TIMEOUT_MS = 3000

/** Rutas de la sección que empieza en `to`: la propia y las que cuelgan de ella (`/projects/$projectId`…). */
const inSection = (fullPath: string, to: string) =>
  to === '/' ? fullPath === '/' : fullPath === to || fullPath.startsWith(`${to}/`)

/**
 * Precalienta las pantallas de la navegación (ADR-0084): con el navegador ocioso tras el primer pintado, descarga el chunk
 * de cada sección activa (y con él su namespace: `screen()` en `router.tsx`) y el resto de namespaces del idioma activo.
 * Así, la primera vez que se abre una pantalla tras arrancar la app o cambiar de versión ya está en memoria. Con
 * «Ahorro de datos» no hace nada; si algo falla, calla: al abrir la pantalla se vuelve a pedir. Devuelve cómo cancelarlo.
 */
export function warmUp(router: AnyRouter, sections: readonly string[]): () => void {
  const conn = (globalThis.navigator as { connection?: { saveData?: boolean } } | undefined)
    ?.connection
  if (conn?.saveData) return () => {}
  const run = () => {
    for (const route of Object.values(router.routesById)) {
      if (sections.some((to) => inSection(route.fullPath, to)))
        void router.loadRouteChunk(route)?.catch(() => {})
    }
    // Diálogos, buscador, hoja de la cuenta…: lo que no es una ruta. `auth` solo se usa sin sesión.
    void i18n.loadNamespaces(NAMESPACES.filter((ns) => ns !== 'auth')).catch(() => {})
  }
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(run, 1500)
  return () => clearTimeout(id)
}
