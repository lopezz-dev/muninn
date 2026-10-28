import { normalize } from './text'

/**
 * Lo que encuentra el buscador de Ajustes (ADR-0053): cada ajuste con su sección y el `id` de su fila, para ir a
 * ella y resaltarla. El buscador lista y lleva; el ajuste se cambia solo en su fila, nunca en una copia.
 */
export interface SettingEntry {
  /** Fila de destino: `ajuste-<id>` en la página de la sección. */
  id: string
  section: string
  label: string
  description: string
  /** Otras palabras con que alguien lo buscaría. */
  keywords?: string
  /** Aún no existe: sale en los resultados, pero marcado. */
  soon?: boolean
}

export const SETTINGS_INDEX: SettingEntry[] = [
  {
    id: 'acceso',
    section: 'cuenta',
    label: 'Método de acceso',
    description: 'Entras con un código por correo o con GitHub. Sin contraseñas.',
    keywords: 'login correo email',
  },
  {
    id: 'sesion',
    section: 'cuenta',
    label: 'Cerrar sesión',
    description: 'Se cierra solo en este dispositivo.',
    keywords: 'salir logout',
  },
  {
    id: 'tema',
    section: 'apariencia',
    label: 'Tema',
    description: 'Oscuro. El claro llegará más adelante.',
    keywords: 'modo oscuro claro',
  },
  {
    id: 'cristal',
    section: 'apariencia',
    label: 'Cristal',
    description: 'Desenfoque translúcido en paneles y menús.',
    keywords: 'transparencia desenfoque',
  },
  {
    id: 'acento',
    section: 'apariencia',
    label: 'Color de acento',
    description: 'Botones, selección y la burbuja del dock.',
    keywords: 'color tema',
  },
  {
    id: 'atajos-buscador',
    section: 'atajos',
    label: 'Atajos del buscador',
    description: 'Abrirlo, moverte por los resultados y abrir uno.',
    keywords: 'teclado ctrl k cmd',
  },
  {
    id: 'atajos-tablero',
    section: 'atajos',
    label: 'Atajos del tablero',
    description: 'Nueva tarea y mover tarjetas con el teclado.',
    keywords: 'teclado n espacio flechas',
  },
  {
    id: 'modulo-tasks',
    section: 'modulos',
    label: 'Tareas y proyectos',
    description: 'Kanban por proyecto.',
    keywords: 'modulo activar desactivar',
  },
  {
    id: 'modulo-notes',
    section: 'modulos',
    label: 'Notas',
    description: 'Markdown vinculado a proyectos.',
    keywords: 'modulo activar desactivar',
  },
  {
    id: 'modulo-finance',
    section: 'modulos',
    label: 'Finanzas',
    description: 'Gastos, ingresos, ahorro, inversión y suscripciones.',
    keywords: 'modulo activar desactivar dinero',
  },
  {
    id: 'modulo-github',
    section: 'modulos',
    label: 'GitHub',
    description: 'Issues como tareas y agentes.',
    keywords: 'modulo activar desactivar',
  },
  {
    id: 'modulo-news',
    section: 'modulos',
    label: 'Noticias',
    description: 'RSS con resumen local.',
    keywords: 'modulo activar desactivar rss',
  },
  {
    id: 'avisos',
    section: 'notificaciones',
    label: 'Avisos antes de cada cobro',
    description: 'En el móvil, antes de que te cobren una suscripción.',
    keywords: 'notificaciones push suscripciones',
    soon: true,
  },
  {
    id: 'ollama',
    section: 'asistente',
    label: 'Dirección de Ollama',
    description: 'Dónde está Ollama en tu ordenador.',
    keywords: 'servidor url local',
  },
  {
    id: 'modelo',
    section: 'asistente',
    label: 'Modelo',
    description: 'El modelo de Ollama que usa el Asistente.',
    keywords: 'qwen ia llm',
  },
  {
    id: 'informe-activo',
    section: 'informe',
    label: 'Informe de la mañana',
    description: 'Cada día, una nota fijada con lo que tienes para hoy.',
    keywords: 'resumen diario',
  },
  {
    id: 'informe-hora',
    section: 'informe',
    label: 'Hora del informe',
    description: 'A qué hora se prepara si el ordenador está encendido.',
    keywords: 'hora',
  },
  {
    id: 'informe-ahora',
    section: 'informe',
    label: 'Hacer ahora',
    description: 'Genera el informe sin esperar a su hora.',
  },
  {
    id: 'github-estado',
    section: 'integraciones',
    label: 'Sincronización de GitHub',
    description: 'Si el módulo está activo y cuándo llegó la última issue.',
    keywords: 'issues sincronizar',
  },
  {
    id: 'repos',
    section: 'integraciones',
    label: 'Repositorio de cada proyecto',
    description: 'Vincula un repositorio de GitHub a cada proyecto.',
    keywords: 'vincular issues repo',
  },
  {
    id: 'donde',
    section: 'datos',
    label: 'Dónde se guardan',
    description: 'En tu cuenta, en un servidor de la Unión Europea.',
    keywords: 'servidor privacidad europa',
  },
  {
    id: 'dispositivos',
    section: 'datos',
    label: 'Entre dispositivos',
    description: 'Lo que cambias en uno aparece al momento en los demás.',
    keywords: 'sincronizar tiempo real',
  },
  {
    id: 'sin-conexion',
    section: 'datos',
    label: 'Sin conexión',
    description: 'Lo último que viste se puede consultar sin red.',
    keywords: 'offline cache',
  },
  {
    id: 'version',
    section: 'acerca',
    label: 'Versión',
    description: 'Qué versión de Muninn tienes.',
    keywords: 'actualizar acerca',
  },
]

/**
 * Busca en el nombre, la descripción, las palabras clave y el nombre de la sección (sin mayúsculas ni tildes; deben
 * estar todas las palabras). Primero los que lo tienen en el nombre; después, en el orden del menú.
 */
export function searchSettings(
  entries: SettingEntry[],
  query: string,
  sectionLabel: (id: string) => string = () => '',
): SettingEntry[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return entries
    .map((e, i) => {
      const hay = normalize(
        `${e.label} ${e.description} ${e.keywords ?? ''} ${sectionLabel(e.section)}`,
      )
      if (!words.every((w) => hay.includes(w))) return null
      const label = normalize(e.label)
      return { e, i, inLabel: words.every((w) => label.includes(w)) }
    })
    .filter((x) => x !== null)
    .sort((a, b) => Number(b.inLabel) - Number(a.inLabel) || a.i - b.i)
    .map((x) => x.e)
}
