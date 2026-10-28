import {
  type PersistedClient,
  type Persister,
  persistQueryClient,
} from '@tanstack/query-persist-client-core'
import type { QueryClient } from '@tanstack/react-query'
import { clear, createStore, del, get, set, type UseStore } from 'idb-keyval'

/**
 * Caché de lectura sin conexión (ADR-0029). La caché de react-query se guarda en IndexedDB (clave por
 * usuario) y se recupera antes del primer pintado: la app abre al instante con lo último que vio y se
 * actualiza por detrás; sin red, se puede consultar. Escribir sin red no está soportado: falla y se deshace.
 *
 * Es información privada en el dispositivo: se borra al cerrar sesión y al cambiar de usuario.
 */

/** Súbelo si cambia la forma de lo que se guarda en la caché: lo guardado con otra versión se descarta. */
// 2: el resumen (`overview`) trae estadísticas por proyecto nuevas (ADR-0055).
const CACHE_VERSION = 2
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const WRITE_EVERY_MS = 1500
/** IndexedDB lenta o bloqueada no puede retrasar el arranque más que esto. */
const RESTORE_TIMEOUT_MS = 2000

let db: UseStore | undefined
const store = () => {
  db ??= createStore('muninn-cache', 'queries')
  return db
}

/** Lo que se guarda: lo que ya se leyó bien. Nada de peticiones a medias ni errores. */
export const shouldPersist = (q: { state: { status: string } }) => q.state.status === 'success'

function persister(userId: string, isOff: () => boolean): Persister {
  const key = `queries:${userId}`
  let timer: ReturnType<typeof setTimeout> | undefined
  let last: PersistedClient | undefined
  const write = () => {
    timer = undefined
    if (last && !isOff()) void set(key, last, store()).catch(() => {})
  }
  return {
    persistClient: (client) => {
      // La caché cambia a cada pulsación; se guarda como mucho cada 1,5 s.
      last = client
      timer ??= setTimeout(write, WRITE_EVERY_MS)
    },
    restoreClient: () => get<PersistedClient>(key, store()),
    removeClient: () => {
      clearTimeout(timer)
      timer = undefined
      last = undefined
      return del(key, store())
    },
  }
}

/**
 * Recupera la caché guardada de este usuario y empieza a guardar los cambios. Devuelve cómo parar.
 * Si IndexedDB falla (modo privado, bloqueada), la app sigue sin caché offline.
 */
export async function enableOfflineCache(qc: QueryClient, userId: string): Promise<() => void> {
  let off = false
  try {
    const [unsubscribe, restored] = persistQueryClient({
      queryClient: qc,
      persister: persister(userId, () => off),
      maxAge: MAX_AGE_MS,
      buster: String(CACHE_VERSION),
      dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
    })
    await Promise.race([restored, new Promise((r) => setTimeout(r, RESTORE_TIMEOUT_MS))])
    return () => {
      off = true
      unsubscribe()
    }
  } catch {
    return () => {}
  }
}

/** Borra todo lo guardado (al cerrar sesión o cambiar de usuario). */
export async function clearOfflineCache(): Promise<void> {
  try {
    await clear(store())
  } catch {
    // Sin IndexedDB no hay nada que borrar.
  }
}
