import { ColorDot, cn, Icon, icons, Kbd, Tooltip } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMuninn } from '../lib/muninn'
import { overviewQuery, projectsQuery } from '../lib/queries'
import { Logo } from './Logo'
import { SECTIONS, type SectionId, SIDEBAR_FOOTER, SIDEBAR_MAIN } from './nav'
import { PALETTE_SHORTCUT, useShell } from './shell-context'

const navItem =
  'group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium text-fg-muted transition-colors duration-150 hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-raised data-[status=active]:text-fg'

function NavItem({ id, count }: { id: SectionId; count?: number }) {
  const s = SECTIONS[id]
  return (
    <Link to={s.to} activeOptions={{ exact: s.to === '/' }} className={navItem}>
      <Icon
        name={s.icon}
        className="text-fg-faint transition-colors group-data-[status=active]:text-accent"
      />
      {s.label}
      {count ? <span className="ml-auto text-xs text-fg-faint tabular">{count}</span> : null}
    </Link>
  )
}

/** Barra lateral de escritorio (≥ 768 px). Diseño: Sidebar.dc.html. */
export function Sidebar({ className }: { className?: string }) {
  const m = useMuninn()
  const shell = useShell()
  const projects = useQuery(projectsQuery(m)).data ?? []
  const overview = useQuery(overviewQuery(m)).data
  const openCount = new Map(overview?.projects.map((p) => [p.id, p.open]))

  return (
    <aside
      aria-label="Barra lateral"
      className={cn(
        'glass-sidebar sticky top-0 h-dvh w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-subtle px-2.5 py-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-2 py-1">
        <Logo />
        <span className="text-md font-semibold tracking-tight">Muninn</span>
        <span className="ml-auto font-mono text-2xs text-fg-faint">v{__APP_VERSION__}</span>
      </div>

      <button
        type="button"
        onClick={() => shell.openPalette()}
        aria-keyshortcuts={PALETTE_SHORTCUT.startsWith('⌘') ? 'Meta+K' : 'Control+K'}
        className="flex h-[34px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-border-strong bg-surface px-2.5 text-sm text-fg-subtle transition-colors hover:text-fg"
      >
        <Icon name="search" />
        Buscar o preguntar…
        <Kbd className="ml-auto">{PALETTE_SHORTCUT}</Kbd>
      </button>

      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {SIDEBAR_MAIN.map((id) => (
          <NavItem key={id} id={id} count={id === 'projects' ? projects.length : undefined} />
        ))}
      </nav>

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
              <ColorDot color={p.color} />
              <span className="truncate">{p.name}</span>
              {openCount.get(p.id) ? (
                <span className="ml-auto text-xs text-fg-faint tabular">{openCount.get(p.id)}</span>
              ) : null}
            </Link>
          ))
        )}
      </section>

      <div className="flex-1" />

      <nav aria-label="Ayuda y ajustes" className="flex flex-col gap-0.5">
        {SIDEBAR_FOOTER.map((id) => (
          <NavItem key={id} id={id} />
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-border-subtle px-2 pt-2.5">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-md bg-border-strong text-fg-subtle"
        >
          <Icon name="user" />
        </span>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-medium">Modo demo</span>
          <span className="flex items-center gap-1.5 text-xs text-fg-faint">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-fg-faint" />
            Datos sin guardar
          </span>
        </div>
      </div>
    </aside>
  )
}
