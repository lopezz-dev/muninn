import { Avatar, cn, Icon, IconButton, icons, notify, Switch } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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
    <div aria-hidden="true" className="flex h-[54px] items-stretch gap-1.5">
      <div className="flex min-w-0 flex-1 items-center justify-evenly gap-0.5 rounded-full border border-border bg-bg p-1.5">
        {/* Como en la barra de verdad (ADR-0087): solo la activa, aquí la primera, enseña su nombre. */}
        {tabs.map((id, i) =>
          i === 0 ? (
            <span
              key={id}
              className="flex h-full min-w-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent"
            >
              <Icon name={DOCK_TAB[id].icon} size={17} weight="bold" className="shrink-0" />
              <span className="truncate">{DOCK_TAB[id].label}</span>
            </span>
          ) : (
            <span key={id} className="grid h-full w-10 shrink-0 place-items-center text-fg-muted">
              <Icon name={DOCK_TAB[id].icon} size={17} />
            </span>
          ),
        )}
      </div>
      <span className="grid w-[54px] shrink-0 place-items-center rounded-full border border-border bg-bg">
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
  const { t } = useTranslation(['settings', 'common'])
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
      notify.info(dock.includes(id) ? t('dock.atLeastOne') : t('dock.full', { max: DOCK_MAX }))
      return
    }
    apply(next, t(next.includes(id) ? 'dock.added' : 'dock.removed', { name: dockLabel(id) }))
  }
  const move = (id: DockTab, delta: -1 | 1) =>
    apply(
      moveDockTab(dock, id, delta),
      t(delta < 0 ? 'dock.movedLeft' : 'dock.movedRight', { name: dockLabel(id) }),
    )

  return (
    <>
      <Preview tabs={visible.length ? visible : ['home']} />
      <PrefGroup
        title={t('dock.inBar')}
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
                  <span className="text-xs text-fg-faint">{t('dock.moduleOffHidden')}</span>
                ) : null}
              </span>
              <IconButton
                size="sm"
                aria-label={t('dock.moveLeft', { name: DOCK_TAB[id].label })}
                icon={<icons.chevronUp />}
                disabled={i === 0}
                onClick={() => move(id, -1)}
              />
              <IconButton
                size="sm"
                aria-label={t('dock.moveRight', { name: DOCK_TAB[id].label })}
                icon={<icons.chevronDown />}
                disabled={i === dock.length - 1}
                onClick={() => move(id, 1)}
              />
              <Switch
                checked
                disabled={dock.length <= 1}
                aria-label={t('dock.remove', { name: DOCK_TAB[id].label })}
                onCheckedChange={() => toggle(id)}
                className="ml-1.5"
              />
            </li>
          ))}
        </ul>
      </PrefGroup>
      <PrefGroup title={t('dock.outOfBar')} icon="more" description={t('dock.outOfBarText')}>
        <ul>
          {rest.map((id) => (
            <li key={id} className={cn(row, off(id) && 'text-fg-muted')}>
              <Icon name={DOCK_TAB[id].icon} size={19} className="text-fg-subtle" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base">{DOCK_TAB[id].label}</span>
                {off(id) ? (
                  <span className="text-xs text-fg-faint">{t('dock.moduleOff')}</span>
                ) : id === 'search' ? (
                  <span className="text-xs text-fg-faint">{t('dock.opensSearch')}</span>
                ) : null}
              </span>
              <Switch
                checked={false}
                aria-label={t('dock.add', { name: DOCK_TAB[id].label })}
                onCheckedChange={() => toggle(id)}
                className={cn(dock.length >= DOCK_MAX && 'opacity-50')}
              />
            </li>
          ))}
          <li className={cn(row, 'text-fg-muted')}>
            <Icon name="assistant" size={19} className="text-fg-faint" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base">{t('nav.assistant', { ns: 'common' })}</span>
              <span className="text-xs text-fg-faint">{t('dock.assistantNotOnPhone')}</span>
            </span>
            <Switch
              checked={false}
              disabled
              aria-label={t('dock.add', { name: t('nav.assistant', { ns: 'common' }) })}
              onCheckedChange={() => {}}
            />
          </li>
        </ul>
      </PrefGroup>
      <p className="px-0.5 text-xs text-fg-faint">
        {auth.kind === 'user' ? t('savedToAccountFooter') : t('dock.demoFooter')}
      </p>
    </>
  )
}
