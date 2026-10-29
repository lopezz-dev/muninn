import { cn, Icon } from '@muninn/ui'
import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useEnabledModules } from '../lib/modules'
import { Logo } from './Logo'
import { SECTIONS, sectionOf, tabIndexOf, tabsFor } from './nav'

/** Hueco máximo que se corrige: la barra de estado más alta de un iPhone (59 pt) con margen. */
const MAX_GAP = 80

/**
 * App instalada en iOS (`navigator.standalone`): a veces, al abrirla, el visor mide la pantalla menos la
 * barra de estado y `position: fixed; bottom: 0` queda ese tanto por encima del borde. Devuelve cuánto falta para bajar la
 * barra (0 si el visor mide lo mismo que la pantalla, que es lo normal). iOS corrige luego el visor sin avisar siempre con
 * `resize`: por eso se vuelve a medir al cambiar de pantalla, al volver a la app y un poco después de cada medida; una
 * corrección que se quedara puesta empujaría la barra fuera de la pantalla. Ver docs/gotchas/web.md.
 */
function useStandaloneGap(resetKey: string) {
  const [gap, setGap] = useState(0)
  useEffect(() => {
    void resetKey
    if ((navigator as { standalone?: boolean }).standalone !== true) return
    const measure = () => {
      const portrait = window.innerHeight >= window.innerWidth
      const { width: w, height: h } = window.screen
      const full = portrait ? Math.max(w, h) : Math.min(w, h)
      const visible = Math.max(window.innerHeight, window.visualViewport?.height ?? 0)
      const diff = Math.round(full - visible)
      setGap(diff > 0 && diff <= MAX_GAP ? diff : 0)
    }
    const timers = [0, 250, 1000].map((ms) => setTimeout(measure, ms))
    const onVisible = () => {
      if (document.visibilityState === 'visible') measure()
    }
    window.addEventListener('resize', measure)
    window.addEventListener('pageshow', measure)
    window.visualViewport?.addEventListener('resize', measure)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      for (const t of timers) clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('pageshow', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [resetKey])
  return gap
}

/**
 * La barra se encoge al bajar por la página (deja solo la pestaña activa) y vuelve al subir o cerca del principio.
 * En el teléfono hace scroll la ventana (ADR-0050), así que se escucha `window`.
 */
function useCompactOnScroll(resetKey: string) {
  const [compact, setCompact] = useState(false)
  // Al cambiar de pantalla, la barra vuelve entera.
  useEffect(() => {
    void resetKey
    setCompact(false)
  }, [resetKey])
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last
      if (y < 80) setCompact(false)
      else if (delta > 8) setCompact(true)
      else if (delta < -8) setCompact(false)
      // Los saltos pequeños no cuentan: así no tiembla con la inercia del dedo.
      if (Math.abs(delta) > 8 || y < 80) last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return [compact, setCompact] as const
}

/**
 * Barra de pestañas del teléfono (< 768 px), ADR-0054. Diseño: lienzo «Muninn — Móvil 2.0» (TabBar.dc.html).
 * Cuatro pestañas con su nombre y, aparte, el botón del Asistente con el logo de Muninn.
 */
export function TabBar({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const modules = useEnabledModules()
  // Con un módulo desactivado, su pestaña desaparece y las demás se reparten el ancho.
  const tabs = useMemo(() => tabsFor(modules), [modules])
  const section = sectionOf(pathname)
  const active = tabIndexOf(section, tabs)
  const onAssistant = section === 'assistant'
  const gap = useStandaloneGap(pathname)
  const [compact, setCompact] = useCompactOnScroll(pathname)
  // Encogida, solo queda la pestaña activa; en el Asistente no hay ninguna activa, así que no se encoge.
  const shrunk = compact && active >= 0

  return (
    <div
      className={cn('pointer-events-none fixed inset-x-0 bottom-0 z-30', className)}
      style={gap ? { translate: `0 ${gap}px` } : undefined}
    >
      {/* Fundido para que el contenido no choque con la barra al hacer scroll. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[calc(110px+env(safe-area-inset-bottom))] bg-linear-to-b from-transparent to-bg to-70%"
      />
      <div className="relative mx-4 mb-[calc(14px+env(safe-area-inset-bottom))] flex h-[62px] items-stretch gap-2">
        <nav
          aria-label="Navegación principal"
          className={cn(
            'glass-raised pointer-events-auto flex min-w-0 items-center gap-0.5 overflow-hidden rounded-dock border border-white/[0.09] bg-surface-raised p-[5px] shadow-popover',
            'transition-[flex-basis] duration-[400ms] ease-(--mn-motion-ease-out) motion-reduce:transition-none',
            shrunk ? 'flex-[0_0_62px]' : 'flex-[1_1_100%]',
          )}
        >
          {tabs.map((id, i) => {
            const s = SECTIONS[id]
            const isActive = i === active
            const hidden = shrunk && !isActive
            return (
              <Link
                key={id}
                to={s.to}
                aria-label={s.label}
                aria-current={isActive ? 'page' : undefined}
                tabIndex={hidden ? -1 : undefined}
                aria-hidden={hidden || undefined}
                onClick={(e) => {
                  // Encogida, el primer toque solo la despliega.
                  if (shrunk) {
                    e.preventDefault()
                    setCompact(false)
                  }
                }}
                className={cn(
                  'flex h-full min-w-0 flex-col items-center justify-center gap-[3px] rounded-lg outline-offset-[-2px] transition-[flex-basis,opacity,background-color,color] duration-300 motion-reduce:transition-none',
                  hidden ? 'pointer-events-none flex-[0_0_0px] opacity-0' : 'flex-[1_1_0px]',
                  isActive ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:text-fg',
                )}
              >
                <Icon name={s.icon} size={22} weight={isActive ? 'bold' : undefined} />
                <span
                  className={cn(
                    'text-2xs leading-none whitespace-nowrap',
                    isActive ? 'font-semibold' : 'font-medium',
                    shrunk && 'hidden',
                  )}
                >
                  {s.label}
                </span>
              </Link>
            )
          })}
        </nav>
        <span className="flex-1" />
        <Link
          to="/asistente"
          aria-label="Asistente: preguntar a Muninn"
          aria-current={onAssistant ? 'page' : undefined}
          className={cn(
            'pointer-events-auto grid size-[62px] shrink-0 place-items-center rounded-dock bg-accent text-accent-fg shadow-popover outline-offset-2 transition-[scale,box-shadow] duration-150 active:scale-[0.96]',
            onAssistant && 'ring-2 ring-accent/40 ring-offset-2 ring-offset-bg',
          )}
        >
          <Logo variant="mark" size={34} />
        </Link>
      </div>
    </div>
  )
}
