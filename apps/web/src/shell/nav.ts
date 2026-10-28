import type { ModuleName } from '@muninn/core'
import type { IconName } from '@muninn/ui'

/** Secciones de la app. El orden de `SIDEBAR_*` y `TABS` sigue el diseño. */
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
  more: { label: 'Más', icon: 'more', to: '/mas' },
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
export const SIDEBAR_FOOTER: SectionId[] = ['docs', 'settings']

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
 * Pestañas de la barra del teléfono (ADR-0054). El Asistente no es una pestaña: tiene su propio botón, con el logo,
 * al lado de la barra.
 */
export const TABS: SectionId[] = ['home', 'projects', 'finance', 'more']

/** Las pestañas que quedan con los módulos activos. */
export const tabsFor = (modules: EnabledModules): SectionId[] =>
  TABS.filter((id) => sectionEnabled(id, modules))

/**
 * Pestaña activa: lo que no tiene pestaña propia vive bajo «Más». En el Asistente no hay ninguna (se marca su botón):
 * devuelve -1.
 */
export function tabIndexOf(section: SectionId | null, tabs: readonly SectionId[] = TABS): number {
  if (section === 'assistant') return -1
  const i = section ? tabs.indexOf(section) : -1
  return i >= 0 ? i : tabs.indexOf('more')
}
