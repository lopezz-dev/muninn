import type { AppIconName } from '../../components/AppIcon'
import { t } from '../../i18n'
import type { settings as en } from '../../i18n/locales/en/settings'

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

const GROUP_IDS = ['tu', 'espacio', 'asistente', 'integraciones', 'datos'] as const

export type SettingsGroupId = (typeof GROUP_IDS)[number]

/** Grupos del menú. `label` se lee al pintar, en el idioma activo (ADR-0077). */
export const SETTINGS_GROUPS = GROUP_IDS.map((id) => ({
  id,
  get label() {
    return t(`groups.${id}`, { ns: 'settings' })
  },
}))

type SectionKey = keyof typeof en.sections
type DocKey = keyof typeof en.docs

/**
 * Una sección con sus textos como *getters*: se leen al pintar, en el idioma activo (ADR-0077). El `id` es un slug
 * de la ruta y no se traduce.
 */
function section(
  id: SectionKey,
  rest: Omit<SettingsSection, 'id' | 'label' | 'subtitle' | 'doc'> & {
    doc?: { pagina: string; hash?: string }
  },
): SettingsSection {
  const { doc, ...base } = rest
  return {
    id,
    ...base,
    get label() {
      return t(`sections.${id}.label`, { ns: 'settings' })
    },
    get subtitle() {
      return t(`sections.${id}.subtitle`, { ns: 'settings' })
    },
    ...(doc
      ? {
          doc: {
            ...doc,
            get title() {
              return t(`docs.${id as DocKey}.title`, { ns: 'settings' })
            },
            get text() {
              return t(`docs.${id as DocKey}.text`, { ns: 'settings' })
            },
          },
        }
      : {}),
  }
}

/** Secciones de Ajustes por grupos (ADR-0053). «Acerca de» va aparte, al pie del menú. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  section('cuenta', {
    icon: 'user',
    group: 'tu',
    tile: 'bg-project-blue/15 text-project-blue',
    doc: { pagina: 'cuenta-y-seguridad' },
  }),
  section('apariencia', {
    icon: 'palette',
    group: 'tu',
    tile: 'bg-accent-soft text-accent',
    doc: { pagina: 'moverte-por-muninn', hash: 'cambiar-la-apariencia' },
  }),
  section('barra', {
    icon: 'dock',
    group: 'tu',
    tile: 'bg-accent-soft text-accent',
    doc: { pagina: 'moverte-por-muninn', hash: 'elegir-las-pestanas-de-abajo' },
  }),
  section('atajos', {
    icon: 'keyboard',
    group: 'tu',
    tile: 'bg-surface-raised text-fg-muted',
    doc: { pagina: 'moverte-por-muninn', hash: 'atajos-de-teclado' },
  }),
  section('modulos', {
    icon: 'more',
    group: 'espacio',
    tile: 'bg-project-teal/15 text-project-teal',
    doc: { pagina: 'moverte-por-muninn', hash: 'activar-y-desactivar-modulos' },
  }),
  section('notificaciones', {
    icon: 'bell',
    group: 'espacio',
    tile: 'bg-project-amber/15 text-project-amber',
    doc: { pagina: 'notificaciones' },
  }),
  section('asistente', {
    icon: 'assistant',
    group: 'asistente',
    tile: 'bg-project-green/15 text-project-green',
    doc: { pagina: 'asistente', hash: 'instalar-ollama' },
  }),
  section('informe', {
    icon: 'sun',
    group: 'asistente',
    tile: 'bg-project-amber/15 text-project-amber',
    doc: { pagina: 'asistente', hash: 'informe-de-la-manana' },
  }),
  section('integraciones', {
    icon: 'github',
    group: 'integraciones',
    tile: 'bg-project-violet/15 text-project-violet',
    doc: { pagina: 'github' },
  }),
  section('datos', {
    icon: 'sync',
    group: 'datos',
    tile: 'bg-project-blue/15 text-project-blue',
    doc: { pagina: 'datos-y-privacidad' },
  }),
]

export const ABOUT_SECTION: SettingsSection = section('acerca', {
  icon: 'info',
  group: 'datos',
  tile: 'bg-surface-raised text-fg-muted',
})

const ALL = [...SETTINGS_SECTIONS, ABOUT_SECTION]

export const settingsSection = (id: string) => ALL.find((s) => s.id === id)

/** Las secciones por grupo, en el orden del menú. */
export const sectionsByGroup = () =>
  SETTINGS_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    sections: SETTINGS_SECTIONS.filter((s) => s.group === g.id),
  }))

/** El aviso al restablecer una sección entera (lo comparten la pantalla de Ajustes y la hoja «Tu cuenta»). */
export const resetSectionLabel = (section: SettingsSection) =>
  section.id === 'apariencia'
    ? t('reset.appearance', { ns: 'settings' })
    : section.id === 'informe'
      ? t('reset.report', { ns: 'settings' })
      : t('reset.section', { ns: 'settings', section: section.label })
