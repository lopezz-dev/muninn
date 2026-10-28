import { cn } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { Link, Outlet } from '@tanstack/react-router'
import { AppIcon } from '../../components/AppIcon'
import { MODULE_ORDER, useEnabledModules } from '../../lib/modules'
import { reportPrefs } from '../../lib/morning-report-prefs'
import { useAuth, useMuninn } from '../../lib/muninn'
import { settingsQuery } from '../../lib/queries'
import { bySection, useChangedPrefs } from '../../lib/settings-changes'
import { SettingsResults, SettingsSearchField, useSettingsSearch } from './search'
import { ABOUT_SECTION, type SettingsSection, sectionsByGroup } from './sections'
import { ChangedDot, MicroTitle } from './ui'

/** Módulos que se pueden activar hoy (Concentración aún no). */
const ACTIVABLE = MODULE_ORDER.filter((m) => m !== 'focus')

/**
 * Lo que cada sección enseña al lado de su nombre, para no tener que abrirla: con qué entras, cuántos módulos tienes
 * activos, a qué hora va el informe… Solo datos que ya están en la caché: nada de peticiones por pintar el menú.
 */
export function useSectionHints(): Partial<Record<string, string>> {
  const m = useMuninn()
  const auth = useAuth()
  const modules = useEnabledModules()
  const report = reportPrefs(useQuery(settingsQuery(m)).data)
  const on = modules ? ACTIVABLE.filter((x) => modules.has(x)).length : null
  return {
    cuenta:
      auth.kind === 'demo'
        ? 'Modo demo'
        : auth.account.provider === 'github'
          ? 'GitHub'
          : 'Código por correo',
    modulos: on === null ? undefined : `${on} de ${ACTIVABLE.length}`,
    notificaciones: 'Próximamente',
    informe: report.enabled ? report.time : 'Apagado',
    acerca: `v${__APP_VERSION__}`,
  }
}

function RailLink({
  section,
  hint,
  changed,
  muted,
}: {
  section: SettingsSection
  hint?: string
  changed?: boolean
  muted?: boolean
}) {
  return (
    <Link
      to="/ajustes/$seccion"
      params={{ seccion: section.id }}
      className={cn(
        'group flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] whitespace-nowrap text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        'data-[status=active]:bg-fg/[0.07] data-[status=active]:text-fg',
        muted && 'text-fg-faint',
      )}
    >
      <AppIcon
        name={section.icon}
        size={16}
        className="shrink-0 text-fg-subtle group-data-[status=active]:text-accent"
      />
      <span className="min-w-0 truncate">{section.label}</span>
      <span className="ml-auto flex items-center gap-2">
        {hint ? <span className="text-xs text-fg-faint">{hint}</span> : null}
        {changed ? <ChangedDot /> : null}
      </span>
    </Link>
  )
}

/**
 * Ajustes (ADR-0053): menú por grupos con buscador a la izquierda y la sección elegida. Mientras haya texto en el
 * buscador, los resultados ocupan el sitio de la sección. En el móvil el menú no se ve: `/ajustes` es la lista de
 * secciones (`Indice`) y cada sección trae su «‹ Ajustes».
 */
export function Ajustes() {
  const search = useSettingsSearch()
  const changed = bySection(useChangedPrefs())
  const hints = useSectionHints()

  return (
    <div className="flex w-full flex-1 flex-col gap-5 md:flex-row md:gap-10 xl:gap-12">
      <nav
        aria-label="Secciones de ajustes"
        className="hidden shrink-0 md:sticky md:top-7 md:flex md:max-h-[calc(100dvh-3.5rem)] md:w-[248px] md:flex-col md:gap-3 md:self-start md:overflow-y-auto"
      >
        <p className="flex items-center gap-2 px-1 text-xl font-semibold tracking-tight">
          <AppIcon name="settings" size={18} className="text-accent" />
          Ajustes
        </p>
        <SettingsSearchField search={search} />
        {sectionsByGroup().map((g) => (
          <div key={g.id} className="flex flex-col gap-0.5">
            <MicroTitle className="px-2.5 pt-2 pb-1">{g.label}</MicroTitle>
            {g.sections.map((s) => (
              <RailLink
                key={s.id}
                section={s}
                hint={hints[s.id]}
                changed={Boolean(changed[s.id]?.length)}
                muted={Boolean(s.soon)}
              />
            ))}
          </div>
        ))}
        <div className="mt-2 border-t border-border-subtle pt-2">
          <RailLink section={ABOUT_SECTION} hint={hints.acerca} muted />
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {search.searching ? (
          <div className="max-w-[820px]">
            <SettingsResults search={search} />
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  )
}
