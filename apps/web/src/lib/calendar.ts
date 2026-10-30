import type { BoardColumn, TaskWithColumn } from '@muninn/core'
import { PRIORITY_RANK } from './board'
import { addDays } from './dates'

/**
 * Cálculos de la vista Calendario del tablero (ADR-0068). Todo trabaja con fechas `AAAA-MM-DD` como texto y
 * en UTC: el día no se mueve con la zona horaria. Semana en lunes y mes de seis filas, como el `Calendar` de
 * `@muninn/ui` (ADR-0049).
 */

export type CalendarScale = 'month' | 'week'

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-ES', { ...opts, timeZone: 'UTC' })
const monthYearFmt = fmt({ month: 'long', year: 'numeric' })
const monthFmt = fmt({ month: 'long' })
const shortFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
const longFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Lunes = 0 … domingo = 6. */
export const weekday = (iso: string) => (utc(iso).getUTCDay() + 6) % 7

/** El lunes de la semana de `iso`. */
export const startOfWeek = (iso: string) => addDays(iso, -weekday(iso))

/** Mes `AAAA-MM` desplazado `n` meses. */
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

/** Las 42 fechas (seis semanas, de lunes a domingo) que pinta el mes `AAAA-MM`. */
export function monthGrid(month: string): string[] {
  const first = startOfWeek(`${month}-01`)
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

/** Los siete días (de lunes a domingo) de la semana que contiene `iso`. */
export function weekDays(iso: string): string[] {
  const first = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(first, i))
}

/** «Octubre 2026». */
export const monthTitle = (month: string) =>
  capital(monthYearFmt.format(utc(`${month}-01`)).replace(' de ', ' '))

/** «26 oct – 1 nov 2026» (o «2 – 8 nov 2026» si no cambia de mes). */
export function weekTitle(iso: string) {
  const [from, to] = [startOfWeek(iso), addDays(startOfWeek(iso), 6)]
  const day = (d: string) => Number(d.slice(8))
  const mon = (d: string) => fmt({ month: 'short' }).format(utc(d)).replace('.', '')
  const year = to.slice(0, 4)
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${day(from)} – ${day(to)} ${mon(to)} ${year}`
    : `${day(from)} ${mon(from)} – ${day(to)} ${mon(to)} ${year}`
}

/** «diciembre». */
export const monthName = (month: string) => monthFmt.format(utc(`${month}-01`))

/** «mié 4 nov». */
export const dayShort = (iso: string) =>
  shortFmt.format(utc(iso)).replaceAll('.', '').replace(',', '')

/** «Miércoles 4 de noviembre». */
export const dayLong = (iso: string) => capital(longFmt.format(utc(iso)).replace(',', ''))

/** Texto del aviso al cambiar la fecha: «Vence hoy», «Vence mañana», «Vence el mié 4 nov» o «Sin fecha». */
export function dueToast(due: string | null, today: string) {
  if (!due) return 'Sin fecha'
  if (due === today) return 'Vence hoy'
  if (due === addDays(today, 1)) return 'Vence mañana'
  const sameYear = due.slice(0, 4) === today.slice(0, 4)
  return `Vence el ${dayShort(due)}${sameYear ? '' : ` ${due.slice(0, 4)}`}`
}

/** Atajos de la hoja «Cambiar fecha» del móvil: hoy, mañana, el próximo lunes y dentro de una semana. */
export function quickDates(today: string) {
  return [
    { label: 'Hoy', date: today },
    { label: 'Mañana', date: addDays(today, 1) },
    { label: 'Próximo lunes', date: addDays(startOfWeek(today), 7) },
    { label: 'En una semana', date: addDays(today, 7) },
  ]
}

/** ¿Vencida? Fecha pasada y sin hacer (como `dueBucket`). */
export const isOverdue = (t: Pick<TaskWithColumn, 'dueDate' | 'column'>, today: string) =>
  Boolean(t.dueDate && t.dueDate < today && t.column.kind !== 'done')

/**
 * Tareas con fecha agrupadas por día. Dentro de un día no hay orden propio (el modelo no lo tiene): primero
 * las pendientes, luego por prioridad (más urgente arriba), por columna en el orden del tablero y, al final,
 * por su orden dentro de la columna (el de `tasks`).
 */
export function tasksByDay(
  tasks: TaskWithColumn[],
  columns: Pick<BoardColumn, 'id'>[],
): Record<string, TaskWithColumn[]> {
  const colIndex = new Map(columns.map((c, i) => [c.id, i]))
  const order = new Map(tasks.map((t, i) => [t.id, i]))
  const days: Record<string, TaskWithColumn[]> = {}
  for (const t of tasks) {
    if (!t.dueDate) continue
    const list = days[t.dueDate] ?? []
    list.push(t)
    days[t.dueDate] = list
  }
  const rank = (t: TaskWithColumn) => [
    t.column.kind === 'done' ? 1 : 0,
    -PRIORITY_RANK[t.priority],
    colIndex.get(t.columnId) ?? 0,
    order.get(t.id) ?? 0,
  ]
  for (const list of Object.values(days)) {
    list.sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)]
      for (let i = 0; i < ra.length; i++) {
        const d = (ra[i] as number) - (rb[i] as number)
        if (d) return d
      }
      return 0
    })
  }
  return days
}

/** Tareas sin fecha, en el orden del tablero. */
export const undatedTasks = (tasks: TaskWithColumn[]) => tasks.filter((t) => !t.dueDate)

/** La primera fecha con tareas después de `after` (para «Nada vence en diciembre · Ir al 12 ene»). */
export function nextDueAfter(tasks: Pick<TaskWithColumn, 'dueDate'>[], after: string) {
  let next: string | null = null
  for (const t of tasks)
    if (t.dueDate && t.dueDate > after && (!next || t.dueDate < next)) next = t.dueDate
  return next
}

/**
 * Alto fijo de una celda del mes (rellenos y número del día: 4 + 20 + 4, menos los 2 px que «+N más» mide menos que
 * una píldora) y de cada plaza (píldora de 22 px + 3 de hueco).
 */
const CELL_HEADER = 26
const CELL_SLOT = 25

/** Plazas que caben en una celda del mes de `height` px (al menos una: la de «+N más»). */
export const cellSlots = (height: number) =>
  Math.max(1, Math.min(8, Math.floor((height - CELL_HEADER) / CELL_SLOT)))

/** Cuántas tareas caben en una celda del mes: si sobran, la última plaza es «+N más». */
export function visibleInCell<T>(list: T[], max = 3): { shown: T[]; more: number } {
  if (list.length <= max) return { shown: list, more: 0 }
  return { shown: list.slice(0, max - 1), more: list.length - (max - 1) }
}

// ─── Identificadores para dnd-kit ───────────────────────────────────────────

/** Un día que recibe tareas (`day:2026-11-04`), la bandeja «Sin fecha» y las flechas de mes. */
export const dayKey = (iso: string) => `day:${iso}`
export const isDayKey = (id: unknown): id is string =>
  typeof id === 'string' && id.startsWith('day:')
export const dayOf = (key: string) => key.slice(4)
export const UNDATED = 'undated'
export const NAV_PREV = 'nav:prev'
export const NAV_NEXT = 'nav:next'

/**
 * Teclado al arrastrar: a qué día salta la tarea con cada flecha (← → un día, ↑ ↓ una semana). `null` si la
 * tecla no mueve. Desde la bandeja, cualquier flecha vuelve a `fallback` (hoy o el primer día que se ve).
 */
export function keyboardTarget(code: string, current: string | null, fallback: string) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[code]
  if (step === undefined) return null
  return current ? addDays(current, step) : fallback
}
