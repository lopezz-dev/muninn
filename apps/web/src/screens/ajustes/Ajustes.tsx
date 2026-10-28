import { Link, Outlet } from '@tanstack/react-router'
import { SETTINGS_SECTIONS } from './sections'

/**
 * Ajustes: submenú de secciones y la sección elegida. Diseño: Ajustes.dc.html. En el móvil el submenú no se
 * ve: `/ajustes` es la lista de secciones (`Indice`) y cada sección trae su «‹ Ajustes».
 */
export function Ajustes() {
  return (
    <div className="flex w-full flex-1 flex-col gap-5 md:flex-row md:gap-8">
      <nav
        aria-label="Secciones de ajustes"
        className="hidden shrink-0 md:flex md:w-[210px] md:flex-col md:gap-0.5"
      >
        <p className="px-2.5 pb-3 text-xl font-semibold tracking-tight">Ajustes</p>
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.id}
            to="/ajustes/$seccion"
            params={{ seccion: s.id }}
            className="flex h-8 shrink-0 items-center rounded-md px-2.5 text-[13.5px] whitespace-nowrap text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-raised data-[status=active]:text-fg"
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
