import { notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import type { BoardData } from './board'
import { keys } from './queries'

/**
 * Infraestructura común de las acciones del tablero (`task-actions.ts`, `column-actions.ts`).
 *
 * Patrón: la acción cambia la caché de react-query al instante (optimista), escribe en el core y, si
 * falla, devuelve la caché a como estaba y avisa. Al acabar la última escritura pendiente del proyecto
 * se vuelve a pedir el tablero para recoger lo que calculó el servidor (claves de orden, `completedAt`).
 */

const pending = new Map<string, { tail: Promise<unknown>; count: number }>()

/**
 * Las escrituras de un proyecto van de una en una y en el orden en que se hicieron: dos movimientos
 * seguidos no pueden adelantarse (el segundo cuenta con que el primero ya está hecho).
 */
export function serial<T>(projectId: string, run: () => Promise<T>): Promise<T> {
  const entry = pending.get(projectId) ?? { tail: Promise.resolve(), count: 0 }
  entry.count++
  const result = entry.tail.then(run, run)
  entry.tail = result.catch(() => {})
  pending.set(projectId, entry)
  return result.finally(() => {
    entry.count--
    if (entry.count === 0 && pending.get(projectId) === entry) pending.delete(projectId)
  })
}

/** ¿Hay escrituras en cola? Con clave, las de ese proyecto (o nota…); sin ella, cualquiera. */
export const isBusy = (key?: string) =>
  key === undefined ? pending.size > 0 : (pending.get(key)?.count ?? 0) > 0

const busy = isBusy

/** Refresca lo que depende de las tareas, salvo que aún haya escrituras en cola (si no, parpadearía). */
export function settle(qc: QueryClient, projectId: string, taskId?: string) {
  if (busy(projectId)) return
  void qc.invalidateQueries({ queryKey: keys.board(projectId) })
  void qc.invalidateQueries({ queryKey: keys.archivedTasks(projectId) })
  void qc.invalidateQueries({ queryKey: keys.overview })
  void qc.invalidateQueries({ queryKey: ['checklist-counts'] })
  if (taskId) void qc.invalidateQueries({ queryKey: keys.taskActivity(taskId) })
}

/** Cambia el tablero en caché y devuelve cómo estaba (para volver atrás). */
export async function optimistic(
  qc: QueryClient,
  projectId: string,
  update: (data: BoardData) => BoardData,
): Promise<BoardData | undefined> {
  const key = keys.board(projectId)
  // Si hay una petición en vuelo, su respuesta pisaría el cambio: se cancela antes. Sin ella, todo
  // es síncrono y el arrastre no parpadea entre soltar y pintar.
  if (qc.isFetching({ queryKey: key })) await qc.cancelQueries({ queryKey: key })
  const prev = qc.getQueryData<BoardData>(key)
  if (prev) qc.setQueryData(key, update(prev))
  return prev
}

export function rollback(qc: QueryClient, projectId: string, prev: BoardData | undefined) {
  if (prev) qc.setQueryData(keys.board(projectId), prev)
  settle(qc, projectId)
}

/** Errores de supabase-js al llamar a una Edge Function: llegan en inglés y sin nada útil para quien usa la app. */
const EDGE_ERRORS: Record<string, string> = {
  FunctionsFetchError: 'No se pudo hablar con el servidor de Muninn.',
  FunctionsRelayError: 'No se pudo hablar con el servidor de Muninn.',
  FunctionsHttpError: 'El servidor de Muninn respondió con un error.',
}

export const reason = (err: unknown) =>
  typeof navigator !== 'undefined' && navigator.onLine === false
    ? 'Sin conexión: vuelve a intentarlo cuando la recuperes.'
    : err instanceof Error
      ? (EDGE_ERRORS[err.name] ?? err.message)
      : undefined

export const fail = (title: string, err: unknown) =>
  notify.error(title, { description: reason(err) })
