import { t } from '../i18n'
import type { settings as en } from '../i18n/locales/en/settings'
import { matchesAll, words } from './text'

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

type IndexId = keyof typeof en.index

/**
 * Una entrada con sus textos como *getters*: se leen al buscar, en el idioma activo (ADR-0077). Los textos van en
 * `index.<id>` del namespace `settings`, en los dos idiomas.
 */
const entry = (id: IndexId, section: string): SettingEntry => ({
  id,
  section,
  get label() {
    return t(`index.${id}.label`, { ns: 'settings' })
  },
  get description() {
    return t(`index.${id}.description`, { ns: 'settings' })
  },
  get keywords() {
    return t(`index.${id}.keywords`, { ns: 'settings' })
  },
})

export const SETTINGS_INDEX: SettingEntry[] = [
  entry('acceso', 'cuenta'),
  entry('sesion', 'cuenta'),
  entry('segundo-factor', 'cuenta'),
  entry('sesiones', 'cuenta'),
  entry('cerrar-sesiones', 'cuenta'),
  entry('apps', 'cuenta'),
  entry('idioma', 'apariencia'),
  entry('tema', 'apariencia'),
  entry('cristal', 'apariencia'),
  entry('acento', 'apariencia'),
  entry('barra-pestanas', 'barra'),
  entry('atajos-buscador', 'atajos'),
  entry('atajos-tablero', 'atajos'),
  entry('modulo-tasks', 'modulos'),
  entry('modulo-notes', 'modulos'),
  entry('modulo-finance', 'modulos'),
  entry('modulo-github', 'modulos'),
  entry('modulo-news', 'modulos'),
  entry('avisos', 'notificaciones'),
  entry('avisos-cobros', 'notificaciones'),
  entry('avisos-dispositivos', 'notificaciones'),
  entry('ollama', 'asistente'),
  entry('modelo', 'asistente'),
  entry('informe-activo', 'informe'),
  entry('informe-hora', 'informe'),
  entry('informe-ahora', 'informe'),
  entry('github-estado', 'integraciones'),
  entry('repos', 'integraciones'),
  entry('donde', 'datos'),
  entry('dispositivos', 'datos'),
  entry('sin-conexion', 'datos'),
  entry('version', 'acerca'),
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
  const terms = words(query)
  if (terms.length === 0) return []
  return entries
    .map((e, i) => {
      const hay = `${e.label} ${e.description} ${e.keywords ?? ''} ${sectionLabel(e.section)}`
      if (!matchesAll(hay, terms)) return null
      return { e, i, inLabel: matchesAll(e.label, terms) }
    })
    .filter((x) => x !== null)
    .sort((a, b) => Number(b.inLabel) - Number(a.inLabel) || a.i - b.i)
    .map((x) => x.e)
}
