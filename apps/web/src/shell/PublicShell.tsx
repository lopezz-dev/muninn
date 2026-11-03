import { Button, icons } from '@muninn/ui'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Logo } from './Logo'

/**
 * Marco de la documentación para quien llega sin sesión (ADR-0076): cabecera con la marca y «Entrar», y la guía
 * debajo. Sin barra lateral ni datos: no carga el core. Al entrar, el router vuelve a esta misma guía, ya en el shell.
 */
export function PublicShell() {
  const href = useRouterState({ select: (s) => s.location.href })
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg md:h-dvh">
      <header className="glass flex shrink-0 items-center gap-3 border-b border-border-subtle px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 md:px-7 md:py-3 lg:px-8">
        <Link to="/documentacion" className="flex items-center gap-2.5 text-fg">
          <Logo />
          <span className="text-md font-semibold tracking-tight">Muninn</span>
          <span className="hidden text-md text-fg-subtle sm:inline">· Documentación</span>
        </Link>
        <Button asChild variant="primary" className="ml-auto">
          <Link to="/login" search={{ redirect: href }}>
            <icons.user size={16} aria-hidden="true" />
            Entrar
          </Link>
        </Button>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        data-scroll-restoration-id="contenido"
        className="flex min-w-0 flex-1 flex-col px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+40px)] outline-none max-md:overflow-x-clip md:min-h-0 md:overflow-y-auto md:px-7 md:pt-7 md:pb-8 lg:px-8"
      >
        <Outlet />
      </main>
    </div>
  )
}
