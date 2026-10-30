import type { ModuleName } from '@muninn/core'
import type { IconName } from '@muninn/ui'

/** Secciones de la app. El orden de `SIDEBAR_MAIN` y `DOCK_OPTIONS` sigue el diseño. */
export const SECTIONS = {
  home: { label: 'Inicio', icon: 'home', to: '/' },
  projects: { label: 'Proyectos', icon: 'projects', to: '/proyectos' },
  notes: { label: 'Notas', icon: 'notes', to: '/notas' },
  finance: { label: 'Finanzas', icon: 'finance', to: '/finanzas' },
  assistant: { label: 'Asistente', icon: 'assistant', to: '/asistente' },
  news: { label: 'Noticias', icon: 'news', to: '/noticias' },
  github: { label: 'GitHub', icon: 'github', to: '/github' },
  docs: { label: 'Documentación', icon: 'docs', to: '/documentacion' },
  settings: { label: 'Ajustes', icon: 'settings', to: '/ajustes' },
} as const satisfies Record<string, { label: string; icon: IconName; to: string }>

export type SectionId = keyof typeof SECTIONS

export const SIDEBAR_MAIN: SectionId[] = [
  'home',
  'projects',
  'notes',
  'finance',
  'assistant',
  'news',
  'github',
]

/** Sección a la que pertenece una ruta (`/proyectos/abc` → `projects`). */
export function sectionOf(pathname: string): SectionId | null {
  const first = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`
  for (const [id, s] of Object.entries(SECTIONS)) {
    if (s.to === first) return id as SectionId
  }
  return null
}

/** Módulo que da acceso a cada sección. Las que no aparecen aquí (Inicio, Asistente, Documentación…) siempre están. */
export const SECTION_MODULE: Partial<Record<SectionId, ModuleName>> = {
  projects: 'tasks',
  notes: 'notes',
  finance: 'finance',
  news: 'news',
  github: 'github',
}

/** Módulos activos (`user_settings.enabled_modules`), o `null` mientras no se sepa. */
export type EnabledModules = ReadonlySet<ModuleName> | null

/** Con `null` (aún sin saber) cuenta como activa: mejor enseñar de más que esconder lo que existe. */
export function sectionEnabled(id: SectionId, modules: EnabledModules): boolean {
  const m = SECTION_MODULE[id]
  return !m || !modules || modules.has(m)
}

/**
 * Pestañas que se pueden poner en la barra del teléfono (ADR-0072): secciones y «Buscar», que abre el buscador. El
 * Asistente no, mientras no conteste en el móvil; Ajustes y tu cuenta van siempre en el avatar.
 */
export const DOCK_OPTIONS = [
  'home',
  'projects',
  'notes',
  'finance',
  'news',
  'github',
  'docs',
  'search',
] as const satisfies readonly (SectionId | 'search')[]

export type DockTab = (typeof DOCK_OPTIONS)[number]

/** Lo que se ve de cada pestaña. «Buscar» no es una sección: no tiene ruta. */
export const DOCK_TAB: Record<DockTab, { label: string; icon: IconName }> = {
  ...SECTIONS,
  search: { label: 'Buscar', icon: 'search' },
}

/** Caben de 1 a 4 pestañas, más el avatar. */
export const DOCK_MAX = 4

export const DEFAULT_DOCK: readonly DockTab[] = ['home', 'projects', 'finance', 'notes']

const isDockTab = (v: unknown): v is DockTab =>
  typeof v === 'string' && (DOCK_OPTIONS as readonly string[]).includes(v)

/**
 * La barra guardada (`user_settings.preferences.dock`), validada: sin repetidos ni valores desconocidos y como mucho
 * cuatro. Vacía o sin guardar, la de fábrica.
 */
export function parseDock(value: unknown): DockTab[] {
  if (!Array.isArray(value)) return [...DEFAULT_DOCK]
  const out = [...new Set(value.filter(isDockTab))].slice(0, DOCK_MAX)
  return out.length ? out : [...DEFAULT_DOCK]
}

/** Las pestañas que quedan con los módulos activos. Si no queda ninguna, Inicio. */
export function tabsFor(
  modules: EnabledModules,
  dock: readonly DockTab[] = DEFAULT_DOCK,
): DockTab[] {
  const out = dock.filter((id) => id === 'search' || sectionEnabled(id, modules))
  return out.length ? out : ['home']
}

/** Pestaña activa, o -1 si la sección no está en la barra («Buscar» nunca lo está: abre el buscador). */
export function tabIndexOf(section: SectionId | null, tabs: readonly DockTab[]): number {
  return section ? tabs.indexOf(section as DockTab) : -1
}

/** Añade o quita una pestaña. `null` si no se puede: la última no se quita y no caben más de cuatro. */
export function toggleDockTab(dock: readonly DockTab[], id: DockTab): DockTab[] | null {
  if (dock.includes(id)) return dock.length > 1 ? dock.filter((x) => x !== id) : null
  return dock.length < DOCK_MAX ? [...dock, id] : null
}

/** Mueve una pestaña un puesto a la izquierda (`-1`) o a la derecha (`1`). `null` si ya está en el borde. */
export function moveDockTab(
  dock: readonly DockTab[],
  id: DockTab,
  delta: -1 | 1,
): DockTab[] | null {
  const i = dock.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= dock.length) return null
  const out = [...dock]
  ;[out[i], out[j]] = [out[j] as DockTab, out[i] as DockTab]
  return out
}
