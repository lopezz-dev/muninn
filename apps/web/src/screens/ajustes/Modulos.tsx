import type { ModuleName } from '@muninn/core'
import { cn, Icon, type IconName, Switch } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { t } from '../../i18n'
import { setModuleEnabled } from '../../lib/module-actions'
import { MODULE_ORDER, useEnabledModules } from '../../lib/modules'
import { useMuninn } from '../../lib/muninn'
import { PrefGroup } from './ui'

interface ModuleInfo {
  label: string
  text: string
  icon: IconName
  tile: string
  /** Fase en la que llega su pantalla, si aún no existe. */
  soon?: string
  /** Aún no se puede activar. */
  locked?: boolean
}

/** Un módulo con sus textos como *getters*: se leen al pintar, en el idioma activo (ADR-0077). */
const moduleInfo = (
  id: ModuleName,
  rest: Omit<ModuleInfo, 'label' | 'text' | 'soon'> & { soon?: true },
): ModuleInfo => {
  const { soon, ...base } = rest
  return {
    ...base,
    get label() {
      return t(`modules.items.${id}.label`, { ns: 'settings' })
    },
    get text() {
      return t(`modules.items.${id}.text`, { ns: 'settings' })
    },
    ...(soon
      ? {
          get soon() {
            return t('modules.soon', { ns: 'settings' })
          },
        }
      : {}),
  }
}

const MODULES: Record<ModuleName, ModuleInfo> = {
  tasks: moduleInfo('tasks', { icon: 'projects', tile: 'bg-project-blue/15 text-project-blue' }),
  notes: moduleInfo('notes', { icon: 'notes', tile: 'bg-project-teal/15 text-project-teal' }),
  finance: moduleInfo('finance', {
    icon: 'finance',
    tile: 'bg-project-amber/15 text-project-amber',
  }),
  github: moduleInfo('github', {
    icon: 'github',
    tile: 'bg-project-violet/15 text-project-violet',
  }),
  news: moduleInfo('news', { icon: 'news', tile: 'bg-project-pink/15 text-project-pink' }),
  focus: moduleInfo('focus', {
    icon: 'clock',
    tile: 'bg-surface-raised text-fg-subtle',
    soon: true,
    locked: true,
  }),
}

/** Ajustes › Módulos (Ajustes.dc.html): activa solo lo que uses; lo demás sale del menú, de las pestañas y del buscador. */
export function Modulos() {
  const { t } = useTranslation('settings')
  const m = useMuninn()
  const qc = useQueryClient()
  const enabled = useEnabledModules()

  return (
    <PrefGroup
      title={t('modules.title')}
      icon="more"
      action={
        enabled ? (
          <span className="text-xs text-fg-faint">
            {t('modules.active', {
              on: MODULE_ORDER.filter((x) => x !== 'focus' && enabled.has(x)).length,
              total: MODULE_ORDER.length - 1,
            })}
          </span>
        ) : null
      }
    >
      <ul>
        {MODULE_ORDER.map((id) => {
          const info = MODULES[id]
          const on = enabled ? enabled.has(id) : true
          return (
            <li
              key={id}
              id={`ajuste-modulo-${id}`}
              className="flex items-center gap-3.5 border-t border-border-subtle px-4 py-3.5 first:border-t-0 md:px-[18px]"
            >
              <span
                className={cn('grid size-8 shrink-0 place-items-center rounded-full', info.tile)}
              >
                <Icon name={info.icon} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <label
                  htmlFor={`modulo-${id}`}
                  className="flex flex-wrap items-center gap-2 text-base font-medium"
                >
                  {info.label}
                  {info.soon ? (
                    <span className="rounded-xs bg-accent-soft px-1.5 py-px text-2xs font-semibold tracking-wide text-accent uppercase">
                      {info.locked
                        ? info.soon
                        : t('modules.arrivesIn', { phase: info.soon.toLowerCase() })}
                    </span>
                  ) : null}
                </label>
                <span className="text-[12.5px] text-fg-subtle">{info.text}</span>
              </div>
              <Switch
                id={`modulo-${id}`}
                checked={on && !info.locked}
                disabled={info.locked || !enabled}
                onCheckedChange={(next) =>
                  setModuleEnabled(m, qc, id, next, { label: info.label, icon: info.icon })
                }
              />
            </li>
          )
        })}
      </ul>
    </PrefGroup>
  )
}
