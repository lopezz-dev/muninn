import type { IconName } from '@muninn/ui'

/** Secciones de la app. El orden de `SIDEBAR_*` y `DOCK` sigue el diseño. */
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

/** Pestañas del dock móvil: el Asistente en el centro. */
export const DOCK: SectionId[] = ['home', 'projects', 'assistant', 'finance', 'more']

/** Sección a la que pertenece una ruta (`/proyectos/abc` → `projects`). */
export function sectionOf(pathname: string): SectionId | null {
  const first = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`
  for (const [id, s] of Object.entries(SECTIONS)) {
    if (s.to === first) return id as SectionId
  }
  return null
}

/** Pestaña activa del dock: lo que no tiene pestaña propia vive bajo «Más». */
export function dockIndexOf(section: SectionId | null): number {
  const i = section ? DOCK.indexOf(section) : -1
  return i >= 0 ? i : DOCK.indexOf('more')
}
