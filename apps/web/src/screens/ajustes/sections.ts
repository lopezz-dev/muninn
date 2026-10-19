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
  {
    id: 'cuenta',
    label: 'Cuenta',
    icon: 'user',
    soon: {
      phase: 'Fase 1',
      text: 'Tu perfil y tu sesión aparecerán aquí cuando llegue el inicio de sesión.',
    },
  },
  {
    id: 'modulos',
    label: 'Módulos',
    icon: 'more',
    soon: {
      phase: 'Fase 1',
      text: 'Podrás activar solo lo que uses: lo desactivado desaparecerá del menú y del asistente.',
    },
  },
  { id: 'apariencia', label: 'Apariencia', icon: 'palette' },
  {
    id: 'asistente',
    label: 'Asistente e IA',
    icon: 'assistant',
    soon: {
      phase: 'Fase 4',
      text: 'Elegirás el cerebro del asistente (un modelo local o Claude), la voz y el resumen diario.',
    },
  },
  {
    id: 'integraciones',
    label: 'Integraciones',
    icon: 'github',
    soon: {
      phase: 'Fase 2',
      text: 'Conecta GitHub para convertir issues en tareas y trabajar con agentes.',
    },
  },
  {
    id: 'notificaciones',
    label: 'Notificaciones',
    icon: 'bell',
    soon: {
      phase: 'Fase 3',
      text: 'Avisos en el móvil antes de cada cobro y cuando un agente termine su trabajo.',
    },
  },
  {
    id: 'datos',
    label: 'Datos y sincronización',
    icon: 'sync',
    soon: {
      phase: 'Fase 1',
      text: 'Ahora mismo estás en modo demo: tus datos viven en memoria y se pierden al recargar. Con el inicio de sesión se guardarán y se sincronizarán entre tus dispositivos.',
    },
  },
  { id: 'atajos', label: 'Atajos de teclado', icon: 'keyboard' },
]

export const settingsSection = (id: string) => SETTINGS_SECTIONS.find((s) => s.id === id)
