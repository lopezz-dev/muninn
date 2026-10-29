import type { AppIconName } from '../../components/AppIcon'

export interface SettingsSection {
  id: string
  label: string
  icon: AppIconName
  /** Una línea bajo el título de la sección: para qué es. */
  subtitle: string
  group: SettingsGroupId
  /** Color del recuadro del icono en el móvil y en la cabecera (el de su módulo, si tiene). */
  tile: string
  /** La guía que lo explica, para la columna «En la documentación». */
  doc?: { pagina: string; hash?: string; title: string; text: string }
  /** Si aún no está disponible: qué será y cuándo llega. */
  soon?: { phase: string; text: string }
}

export const SETTINGS_GROUPS = [
  { id: 'tu', label: 'Tú' },
  { id: 'espacio', label: 'Espacio de trabajo' },
  { id: 'asistente', label: 'Asistente' },
  { id: 'integraciones', label: 'Integraciones' },
  { id: 'datos', label: 'Datos' },
] as const

export type SettingsGroupId = (typeof SETTINGS_GROUPS)[number]['id']

/** Secciones de Ajustes por grupos (ADR-0053). «Acerca de» va aparte, al pie del menú. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'cuenta',
    label: 'Cuenta',
    icon: 'user',
    subtitle: 'Con qué entras, dónde está abierta tu sesión y qué apps usan tu cuenta.',
    group: 'tu',
    tile: 'bg-project-blue/15 text-project-blue',
    doc: {
      pagina: 'cuenta-y-seguridad',
      title: 'Cuenta y seguridad',
      text: 'El segundo factor, las sesiones abiertas y las apps con acceso a tu cuenta.',
    },
  },
  {
    id: 'apariencia',
    label: 'Apariencia',
    icon: 'palette',
    subtitle: 'Cómo se ve Muninn. Te sigue a todos tus dispositivos.',
    group: 'tu',
    tile: 'bg-accent-soft text-accent',
    doc: {
      pagina: 'moverte-por-muninn',
      hash: 'cambiar-la-apariencia',
      title: 'Moverte por Muninn › Apariencia',
      text: 'Cristal y color de acento: qué cambia cada uno y dónde se guarda.',
    },
  },
  {
    id: 'atajos',
    label: 'Atajos de teclado',
    icon: 'keyboard',
    subtitle: 'Todo lo que puedes hacer sin soltar el teclado.',
    group: 'tu',
    tile: 'bg-surface-raised text-fg-muted',
    doc: {
      pagina: 'moverte-por-muninn',
      hash: 'atajos-de-teclado',
      title: 'Moverte por Muninn › Atajos',
      text: 'Los atajos del buscador, del tablero y de los diálogos.',
    },
  },
  {
    id: 'modulos',
    label: 'Módulos',
    icon: 'more',
    subtitle: 'Activa solo lo que uses. Lo desactivado sale del menú; tus datos siguen guardados.',
    group: 'espacio',
    tile: 'bg-project-teal/15 text-project-teal',
    doc: {
      pagina: 'moverte-por-muninn',
      hash: 'activar-y-desactivar-modulos',
      title: 'Moverte por Muninn › Módulos',
      text: 'Qué pasa al desactivar un módulo y cómo volver a activarlo.',
    },
  },
  {
    id: 'notificaciones',
    label: 'Notificaciones',
    icon: 'bell',
    subtitle: 'Avisos en el móvil y en el ordenador, aunque Muninn esté cerrada.',
    group: 'espacio',
    tile: 'bg-project-amber/15 text-project-amber',
    doc: {
      pagina: 'notificaciones',
      title: 'Notificaciones',
      text: 'Cómo activar los avisos en el iPhone y qué te avisa Muninn.',
    },
  },
  {
    id: 'asistente',
    label: 'Modelo local',
    icon: 'assistant',
    subtitle: 'El modelo de tu ordenador que usa el Asistente, con Ollama.',
    group: 'asistente',
    tile: 'bg-project-green/15 text-project-green',
    doc: {
      pagina: 'asistente',
      hash: 'instalar-ollama',
      title: 'Asistente › Instalar Ollama',
      text: 'Cómo instalar Ollama y el modelo recomendado, paso a paso.',
    },
  },
  {
    id: 'informe',
    label: 'Informe de la mañana',
    icon: 'sun',
    subtitle: 'Cada día, una nota fijada con lo que tienes para hoy.',
    group: 'asistente',
    tile: 'bg-project-amber/15 text-project-amber',
    doc: {
      pagina: 'asistente',
      hash: 'informe-de-la-manana',
      title: 'Asistente › Informe de la mañana',
      text: 'Qué incluye, cuándo se hace y qué pasa si el ordenador está apagado.',
    },
  },
  {
    id: 'integraciones',
    label: 'GitHub',
    icon: 'github',
    subtitle: 'Las issues de tus repositorios, como tareas de su proyecto.',
    group: 'integraciones',
    tile: 'bg-project-violet/15 text-project-violet',
    doc: {
      pagina: 'github',
      title: 'GitHub',
      text: 'Cómo se sincronizan las issues y qué cambia en cada lado.',
    },
  },
  {
    id: 'datos',
    label: 'Datos y sincronización',
    icon: 'sync',
    subtitle: 'Dónde se guardan tus datos y cómo viajan entre dispositivos.',
    group: 'datos',
    tile: 'bg-project-blue/15 text-project-blue',
    doc: {
      pagina: 'datos-y-privacidad',
      title: 'Tus datos y privacidad',
      text: 'Dónde se guarda todo, quién puede verlo y qué queda sin conexión.',
    },
  },
]

export const ABOUT_SECTION: SettingsSection = {
  id: 'acerca',
  label: 'Acerca de Muninn',
  icon: 'info',
  subtitle: 'Versión, documentación y código.',
  group: 'datos',
  tile: 'bg-surface-raised text-fg-muted',
}

const ALL = [...SETTINGS_SECTIONS, ABOUT_SECTION]

export const settingsSection = (id: string) => ALL.find((s) => s.id === id)

/** Las secciones por grupo, en el orden del menú. */
export const sectionsByGroup = () =>
  SETTINGS_GROUPS.map((g) => ({
    ...g,
    sections: SETTINGS_SECTIONS.filter((s) => s.group === g.id),
  }))
