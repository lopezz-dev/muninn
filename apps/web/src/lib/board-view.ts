import type { CalendarScale } from './calendar'

/**
 * Vista del tablero de un proyecto (Tablero, Lista o Calendario). Se recuerda por proyecto y por dispositivo
 * en localStorage: es una comodidad de quien mira, no un dato de la cuenta (en el móvil puede preferirse
 * la lista y en el escritorio el tablero). El calendario guarda también su escala: `calendar` (mes) o
 * `calendar-week` (semana), y el sufijo `:open` si en el móvil se dejó el mes desplegado (abre plegado en
 * la semana). El mes que se ve no se guarda: siempre abre en hoy (ADR-0068).
 */

export type BoardView = 'board' | 'list' | 'calendar'

type Calendar = 'calendar' | 'calendar-week'
type Stored = 'list' | Calendar | `${Calendar}:open`
const STORED: readonly string[] = [
  'list',
  'calendar',
  'calendar-week',
  'calendar:open',
  'calendar-week:open',
] satisfies Stored[]

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

/** La entrada sin el sufijo del móvil. */
const base = (v: Stored | undefined) => v?.replace(':open', '') as 'list' | Calendar | undefined

export function readBoardView(projectId: string, storage = safeStorage()): BoardView {
  const v = base(readAll(storage)[projectId])
  return v === 'calendar-week' ? 'calendar' : (v ?? 'board')
}

/** Escala del calendario de un proyecto: mes, salvo que se dejara en semana. */
export function readCalendarScale(projectId: string, storage = safeStorage()): CalendarScale {
  return base(readAll(storage)[projectId]) === 'calendar-week' ? 'week' : 'month'
}

/** Calendario del móvil: plegado en la semana, salvo que se dejara el mes desplegado. */
export function readCalendarFolded(projectId: string, storage = safeStorage()): boolean {
  return !readAll(storage)[projectId]?.endsWith(':open')
}

/**
 * Guarda la vista (y, en el calendario, su escala y si el mes del móvil está plegado). «Tablero» es lo de
 * siempre: no se guarda, se quita la entrada.
 */
export function saveBoardView(
  projectId: string,
  view: BoardView,
  storage = safeStorage(),
  scale: CalendarScale = 'month',
  folded = true,
) {
  const all = readAll(storage)
  delete all[projectId]
  if (view === 'list') all[projectId] = view
  if (view === 'calendar') {
    const cal: Calendar = scale === 'week' ? 'calendar-week' : 'calendar'
    all[projectId] = folded ? cal : `${cal}:open`
  }
  const entries = Object.entries(all).slice(-MAX_REMEMBERED)
  try {
    storage?.setItem(BOARD_VIEW_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Sin almacenamiento la vista dura lo que la pantalla abierta.
  }
}
