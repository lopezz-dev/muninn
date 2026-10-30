import type { IconName } from '@muninn/ui'
import { noteTitle } from '../lib/notes'
import { matchesAll, normalize, words } from '../lib/text'

export type PaletteGroup = 'ask' | 'nav' | 'projects' | 'tasks' | 'notes' | 'actions'

export const GROUP_LABEL: Record<PaletteGroup, string> = {
  ask: 'Preguntar',
  nav: 'Ir a',
  projects: 'Proyectos',
  tasks: 'Tareas',
  notes: 'Notas',
  actions: 'Acciones',
}

const GROUP_ORDER: PaletteGroup[] = ['ask', 'nav', 'projects', 'tasks', 'notes', 'actions']

/** Mínimo de letras para buscar tareas y notas en el core, y cuántas de cada una se piden. */
export const SEARCH_MIN_LENGTH = 2
export const SEARCH_LIMIT = { tasks: 6, notes: 5 }

export interface PaletteItem {
  id: string
  group: PaletteGroup
  label: string
  icon: IconName
  /** Color del proyecto (en lugar del icono). */
  color?: string
  /** Texto gris a la derecha. */
  hint?: string
  /** Sinónimos que también encuentran el elemento («preferencias» → Ajustes). */
  keywords?: string
  run: () => void
}

export { normalize }

/**
 * Filtra por palabras (todas deben aparecer en la etiqueta o en los sinónimos) y ordena por grupo;
 * dentro de cada grupo, primero lo que empieza por la búsqueda.
 */
export function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const terms = words(query)
  const matched = items.filter((it) => matchesAll(`${it.label} ${it.keywords ?? ''}`, terms))
  const first = terms[0] ?? ''
  return [...matched].sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
    if (g) return g
    const pa = normalize(a.label).startsWith(first) ? 0 : 1
    const pb = normalize(b.label).startsWith(first) ? 0 : 1
    return pa - pb
  })
}

/**
 * Opción preseleccionada: la primera cuyo nombre empieza por lo escrito («nuevo» → «Nuevo proyecto…»).
 * Si ninguna empieza así, la primera de la lista (preguntar a Muninn).
 */
export function bestMatch(items: PaletteItem[], query: string): number {
  const q = normalize(query).trim()
  if (!q) return 0
  const i = items.findIndex((it) => it.group !== 'ask' && normalize(it.label).startsWith(q))
  return i < 0 ? 0 : i
}

/** Tramo de la etiqueta que coincide con la primera palabra buscada, para resaltarlo. */
export function matchRange(label: string, query: string): [number, number] | null {
  const word = words(query)[0]
  if (!word) return null
  const i = normalize(label).indexOf(word)
  return i < 0 ? null : [i, i + word.length]
}

/** Agrupa conservando el orden, para pintar cabeceras. */
export function groupItems(items: PaletteItem[]) {
  const groups: { group: PaletteGroup; items: PaletteItem[] }[] = []
  for (const it of items) {
    const last = groups.at(-1)
    if (last?.group === it.group) last.items.push(it)
    else groups.push({ group: it.group, items: [it] })
  }
  return groups
}

interface FoundTask {
  id: string
  title: string
  projectId: string
}

interface FoundNote {
  id: string
  title: string
  projectId: string | null
}

/**
 * Tareas y notas que ha encontrado el core, como opciones. Las tareas llevan su proyecto a la derecha. Ya
 * vienen filtradas (también por descripción o contenido): los sinónimos son la búsqueda, para que `filterItems`
 * no las quite.
 */
export function searchResultItems(
  found: { tasks: FoundTask[]; notes: FoundNote[] },
  projects: { id: string; name: string }[],
  query: string,
  open: { task: (t: FoundTask) => void; note: (n: FoundNote) => void },
): PaletteItem[] {
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name
  return [
    ...found.tasks.map(
      (t): PaletteItem => ({
        id: `task-${t.id}`,
        group: 'tasks',
        label: t.title,
        icon: 'check',
        hint: projectName(t.projectId),
        keywords: query,
        run: () => open.task(t),
      }),
    ),
    ...found.notes.map(
      (n): PaletteItem => ({
        id: `note-${n.id}`,
        group: 'notes',
        label: noteTitle(n),
        icon: 'notes',
        hint: projectName(n.projectId),
        keywords: query,
        run: () => open.note(n),
      }),
    ),
  ]
}
