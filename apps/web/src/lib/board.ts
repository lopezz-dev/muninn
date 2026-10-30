import type { BoardColumn, TaskPriority, TaskWithColumn } from '@muninn/core'

/** Lo que pinta el tablero de un proyecto: una sola consulta, una sola entrada de caché. */
export interface BoardData {
  columns: BoardColumn[]
  tasks: TaskWithColumn[]
  /** Subtareas hechas y total por tarea. Sin entrada = sin subtareas. */
  counts: Record<string, { done: number; total: number }>
}

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'none', label: 'Sin prioridad' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

export const priorityLabel = (p: TaskPriority) => PRIORITIES.find((x) => x.value === p)?.label ?? p

/** Orden para ordenar por urgencia (mayor = más urgente). */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
}

export const KIND_LABEL = {
  backlog: 'Backlog',
  todo: 'Por hacer',
  in_progress: 'En curso',
  review: 'Revisión',
  done: 'Hecho',
} as const

// ─── Identificadores para dnd-kit ───────────────────────────────────────────

/** Las columnas y las tarjetas comparten espacio de ids en dnd-kit: las columnas llevan prefijo. */
export const colKey = (id: string) => `col:${id}`
export const isColKey = (id: unknown): id is string =>
  typeof id === 'string' && id.startsWith('col:')
export const colId = (key: string) => key.slice(4)
/** Pestaña de columna del móvil: también recibe tarjetas arrastradas. */
export const tabKey = (id: string) => `tab:${id}`
export const isTabKey = (id: unknown): id is string =>
  typeof id === 'string' && id.startsWith('tab:')
export const tabId = (key: string) => key.slice(4)

// ─── Agrupar y mover ────────────────────────────────────────────────────────

/** Tareas por columna, conservando el orden en que llegan (ya vienen ordenadas por posición). */
export function groupByColumn(columns: BoardColumn[], tasks: TaskWithColumn[]) {
  const groups: Record<string, TaskWithColumn[]> = Object.fromEntries(
    columns.map((c) => [c.id, []]),
  )
  for (const t of tasks) groups[t.columnId]?.push(t)
  return groups
}

/**
 * Reflejo inmediato de `tasks.move` en la caché (actualización optimista). El servidor calcula la
 * clave de orden real; aquí basta con colocar la tarea en el hueco: dentro de una columna solo
 * importa el orden relativo del array. `index` cuenta los hermanos sin la propia tarea.
 */
export function applyTaskMove(
  data: BoardData,
  taskId: string,
  columnId: string,
  index?: number,
  now = new Date().toISOString(),
): BoardData {
  const task = data.tasks.find((t) => t.id === taskId)
  const target = data.columns.find((c) => c.id === columnId)
  if (!task || !target) return data
  const from = data.columns.find((c) => c.id === task.columnId)

  const rest = data.tasks.filter((t) => t.id !== taskId)
  const siblings = rest.filter((t) => t.columnId === columnId)
  const i = Math.max(0, Math.min(index ?? siblings.length, siblings.length))
  const before = siblings[i]
  const last = siblings[siblings.length - 1]
  const at = before ? rest.indexOf(before) : last ? rest.indexOf(last) + 1 : rest.length

  const entersDone = target.kind === 'done' && from?.kind !== 'done'
  const leavesDone = target.kind !== 'done' && from?.kind === 'done'
  const moved: TaskWithColumn = {
    ...task,
    columnId,
    column: { id: target.id, name: target.name, kind: target.kind },
    completedAt: entersDone ? now : leavesDone ? null : task.completedAt,
  }
  return { ...data, tasks: [...rest.slice(0, at), moved, ...rest.slice(at)] }
}

/** Reflejo inmediato de `columns.move`: `index` cuenta las demás columnas. */
export function applyColumnMove(data: BoardData, columnId: string, index: number): BoardData {
  const col = data.columns.find((c) => c.id === columnId)
  if (!col) return data
  const rest = data.columns.filter((c) => c.id !== columnId)
  const i = Math.max(0, Math.min(index, rest.length))
  return { ...data, columns: [...rest.slice(0, i), col, ...rest.slice(i)] }
}

/** Índice de la tarea dentro de su columna (o -1). */
export function indexInColumn(data: BoardData, taskId: string) {
  const task = data.tasks.find((t) => t.id === taskId)
  if (!task) return -1
  return data.tasks.filter((t) => t.columnId === task.columnId).findIndex((t) => t.id === taskId)
}

// ─── Estado local mientras se arrastra ──────────────────────────────────────

export type ItemsByColumn = Record<string, string[]>

export const idsByColumn = (groups: Record<string, { id: string }[]>): ItemsByColumn =>
  Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((t) => t.id)]))

/** Columna que contiene la tarjeta `id`. */
export const findColumn = (items: ItemsByColumn, id: string) =>
  Object.keys(items).find((c) => items[c]?.includes(id))

/**
 * Pasa la tarjeta `activeId` a la columna `toColumn`, justo encima o debajo de `overId` (si lo hay) o al
 * final. Es lo que se va haciendo en `onDragOver`, para que las demás tarjetas se aparten en vivo.
 */
export function moveAcross(
  items: ItemsByColumn,
  activeId: string,
  toColumn: string,
  overId: string | null,
  below: boolean,
): ItemsByColumn {
  const from = findColumn(items, activeId)
  if (!from || !items[toColumn]) return items
  const target = (items[toColumn] ?? []).filter((id) => id !== activeId)
  const overIndex = overId ? target.indexOf(overId) : -1
  const at = overIndex < 0 ? target.length : overIndex + (below ? 1 : 0)
  return {
    ...items,
    [from]: (items[from] ?? []).filter((id) => id !== activeId),
    [toColumn]: [...target.slice(0, at), activeId, ...target.slice(at)],
  }
}
