import { Avatar, cn, Icon, icons, Kbd, Tooltip } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ProjectAvatar } from '../components/ProjectAvatar'
import { useEnabledModules } from '../lib/modules'
import { useAuth, useMuninn } from '../lib/muninn'
import { overviewQuery, projectsQuery } from '../lib/queries'
import { useMediaQuery } from '../lib/use-media'
import { Logo } from './Logo'
import { SECTIONS, type SectionId, SIDEBAR_FOOTER, SIDEBAR_MAIN, sectionEnabled } from './nav'
import { PALETTE_SHORTCUT, useShell } from './shell-context'

// En tablet (768–1023 px) la barra es un raíl de iconos de 44 px; los nombres quedan para el lector de pantalla.
const navItem =
  'group flex h-11 items-center justify-center gap-2.5 rounded-md text-[13.5px] font-medium text-fg-muted transition-colors duration-150 hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-raised data-[status=active]:text-fg lg:h-8 lg:justify-start lg:px-2.5'

/** En el raíl, el nombre sale como tooltip; con la barra ancha ya se lee al lado y sobra. */
function RailTip({ label, rail, children }: { label: string; rail: boolean; children: ReactNode }) {
  return rail ? (
    <Tooltip content={label} side="right">
      {children}
    </Tooltip>
  ) : (
    children
  )
}

function NavItem({ id, count, rail }: { id: SectionId; count?: number; rail: boolean }) {
  const s = SECTIONS[id]
  return (
    <RailTip label={s.label} rail={rail}>
      <Link to={s.to} activeOptions={{ exact: s.to === '/' }} className={navItem}>
        <Icon
          name={s.icon}
          size={rail ? 20 : undefined}
          className="text-fg-faint transition-colors group-data-[status=active]:text-accent"
        />
        <span className="max-lg:sr-only">{s.label}</span>
        {count ? (
          <span className="ml-auto text-xs text-fg-faint tabular max-lg:hidden">{count}</span>
        ) : null}
      </Link>
    </RailTip>
  )
}

/**
 * Barra lateral: raíl de iconos en tablet (768–1023 px) y barra completa en el ordenador (≥ 1024 px), ADR-0054.
 * Diseño: Sidebar.dc.html.
 */
export function Sidebar({ className }: { className?: string }) {
  const m = useMuninn()
  const auth = useAuth()
  const shell = useShell()
  const modules = useEnabledModules()
  const projects = useQuery(projectsQuery(m)).data ?? []
  const overview = useQuery(overviewQuery(m)).data
  const openCount = new Map(overview?.projects.map((p) => [p.id, p.open]))
  const rail = !useMediaQuery('(min-width: 1024px)')

  return (
    <aside
      aria-label="Barra lateral"
      className={cn(
        'glass-sidebar sticky top-0 h-dvh w-16 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-subtle px-2.5 py-3.5 lg:w-60',
        className,
      )}
    >
      <div className="flex items-center justify-center gap-2.5 py-1 lg:justify-start lg:px-2">
        <Logo />
        <span className="text-md font-semibold tracking-tight max-lg:sr-only">Muninn</span>
        <span className="ml-auto font-mono text-2xs text-fg-faint max-lg:hidden">
          v{__APP_VERSION__}
        </span>
      </div>

      <RailTip label="Buscar o preguntar" rail={rail}>
        <button
          type="button"
          onClick={() => shell.openPalette()}
          aria-keyshortcuts={PALETTE_SHORTCUT.startsWith('⌘') ? 'Meta+K' : 'Control+K'}
          className="flex h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border-strong bg-surface text-sm text-fg-subtle transition-colors hover:text-fg lg:h-[34px] lg:justify-start lg:px-2.5"
        >
          <Icon name="search" size={rail ? 20 : undefined} />
          <span className="max-lg:sr-only">Buscar o preguntar…</span>
          <Kbd className="ml-auto max-lg:hidden">{PALETTE_SHORTCUT}</Kbd>
        </button>
      </RailTip>

      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {SIDEBAR_MAIN.filter((id) => sectionEnabled(id, modules)).map((id) => (
          <NavItem
            key={id}
            id={id}
            rail={rail}
            count={id === 'projects' ? projects.length : undefined}
          />
        ))}
      </nav>

      {sectionEnabled('projects', modules) ? (
        // En el raíl no caben los proyectos: se llega a ellos desde Proyectos.
        <section aria-labelledby="sidebar-projects" className="flex flex-col gap-0.5 max-lg:hidden">
          <div className="flex items-center pr-1 pb-1.5 pl-2.5">
            <h2
              id="sidebar-projects"
              className="text-[11.5px] font-medium tracking-wider text-fg-faint uppercase"
            >
              Proyectos
            </h2>
            <Tooltip content="Nuevo proyecto">
              <button
                type="button"
                aria-label="Nuevo proyecto"
                onClick={shell.openNewProject}
                className="ml-auto grid size-6 cursor-pointer place-items-center rounded-sm text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <icons.plus size={14} />
              </button>
            </Tooltip>
          </div>
          {projects.length === 0 ? (
            <p className="px-2.5 text-xs text-fg-faint">
              Aún no hay proyectos.{' '}
              <button
                type="button"
                onClick={shell.openNewProject}
                className="cursor-pointer text-accent hover:text-accent-hover"
              >
                Crea el primero
              </button>
            </p>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                to="/proyectos/$projectId"
                params={{ projectId: p.id }}
                className="flex h-[30px] items-center gap-2.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-raised data-[status=active]:text-fg"
              >
                <ProjectAvatar project={p} size="xs" />
                <span className="truncate">{p.name}</span>
                {openCount.get(p.id) ? (
                  <span className="ml-auto text-xs text-fg-faint tabular">
                    {openCount.get(p.id)}
                  </span>
                ) : null}
              </Link>
            ))
          )}
        </section>
      ) : null}

      <div className="flex-1" />

      <nav aria-label="Ayuda y ajustes" className="flex flex-col gap-0.5">
        {SIDEBAR_FOOTER.map((id) => (
          <NavItem key={id} id={id} rail={rail} />
        ))}
      </nav>

      <div className="border-t border-border-subtle pt-1.5">
        <Link
          to="/ajustes/$seccion"
          params={{ seccion: 'cuenta' }}
          aria-label={`Tu cuenta: ${auth.kind === 'user' ? auth.account.name : 'modo demo'}`}
          className="flex items-center justify-center gap-2.5 rounded-md py-1.5 transition-colors hover:bg-surface-hover lg:justify-start lg:px-2"
        >
          {auth.kind === 'user' ? (
            <Avatar name={auth.account.name} src={auth.account.avatarUrl} />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-md bg-border-strong text-fg-subtle"
            >
              <Icon name="user" />
            </span>
          )}
          <span className="flex min-w-0 flex-col leading-tight max-lg:sr-only">
            <span className="truncate text-sm font-medium">
              {auth.kind === 'user' ? auth.account.name : 'Modo demo'}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  auth.kind === 'user' ? 'bg-success' : 'bg-fg-faint',
                )}
              />
              {auth.kind === 'user' ? 'Guardado en tu cuenta' : 'Datos sin guardar'}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  )
}
