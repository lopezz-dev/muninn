import type { CalendarScale } from './calendar'

/**
 * Vista del tablero de un proyecto (Tablero, Lista o Calendario). Se recuerda por proyecto y por dispositivo
 * en localStorage: es una comodidad de quien mira, no un dato de la cuenta (en el móvil puede preferirse
 * la lista y en el escritorio el tablero). El calendario guarda también su escala: `calendar` (mes) o
 * `calendar-week` (semana). El mes que se ve no se guarda: siempre abre en hoy (ADR-0068).
 */

export type BoardView = 'board' | 'list' | 'calendar'

type Stored = 'list' | 'calendar' | 'calendar-week'
const STORED: readonly string[] = ['list', 'calendar', 'calendar-week'] satisfies Stored[]

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

function readAll(storage: ViewStorage | null): Record<string, Stored> {
  try {
    const raw = JSON.parse(storage?.getItem(BOARD_VIEW_KEY) ?? '{}') as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    // Solo lo que se reconoce: un valor raro (otra versión, edición a mano) cuenta como «Tablero».
    return Object.fromEntries(
      Object.entries(raw).filter(([, v]) => STORED.includes(v as string)),
    ) as Record<string, Stored>
  } catch {
    return {}
  }
}

export function readBoardView(projectId: string, storage = safeStorage()): BoardView {
  const v = readAll(storage)[projectId]
  return v === 'calendar-week' ? 'calendar' : (v ?? 'board')
}

/** Escala del calendario de un proyecto: mes, salvo que se dejara en semana. */
export function readCalendarScale(projectId: string, storage = safeStorage()): CalendarScale {
  return readAll(storage)[projectId] === 'calendar-week' ? 'week' : 'month'
}

/** Guarda la vista (y, en el calendario, su escala). «Tablero» es lo de siempre: no se guarda, se quita la entrada. */
export function saveBoardView(
  projectId: string,
  view: BoardView,
  storage = safeStorage(),
  scale: CalendarScale = 'month',
) {
  const all = readAll(storage)
  delete all[projectId]
  if (view === 'list') all[projectId] = view
  if (view === 'calendar') all[projectId] = scale === 'week' ? 'calendar-week' : 'calendar'
  const entries = Object.entries(all).slice(-MAX_REMEMBERED)
  try {
    storage?.setItem(BOARD_VIEW_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Sin almacenamiento la vista dura lo que la pantalla abierta.
  }
}
