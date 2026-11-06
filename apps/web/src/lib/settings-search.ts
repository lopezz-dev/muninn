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
  entry('acceso', 'account'),
  entry('sesion', 'account'),
  entry('segundo-factor', 'account'),
  entry('sesiones', 'account'),
  entry('cerrar-sesiones', 'account'),
  entry('aviso-dispositivo-nuevo', 'account'),
  entry('apps', 'account'),
  entry('idioma', 'appearance'),
  entry('tema', 'appearance'),
  entry('cristal', 'appearance'),
  entry('acento', 'appearance'),
  entry('barra-pestanas', 'dock'),
  entry('atajos-buscador', 'shortcuts'),
  entry('atajos-tablero', 'shortcuts'),
  entry('modulo-tasks', 'modules'),
  entry('modulo-notes', 'modules'),
  entry('modulo-finance', 'modules'),
  entry('modulo-github', 'modules'),
  entry('modulo-news', 'modules'),
  entry('avisos', 'notifications'),
  entry('avisos-cobros', 'notifications'),
  entry('avisos-dispositivos', 'notifications'),
  entry('ollama', 'assistant'),
  entry('modelo', 'assistant'),
  entry('informe-activo', 'report'),
  entry('informe-hora', 'report'),
  entry('informe-ahora', 'report'),
  entry('github-estado', 'integrations'),
  entry('repos', 'integrations'),
  entry('donde', 'data'),
  entry('dispositivos', 'data'),
  entry('sin-conexion', 'data'),
  entry('version', 'about'),
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
