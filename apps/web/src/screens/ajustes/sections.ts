import type { IconName } from '@muninn/ui'

export interface SettingsSection {
  id: string
  label: string
  icon: IconName
  /** Si aún no está disponible: qué será y cuándo llega. */
  soon?: { phase: string; text: string }
}

/** Secciones de Ajustes en el orden del diseño (Ajustes.dc.html). */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'cuenta', label: 'Cuenta', icon: 'user' },
  { id: 'modulos', label: 'Módulos', icon: 'more' },
  { id: 'apariencia', label: 'Apariencia', icon: 'palette' },
  {
    id: 'asistente',
    label: 'Asistente e IA',
    icon: 'assistant',
  },
  { id: 'integraciones', label: 'Integraciones', icon: 'github' },
  {
    id: 'notificaciones',
    label: 'Notificaciones',
    icon: 'bell',
    soon: {
      phase: 'Fase 3',
      text: 'Avisos en el móvil antes de cada cobro y cuando un agente termine su trabajo.',
    },
  },
  { id: 'datos', label: 'Datos y sincronización', icon: 'sync' },
  { id: 'atajos', label: 'Atajos de teclado', icon: 'keyboard' },
]

export const settingsSection = (id: string) => SETTINGS_SECTIONS.find((s) => s.id === id)
