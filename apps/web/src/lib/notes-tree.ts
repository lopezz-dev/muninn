import { byPosition, type Note } from '@muninn/core'

/**
 * El árbol de notas en la pantalla (ADR-0083): un espacio por proyecto (`null` = «General») y, en cada uno,
 * las páginas con sus hijas. Funciones puras sobre la lista que ya está en caché: la pantalla no pide nada más.
 */

export interface TreeNode {
  note: Note
  children: TreeNode[]
}

export interface Space {
  projectId: string | null
  roots: TreeNode[]
}

/** La sangría deja de crecer a partir del sexto nivel; las migas dicen el resto. */
export const MAX_INDENT = 6

const spaceKey = (projectId: string | null) => projectId ?? ''

/**
 * Los espacios con sus árboles. Una nota cuya madre no está en la lista (archivada o fuera del límite) sale en la
 * raíz de su espacio, para no perderla de vista.
 */
export function buildSpaces(notes: Note[]): Map<string, Space> {
  const byId = new Map(notes.map((n) => [n.id, n]))
  const nodes = new Map(notes.map((n) => [n.id, { note: n, children: [] } as TreeNode]))
  const spaces = new Map<string, Space>()
  for (const n of [...notes].sort(byPosition)) {
    const node = nodes.get(n.id) as TreeNode
    const parent = n.parentId ? byId.get(n.parentId) : undefined
    if (parent && parent.projectId === n.projectId) {
      nodes.get(parent.id)?.children.push(node)
      continue
    }
    const key = spaceKey(n.projectId)
    const space = spaces.get(key) ?? { projectId: n.projectId, roots: [] }
    space.roots.push(node)
    spaces.set(key, space)
  }
  return spaces
}

export const spaceOf = (spaces: Map<string, Space>, projectId: string | null) =>
  spaces.get(spaceKey(projectId)) ?? { projectId, roots: [] }

/** Las hijas directas de una nota, por posición. */
export const childrenOf = (notes: Note[], id: string) =>
  notes.filter((n) => n.parentId === id).sort(byPosition)

/** La ruta desde la raíz hasta la madre de una nota (sin ella), con lo que hay en la lista. */
export function ancestorsOf(notes: Note[], note: Note): Note[] {
  const byId = new Map(notes.map((n) => [n.id, n]))
  const out: Note[] = []
  let parentId = note.parentId
  while (parentId) {
    const parent = byId.get(parentId)
    if (!parent || out.includes(parent)) break
    out.unshift(parent)
    parentId = parent.parentId
  }
  return out
}

/** Si `id` es `ancestorId` o cuelga de ella: no se puede soltar una nota dentro de sí misma. */
export function isInside(notes: Note[], id: string, ancestorId: string): boolean {
  const byId = new Map(notes.map((n) => [n.id, n]))
  let cursor: Note | undefined = byId.get(id)
  const seen = new Set<string>()
  while (cursor && !seen.has(cursor.id)) {
    if (cursor.id === ancestorId) return true
    seen.add(cursor.id)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return false
}

/** Dónde cae al soltar sobre una fila: antes, después o dentro (como hija, al final). */
export type DropZone = 'before' | 'after' | 'inside'

/** El tercio de arriba es «antes», el de abajo «después» y el centro «dentro». */
export function zoneAt(pointerY: number, rect: { top: number; height: number }): DropZone {
  const rel = (pointerY - rect.top) / Math.max(1, rect.height)
  return rel < 0.3 ? 'before' : rel > 0.7 ? 'after' : 'inside'
}

/** El destino de `notes.move`. */
export interface MoveTarget {
  parentId: string | null
  projectId: string | null
  index?: number
}

/**
 * El destino de soltar `dragged` sobre `over` en `zone`, o `null` si no tiene sentido (sobre sí misma o dentro
 * de una descendiente).
 */
export function dropTarget(
  notes: Note[],
  dragged: Note,
  over: Note,
  zone: DropZone,
): MoveTarget | null {
  if (over.id === dragged.id || isInside(notes, over.id, dragged.id)) return null
  if (zone === 'inside') return { parentId: over.id, projectId: over.projectId }
  const siblings = notes
    .filter(
      (n) => n.id !== dragged.id && n.parentId === over.parentId && n.projectId === over.projectId,
    )
    .sort(byPosition)
  const at = siblings.findIndex((n) => n.id === over.id)
  return {
    parentId: over.parentId,
    projectId: over.projectId,
    index: zone === 'before' ? at : at + 1,
  }
}

/** Dónde está una nota ahora, para «Deshacer» un movimiento. */
export function placeOf(notes: Note[], note: Note): MoveTarget {
  const siblings = notes
    .filter((n) => n.parentId === note.parentId && n.projectId === note.projectId)
    .sort(byPosition)
  return {
    parentId: note.parentId,
    projectId: note.projectId,
    index: Math.max(
      0,
      siblings.findIndex((n) => n.id === note.id),
    ),
  }
}

/** Las descendientes de una nota en la lista (para quitarlas de la caché al archivar). */
export function descendantIds(notes: Note[], id: string): string[] {
  const out: string[] = []
  const queue = [id]
  while (queue.length) {
    const current = queue.shift() as string
    for (const n of notes)
      if (n.parentId === current && !out.includes(n.id)) {
        out.push(n.id)
        queue.push(n.id)
      }
  }
  return out
}

/**
 * La nota anterior y la siguiente leyendo el árbol de su espacio de arriba abajo (madre, hijas, siguiente hermana), como
 * «Anterior» y «Siguiente» en la ayuda.
 */
export function treeNeighbours(notes: Note[], id: string): { prev?: Note; next?: Note } {
  const note = notes.find((n) => n.id === id)
  if (!note) return {}
  const order: Note[] = []
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      order.push(node.note)
      walk(node.children)
    }
  }
  walk(spaceOf(buildSpaces(notes), note.projectId).roots)
  const at = order.findIndex((n) => n.id === id)
  return { prev: order[at - 1], next: order[at + 1] }
}
