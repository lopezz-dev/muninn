import { Link, Outlet } from '@tanstack/react-router'
import { SETTINGS_SECTIONS } from './sections'

/** Ajustes: submenú de secciones y la sección elegida. Diseño: Ajustes.dc.html. */
export function Ajustes() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 md:flex-row md:gap-8">
      <nav
        aria-label="Secciones de ajustes"
        className="-mx-5 flex shrink-0 gap-1 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:w-[210px] md:flex-col md:gap-0.5 md:overflow-visible md:px-0"
      >
        <p className="hidden px-2.5 pb-3 text-xl font-semibold tracking-tight md:block">Ajustes</p>
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.id}
            to="/ajustes/$seccion"
            params={{ seccion: s.id }}
            className="flex h-11 shrink-0 items-center rounded-md px-3 text-[13.5px] whitespace-nowrap text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-raised data-[status=active]:text-fg md:h-8 md:px-2.5"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <Outlet />
      </div>
    </div>
  )
}
