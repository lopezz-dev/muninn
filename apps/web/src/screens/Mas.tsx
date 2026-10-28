import { Avatar, Card, Icon, type IconName, icons } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Page, PageHeader } from '../components/Page'
import { useEnabledModules } from '../lib/modules'
import { useAuth } from '../lib/muninn'
import { SECTIONS, type SectionId, sectionEnabled } from '../shell/nav'
import { useShell } from '../shell/shell-context'

const MODULES: { id: SectionId; text: string; tile: string }[] = [
  { id: 'notes', text: 'Markdown y proyectos', tile: 'bg-project-teal/15 text-project-teal' },
  { id: 'news', text: 'Resumen diario', tile: 'bg-project-pink/15 text-project-pink' },
  { id: 'github', text: 'Issues y agentes', tile: 'bg-project-violet/15 text-project-violet' },
  { id: 'docs', text: 'Guías de uso', tile: 'bg-project-blue/15 text-project-blue' },
]

const row =
  'flex min-h-14 w-full cursor-pointer items-center gap-3.5 border-t border-border-subtle px-4 text-md text-fg first:border-t-0 hover:bg-surface-hover'

function RowContent({
  icon,
  children,
  value,
}: {
  icon: IconName
  children: ReactNode
  value?: string
}) {
  return (
    <>
      <Icon name={icon} size={20} className="text-fg-subtle" />
      {children}
      {value ? <span className="ml-auto text-sm text-fg-subtle">{value}</span> : null}
      <icons.chevronRight
        aria-hidden="true"
        className={value ? 'text-fg-faint' : 'ml-auto text-fg-faint'}
      />
    </>
  )
}

/** Hub de móvil para lo que no tiene pestaña propia. Diseño: M-Mas.dc.html. */
export function Mas() {
  const shell = useShell()
  const auth = useAuth()
  const modules = useEnabledModules()
  return (
    <Page className="gap-6">
      <PageHeader title="Más" />

      <section aria-labelledby="mas-modulos" className="flex flex-col gap-2.5">
        <h2
          id="mas-modulos"
          className="px-0.5 text-xs font-semibold tracking-wider text-fg-faint uppercase"
        >
          Módulos
        </h2>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {MODULES.filter((mod) => sectionEnabled(mod.id, modules)).map((mod) => {
            const s = SECTIONS[mod.id]
            return (
              <Card key={mod.id} className="transition-colors hover:border-border-strong">
                <Link to={s.to} className="flex min-h-[116px] flex-col gap-3 rounded-lg p-4">
                  <span className={`grid size-9 place-items-center rounded-lg ${mod.tile}`}>
                    <Icon name={s.icon} size={20} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-md font-semibold">{s.label}</span>
                    <span className="text-[12.5px] text-fg-subtle">{mod.text}</span>
                  </span>
                </Link>
              </Card>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="mas-app" className="flex flex-col gap-2.5">
        <h2
          id="mas-app"
          className="px-0.5 text-xs font-semibold tracking-wider text-fg-faint uppercase"
        >
          App
        </h2>
        <Card className="overflow-hidden">
          <Link to="/ajustes/$seccion" params={{ seccion: 'cuenta' }} className={row}>
            {auth.kind === 'user' ? (
              <>
                <Avatar name={auth.account.name} src={auth.account.avatarUrl} size="sm" />
                <span className="min-w-0 truncate">{auth.account.name}</span>
                <icons.chevronRight aria-hidden="true" className="ml-auto text-fg-faint" />
              </>
            ) : (
              <RowContent icon="user" value="Modo demo">
                Cuenta
              </RowContent>
            )}
          </Link>
          <button type="button" className={row} onClick={() => shell.openPalette()}>
            <RowContent icon="search">Buscar o preguntar</RowContent>
          </button>
          <Link to="/ajustes/$seccion" params={{ seccion: 'apariencia' }} className={row}>
            <RowContent icon="palette">Apariencia</RowContent>
          </Link>
          <Link to="/ajustes/$seccion" params={{ seccion: 'datos' }} className={row}>
            <RowContent icon="sync" value={auth.kind === 'user' ? 'En tu cuenta' : 'Modo demo'}>
              Datos
            </RowContent>
          </Link>
          <Link to="/ajustes" className={row}>
            <RowContent icon="settings">Todos los ajustes</RowContent>
          </Link>
        </Card>
      </section>

      <p className="text-center text-[12.5px] text-fg-faint">Muninn {__APP_VERSION__}</p>
    </Page>
  )
}
