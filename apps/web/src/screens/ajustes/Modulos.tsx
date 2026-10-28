import type { ModuleName } from '@muninn/core'
import { Card, cn, Icon, type IconName, Switch } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { setModuleEnabled } from '../../lib/module-actions'
import { MODULE_ORDER, useEnabledModules } from '../../lib/modules'
import { useMuninn } from '../../lib/muninn'

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

const MODULES: Record<ModuleName, ModuleInfo> = {
  tasks: {
    label: 'Tareas y proyectos',
    text: 'Kanban por proyecto',
    icon: 'projects',
    tile: 'bg-project-blue/15 text-project-blue',
  },
  notes: {
    label: 'Notas',
    text: 'Markdown vinculado a proyectos',
    icon: 'notes',
    tile: 'bg-project-teal/15 text-project-teal',
  },
  finance: {
    label: 'Finanzas',
    text: 'Gastos, ingresos, ahorro, inversión y suscripciones',
    icon: 'finance',
    tile: 'bg-project-amber/15 text-project-amber',
  },
  github: {
    label: 'GitHub',
    text: 'Issues como tareas y agentes',
    icon: 'github',
    tile: 'bg-project-violet/15 text-project-violet',
  },
  news: {
    label: 'Noticias',
    text: 'RSS con resumen local',
    icon: 'news',
    tile: 'bg-project-pink/15 text-project-pink',
  },
  focus: {
    label: 'Concentración',
    text: 'Bloques de trabajo profundo con la isla',
    icon: 'clock',
    tile: 'bg-surface-raised text-fg-subtle',
    soon: 'Próximamente',
    locked: true,
  },
}

/** Ajustes › Módulos (Ajustes.dc.html): activa solo lo que uses; lo demás sale del menú, del dock y del buscador. */
export function Modulos() {
  const m = useMuninn()
  const qc = useQueryClient()
  const enabled = useEnabledModules()

  return (
    <Card className="px-[18px] pt-4 pb-1.5">
      <h2 className="text-md font-semibold">Módulos</h2>
      <p className="mt-1 mb-2.5 text-[13px] text-fg-subtle">
        Activa solo lo que uses. Lo desactivado desaparece del menú, del dock y del buscador; tus
        datos siguen guardados.
      </p>
      <ul>
        {MODULE_ORDER.map((id) => {
          const info = MODULES[id]
          const on = enabled ? enabled.has(id) : true
          return (
            <li
              key={id}
              className="flex items-center gap-3.5 border-t border-border-subtle py-3 first:border-t-0"
            >
              <span
                className={cn('grid size-[30px] shrink-0 place-items-center rounded-lg', info.tile)}
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
                      {info.locked ? info.soon : `Llega en la ${info.soon.toLowerCase()}`}
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
    </Card>
  )
}
