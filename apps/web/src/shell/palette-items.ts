import type { IconName } from '@muninn/ui'

export type PaletteGroup = 'ask' | 'nav' | 'projects' | 'actions'

export const GROUP_LABEL: Record<PaletteGroup, string> = {
  ask: 'Preguntar',
  nav: 'Ir a',
  projects: 'Proyectos',
  actions: 'Acciones',
}

const GROUP_ORDER: PaletteGroup[] = ['ask', 'nav', 'projects', 'actions']

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

/** Minúsculas y sin tildes: «documentacion» encuentra «Documentación». Conserva la longitud. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Filtra por palabras (todas deben aparecer en la etiqueta o en los sinónimos) y ordena por grupo;
 * dentro de cada grupo, primero lo que empieza por la búsqueda.
 */
export function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const matched = words.length
    ? items.filter((it) => {
        const hay = normalize(`${it.label} ${it.keywords ?? ''}`)
        return words.every((w) => hay.includes(w))
      })
    : items
  const first = words[0] ?? ''
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
  const word = normalize(query).trim().split(/\s+/)[0]
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
