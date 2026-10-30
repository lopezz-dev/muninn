import { Avatar, cn, Icon, IconButton, icons, notify, Switch } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { dockLabel, useDock } from '../../lib/dock'
import { changeDock } from '../../lib/dock-actions'
import { useEnabledModules } from '../../lib/modules'
import { useAuth, useMuninn } from '../../lib/muninn'
import {
  DOCK_MAX,
  DOCK_OPTIONS,
  DOCK_TAB,
  type DockTab,
  moveDockTab,
  sectionEnabled,
  toggleDockTab,
} from '../../shell/nav'
import { PrefGroup } from './ui'

const row =
  'flex min-h-[52px] items-center gap-3 border-t border-border-subtle px-4 first:border-t-0 md:px-[18px]'

/** Vista previa de la barra tal como queda, con el avatar a la derecha. */
function Preview({ tabs }: { tabs: DockTab[] }) {
  const auth = useAuth()
  return (
    <div
      aria-hidden="true"
      className="flex h-[54px] gap-1.5 rounded-dock border border-border bg-bg p-1.5"
    >
      {tabs.map((id) => (
        <span
          key={id}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md bg-surface text-2xs text-fg-muted"
        >
          <Icon name={DOCK_TAB[id].icon} size={17} />
          <span className="max-w-full truncate px-1">{DOCK_TAB[id].label}</span>
        </span>
      ))}
      <span className="grid w-11 shrink-0 place-items-center rounded-md bg-surface">
        {auth.kind === 'user' ? (
          <Avatar name={auth.account.name} src={auth.account.avatarUrl} size="sm" />
        ) : (
          <Icon name="user" size={17} className="text-fg-subtle" />
        )}
      </span>
    </div>
  )
}

/**
 * Ajustes › Barra de abajo (ADR-0072): de una a cuatro pestañas y su orden. Cada cambio se guarda al momento, con
 * «Deshacer». Las de un módulo desactivado se pueden dejar puestas, pero no se ven mientras siga apagado.
 */
export function Barra() {
  const m = useMuninn()
  const qc = useQueryClient()
  const auth = useAuth()
  const modules = useEnabledModules()
  const dock = useDock()
  const off = (id: DockTab) => id !== 'search' && !sectionEnabled(id, modules)
  const visible = dock.filter((id) => !off(id))
  const rest = DOCK_OPTIONS.filter((id) => !dock.includes(id))

  const apply = (next: DockTab[] | null, title: string) => {
    if (next) void changeDock(m, qc, dock, next, title, auth.kind === 'user')
  }
  const toggle = (id: DockTab) => {
    const next = toggleDockTab(dock, id)
    if (!next) {
      notify.info(
        dock.includes(id)
          ? 'La barra necesita al menos una pestaña'
          : `Caben ${DOCK_MAX} pestañas: quita una antes`,
      )
      return
    }
    apply(
      next,
      next.includes(id)
        ? `${dockLabel(id)} añadida a la barra`
        : `${dockLabel(id)} quitada de la barra`,
    )
  }
  const move = (id: DockTab, delta: -1 | 1) =>
    apply(
      moveDockTab(dock, id, delta),
      `${dockLabel(id)} ${delta < 0 ? 'a la izquierda' : 'a la derecha'}`,
    )

  return (
    <>
      <Preview tabs={visible.length ? visible : ['home']} />
      <PrefGroup
        title="En la barra"
        icon="dock"
        action={
          <span className="rounded-full bg-accent-soft px-2 py-px text-2xs font-semibold text-accent tabular">
            {dock.length}/{DOCK_MAX}
          </span>
        }
      >
        <ul id="ajuste-barra-pestanas">
          {dock.map((id, i) => (
            <li key={id} className={row}>
              <Icon name={DOCK_TAB[id].icon} size={19} className="text-fg-subtle" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base">{DOCK_TAB[id].label}</span>
                {off(id) ? (
                  <span className="text-xs text-fg-faint">Módulo desactivado: no se ve</span>
                ) : null}
              </span>
              <IconButton
                size="sm"
                aria-label={`Mover ${DOCK_TAB[id].label} a la izquierda`}
                icon={<icons.chevronUp />}
                disabled={i === 0}
                onClick={() => move(id, -1)}
              />
              <IconButton
                size="sm"
                aria-label={`Mover ${DOCK_TAB[id].label} a la derecha`}
                icon={<icons.chevronDown />}
                disabled={i === dock.length - 1}
                onClick={() => move(id, 1)}
              />
              <Switch
                checked
                disabled={dock.length <= 1}
                aria-label={`Quitar ${DOCK_TAB[id].label} de la barra`}
                onCheckedChange={() => toggle(id)}
                className="ml-1.5"
              />
            </li>
          ))}
        </ul>
      </PrefGroup>
      <PrefGroup
        title="Fuera de la barra"
        icon="more"
        description="Lo que no está abajo sigue a un toque en tu avatar, en «Ir a»."
      >
        <ul>
          {rest.map((id) => (
            <li key={id} className={cn(row, off(id) && 'text-fg-muted')}>
              <Icon name={DOCK_TAB[id].icon} size={19} className="text-fg-subtle" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base">{DOCK_TAB[id].label}</span>
                {off(id) ? (
                  <span className="text-xs text-fg-faint">Módulo desactivado</span>
                ) : id === 'search' ? (
                  <span className="text-xs text-fg-faint">Abre el buscador</span>
                ) : null}
              </span>
              <Switch
                checked={false}
                aria-label={`Añadir ${DOCK_TAB[id].label} a la barra`}
                onCheckedChange={() => toggle(id)}
                className={cn(dock.length >= DOCK_MAX && 'opacity-50')}
              />
            </li>
          ))}
          <li className={cn(row, 'text-fg-muted')}>
            <Icon name="assistant" size={19} className="text-fg-faint" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base">Asistente</span>
              <span className="text-xs text-fg-faint">
                Aún no contesta en el móvil: usa el del ordenador
              </span>
            </span>
            <Switch
              checked={false}
              disabled
              aria-label="Añadir Asistente a la barra"
              onCheckedChange={() => {}}
            />
          </li>
        </ul>
      </PrefGroup>
      <p className="px-0.5 text-xs text-fg-faint">
        {auth.kind === 'user'
          ? 'Se guarda en tu cuenta: te sigue a todos tus dispositivos.'
          : 'Estás en modo demo: se pierde al recargar.'}
      </p>
    </>
  )
}
