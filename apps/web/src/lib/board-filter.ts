import type { TaskPriority, TaskSource, TaskWithColumn } from '@muninn/core'
import { addDays } from './dates'
import { matchesAll, words } from './text'

/**
 * Filtros del tablero (texto, prioridad, etiquetas, origen y vencimiento). Dentro de un grupo vale
 * cualquiera de las opciones elegidas (O); entre grupos deben cumplirse todos (Y).
 */

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none'

export interface BoardFilter {
  query: string
  priorities: TaskPriority[]
  labels: string[]
  sources: TaskSource[]
  due: DueBucket[]
}

export const NO_FILTER: BoardFilter = {
  query: '',
  priorities: [],
  labels: [],
  sources: [],
  due: [],
}

export const DUE_OPTIONS: { value: DueBucket; label: string }[] = [
  { value: 'overdue', label: 'Vencidas' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Próximos 7 días' },
  { value: 'later', label: 'Más adelante' },
  { value: 'none', label: 'Sin fecha' },
]

export const SOURCE_OPTIONS: { value: TaskSource; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'mcp', label: 'Asistente' },
  { value: 'github', label: 'GitHub' },
  { value: 'agent', label: 'Agente' },
]

/** Cuántos grupos hay con algo elegido (el texto cuenta como uno). */
export const activeGroups = (f: BoardFilter) =>
  Number(Boolean(f.query.trim())) +
  Number(f.priorities.length > 0) +
  Number(f.labels.length > 0) +
  Number(f.sources.length > 0) +
  Number(f.due.length > 0)

export const isFiltering = (f: BoardFilter) => activeGroups(f) > 0

/** Dónde cae el vencimiento de una tarea. Una tarea hecha nunca está «vencida». */
export function dueBucket(
  task: Pick<TaskWithColumn, 'dueDate' | 'column'>,
  today: string,
): DueBucket {
  const due = task.dueDate
  if (!due) return 'none'
  if (due < today) return task.column.kind === 'done' ? 'later' : 'overdue'
  if (due === today) return 'today'
  return due <= addDays(today, 7) ? 'week' : 'later'
}

export function matches(task: TaskWithColumn, f: BoardFilter, today: string): boolean {
  if (f.priorities.length && !f.priorities.includes(task.priority)) return false
  if (f.sources.length && !f.sources.includes(task.source)) return false
  if (f.due.length && !f.due.includes(dueBucket(task, today))) return false
  if (f.labels.length) {
    const mine = task.labels.map((l) => l.toLowerCase())
    if (!f.labels.some((l) => mine.includes(l.toLowerCase()))) return false
  }
  return matchesAll(`${task.title}\n${task.description}\n${task.labels.join(' ')}`, words(f.query))
}

export function filterTasks(tasks: TaskWithColumn[], f: BoardFilter, today: string) {
  return isFiltering(f) ? tasks.filter((t) => matches(t, f, today)) : tasks
}

/** Las etiquetas que hay en el tablero, sin repetir (sin distinguir mayúsculas) y por orden alfabético. */
export function labelsOf(tasks: Pick<TaskWithColumn, 'labels'>[]): string[] {
  const seen = new Map<string, string>()
  for (const t of tasks) {
    for (const l of t.labels) if (!seen.has(l.toLowerCase())) seen.set(l.toLowerCase(), l)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

/** La lista con `value` añadido o quitado. */
export const toggle = <T>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

/**
 * Con un filtro puesto, el arrastre trabaja con la lista que se ve, pero el servidor cuenta la columna
 * entera (`tasks.move`: «índice sin contar la propia tarea»). Esto traduce una posición de la lista
 * visible a la de la columna completa:
 *   · arriba del todo → delante de la primera tarea visible (las ocultas de arriba se quedan arriba);
 *   · en cualquier otro sitio → justo debajo de la tarea visible que queda encima;
 *   · sin otras tareas visibles → al final de la columna.
 * `full` es la columna entera; `visible`, la lista visible ya con la tarea en su nueva posición.
 */
export function fullIndex(full: string[], visible: string[], movedId: string): number {
  const rest = full.filter((id) => id !== movedId)
  const vis = visible.filter((id) => id !== movedId)
  const i = visible.indexOf(movedId)
  if (vis.length === 0) return rest.length
  const at = i <= 0 ? rest.indexOf(vis[0] as string) : rest.indexOf(vis[i - 1] as string) + 1
  return at < 0 ? rest.length : at
}
