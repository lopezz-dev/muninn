import { cn, Icon, icons, Kbd, Tooltip } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { lazy, type ReactNode, Suspense, useState } from 'react'
import { ProjectAvatar } from '../components/ProjectAvatar'
import { useEnabledModules } from '../lib/modules'
import { useMuninn } from '../lib/muninn'
import { overviewQuery, projectsQuery } from '../lib/queries'
import { useMediaQuery } from '../lib/use-media'
import { Logo } from './Logo'
import { SECTIONS, type SectionId, SIDEBAR_MAIN, sectionEnabled } from './nav'
import { PALETTE_SHORTCUT, useShell } from './shell-context'
import { UserButton } from './UserButton'

// El menú de tu cuenta llega en diferido (lleva el menú de Radix); mientras, el mismo botón sin menú.
const UserMenu = lazy(() => import('./UserMenu').then((m) => ({ default: m.UserMenu })))

/** Barra plegada a mano en el ordenador (`localStorage`, solo este dispositivo). */
const RAIL_KEY = 'muninn.sidebarRail'

function readRail() {
  try {
    return localStorage.getItem(RAIL_KEY) === '1'
  } catch {
    return false
  }
}

/** En el raíl (tablet, o plegada) cada zona mide 44 px; los nombres quedan para el lector de pantalla. */
const navItem = (rail: boolean) =>
  cn(
    'group flex items-center gap-2.5 rounded-md text-[13.5px] font-medium text-fg-muted transition-colors duration-150 hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-raised data-[status=active]:text-fg',
    rail ? 'h-11 justify-center' : 'h-8 justify-start px-2.5',
  )

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
      <Link to={s.to} activeOptions={{ exact: s.to === '/' }} className={navItem(rail)}>
        <Icon
          name={s.icon}
          size={rail ? 20 : undefined}
          className="text-fg-faint transition-colors group-data-[status=active]:text-accent"
        />
        <span className={rail ? 'sr-only' : undefined}>{s.label}</span>
        {count && !rail ? (
          <span className="ml-auto text-xs text-fg-faint tabular">{count}</span>
        ) : null}
      </Link>
    </RailTip>
  )
}

/**
 * Barra lateral: raíl de iconos en tablet (768–1023 px) y barra completa en el ordenador (≥ 1024 px), ADR-0054. En el
 * ordenador se pliega a raíl con el botón de arriba; al pie, tu usuario abre el menú de tu cuenta (ADR-0072).
 * Diseño: Sidebar.dc.html y lienzo «Dock y cuenta».
 */
export function Sidebar({ className }: { className?: string }) {
  const m = useMuninn()
  const shell = useShell()
  const modules = useEnabledModules()
  const projects = useQuery(projectsQuery(m)).data ?? []
  const overview = useQuery(overviewQuery(m)).data
  const openCount = new Map(overview?.projects.map((p) => [p.id, p.open]))
  const wide = useMediaQuery('(min-width: 1024px)')
  const [folded, setFolded] = useState(readRail)
  const rail = !wide || folded
  const toggleFold = () => {
    setFolded(!folded)
    try {
      localStorage.setItem(RAIL_KEY, folded ? '0' : '1')
    } catch {
      // Sin almacenamiento, dura hasta recargar.
    }
  }

  return (
    <aside
      aria-label="Barra lateral"
      className={cn(
        'glass-sidebar sticky top-0 h-dvh shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-subtle px-2.5 py-3.5',
        rail ? 'w-16' : 'w-60',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2.5 py-1',
          rail ? 'flex-col justify-center' : 'justify-start px-2',
        )}
      >
        <Logo />
        <span className={cn('text-md font-semibold tracking-tight', rail && 'sr-only')}>
          Muninn
        </span>
        {rail ? null : (
          <span className="ml-auto font-mono text-2xs text-fg-faint">v{__APP_VERSION__}</span>
        )}
        {wide ? (
          <Tooltip
            content={folded ? 'Desplegar barra' : 'Plegar barra'}
            side={rail ? 'right' : 'bottom'}
          >
            <button
              type="button"
              aria-label={folded ? 'Desplegar barra' : 'Plegar barra'}
              aria-pressed={folded}
              onClick={toggleFold}
              className="grid size-6 cursor-pointer place-items-center rounded-sm text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg"
            >
              <icons.sidebar size={15} />
            </button>
          </Tooltip>
        ) : null}
      </div>

      <RailTip label="Buscar o preguntar" rail={rail}>
        <button
          type="button"
          onClick={() => shell.openPalette()}
          aria-keyshortcuts={PALETTE_SHORTCUT.startsWith('⌘') ? 'Meta+K' : 'Control+K'}
          className={cn(
            'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-border-strong bg-surface text-sm text-fg-subtle transition-colors hover:text-fg',
            rail ? 'h-11 justify-center' : 'h-[34px] justify-start px-2.5',
          )}
        >
          <Icon name="search" size={rail ? 20 : undefined} />
          <span className={rail ? 'sr-only' : undefined}>Buscar o preguntar…</span>
          {rail ? null : <Kbd className="ml-auto">{PALETTE_SHORTCUT}</Kbd>}
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

      {sectionEnabled('projects', modules) && !rail ? (
        // En el raíl no caben los proyectos: se llega a ellos desde Proyectos.
        <section aria-labelledby="sidebar-projects" className="flex flex-col gap-0.5">
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

      <div className="border-t border-border-subtle pt-1.5">
        <Suspense fallback={<UserButton rail={rail} />}>
          <UserMenu rail={rail} />
        </Suspense>
      </div>
    </aside>
  )
}
