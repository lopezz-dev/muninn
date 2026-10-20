/**
 * Vista del tablero de un proyecto (Tablero o Lista). Se recuerda por proyecto y por dispositivo en
 * localStorage: es una comodidad de quien mira, no un dato de la cuenta (en el móvil puede preferirse
 * la lista y en el escritorio el tablero).
 */

export type BoardView = 'board' | 'list'

export const BOARD_VIEW_KEY = 'muninn.boardView'

/** Proyectos recordados como mucho: los más recientes se quedan, los demás vuelven a «Tablero». */
const MAX_REMEMBERED = 200

export interface ViewStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** localStorage puede no existir o lanzar (modo privado, almacenamiento bloqueado). */
function safeStorage(): ViewStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readAll(storage: ViewStorage | null): Record<string, BoardView> {
  try {
    const raw = JSON.parse(storage?.getItem(BOARD_VIEW_KEY) ?? '{}') as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    // Solo lo que se reconoce: un valor raro (otra versión, edición a mano) cuenta como «Tablero».
    return Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v === 'list' || v === 'board'),
    ) as Record<string, BoardView>
  } catch {
    return {}
  }
}

export function readBoardView(projectId: string, storage = safeStorage()): BoardView {
  return readAll(storage)[projectId] ?? 'board'
}

/** Guarda la vista. «Tablero» es lo de siempre: no hace falta guardarlo, se quita la entrada. */
export function saveBoardView(projectId: string, view: BoardView, storage = safeStorage()) {
  const all = readAll(storage)
  delete all[projectId]
  if (view === 'list') all[projectId] = view
  const entries = Object.entries(all).slice(-MAX_REMEMBERED)
  try {
    storage?.setItem(BOARD_VIEW_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Sin almacenamiento la vista dura lo que la pantalla abierta.
  }
}
