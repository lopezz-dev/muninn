import { cn, Icon } from '@muninn/ui'
import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEnabledModules } from '../lib/modules'
import {
  DOCK_DURATION,
  DOCK_EASE,
  dockPath,
  DOCK_GEOMETRY as G,
  slotCenter,
  slotWidth,
} from './dock-geometry'
import { dockFor, dockIndexOf, SECTIONS, sectionOf } from './nav'

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hueco máximo que se corrige: la barra de estado más alta de un iPhone (59 pt) con margen. */
const MAX_GAP = 80

/**
 * App instalada en iOS (`navigator.standalone`): a veces, al abrirla, el visor mide la pantalla menos la
 * barra de estado y `position: fixed; bottom: 0` queda ese tanto por encima del borde. Devuelve cuánto falta para bajar el
 * dock (0 si el visor mide lo mismo que la pantalla, que es lo normal). Ver docs/gotchas/web.md.
 */
function useStandaloneGap() {
  const [gap, setGap] = useState(0)
  useEffect(() => {
    if ((navigator as { standalone?: boolean }).standalone !== true) return
    const measure = () => {
      const portrait = window.innerHeight >= window.innerWidth
      const { width: w, height: h } = window.screen
      const full = portrait ? Math.max(w, h) : Math.min(w, h)
      const diff = Math.round(full - window.innerHeight)
      setGap(diff > 0 && diff <= MAX_GAP ? diff : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('pageshow', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('pageshow', measure)
    }
  }, [])
  return gap
}

/**
 * Dock con menisco para móvil (< 768 px). Diseño: Dock.dc.html.
 * La burbuja ámbar se desliza a la pestaña activa y la barra se hunde bajo ella. La posición se
 * anima en JS fotograma a fotograma (trazado, recorte, burbuja y halo a la vez) sin re-renderizar React.
 */
export function Dock({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const modules = useEnabledModules()
  // Con un módulo desactivado, su pestaña desaparece y las demás se reparten el ancho.
  const dock = useMemo(() => dockFor(modules), [modules])
  const count = dock.length
  const active = dockIndexOf(sectionOf(pathname), dock)
  const gap = useStandaloneGap()

  const boxRef = useRef<HTMLDivElement>(null)
  const strokeRef = useRef<SVGPathElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const beadRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  /** Centro actual de la burbuja (también a mitad de animación). */
  const cxRef = useRef<number | null>(null)
  const widthRef = useRef(0)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    // Oculto (escritorio): no hay nada que medir ni pintar.
    if (!width) return
    const paint = (cx: number) => {
      cxRef.current = cx
      const d = dockPath(width, cx)
      strokeRef.current?.setAttribute('d', d)
      if (fillRef.current) fillRef.current.style.clipPath = `path('${d}')`
      if (beadRef.current) beadRef.current.style.translate = `${cx - G.bead / 2}px 0`
      if (glowRef.current) glowRef.current.style.translate = `${cx - 90}px 0`
    }
    const target = slotCenter(width, active, count)
    const from = cxRef.current
    const resized = widthRef.current !== width
    widthRef.current = width
    if (from === null || resized || reducedMotion() || Math.abs(from - target) < 0.5) {
      paint(target)
      return
    }
    // Se pinta ya el punto de partida para que no se vea un fotograma en el destino.
    paint(from)
    let raf = 0
    let start: number | undefined
    const step = (t: number) => {
      start ??= t
      const p = Math.min(1, (t - start) / DOCK_DURATION)
      paint(from + (target - from) * DOCK_EASE(p))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    // Si el navegador no da fotogramas (PWA en segundo plano, ventana tapada), el dock no puede
    // quedarse a medio camino: al acabar la duración se fija el destino igualmente.
    const settle = setTimeout(() => {
      cancelAnimationFrame(raf)
      paint(target)
    }, DOCK_DURATION + 50)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [active, width, count])

  const slot = slotWidth(width || 350, count)
  const activeId = dock[active] ?? 'more'

  return (
    <div
      className={cn('pointer-events-none fixed inset-x-0 bottom-0 z-30', className)}
      style={gap ? { translate: `0 ${gap}px` } : undefined}
    >
      {/* Fundido para que el contenido no choque con el dock al hacer scroll. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[calc(150px+env(safe-area-inset-bottom))] bg-linear-to-b from-transparent to-bg to-60%"
      />
      <div
        ref={boxRef}
        className="relative mx-5 mb-[calc(22px+env(safe-area-inset-bottom))]"
        style={{ height: G.height }}
      >
        <div
          ref={glowRef}
          aria-hidden="true"
          className="mn-dock-glow absolute top-5 left-0 h-[90px] w-[180px]"
        />
        <div
          ref={fillRef}
          aria-hidden="true"
          className="glass-raised absolute inset-0 bg-linear-to-b from-surface-raised to-surface-sunken"
        />
        <svg
          aria-hidden="true"
          width={width}
          height={G.height}
          className="absolute inset-0 overflow-visible"
        >
          <path ref={strokeRef} fill="none" className="stroke-white/[0.09]" strokeWidth={1} />
        </svg>

        <nav aria-label="Navegación principal" className="pointer-events-auto absolute inset-0">
          {dock.map((id, i) => {
            const s = SECTIONS[id]
            const isActive = i === active
            return (
              <Link
                key={id}
                to={s.to}
                aria-label={s.label}
                aria-current={isActive ? 'page' : undefined}
                className="group absolute block text-fg-subtle outline-offset-[-4px] transition-colors hover:text-fg"
                style={{ left: G.pad + slot * i, top: G.top, width: slot, height: G.bar }}
              >
                <span
                  className={cn(
                    'absolute top-5 left-1/2 grid -translate-x-1/2 transition-[opacity,scale] duration-[250ms] ease-out',
                    isActive ? 'scale-75 opacity-0' : 'opacity-100',
                  )}
                >
                  <Icon name={s.icon} size={22} />
                </span>
                <span
                  className={cn(
                    'absolute inset-x-0 top-[22px] text-center text-2xs font-semibold text-accent transition-opacity duration-300',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {s.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div
          ref={beadRef}
          aria-hidden="true"
          className="mn-dock-bead absolute left-0 grid place-items-center rounded-full text-accent-fg"
          style={{ top: G.beadTop, width: G.bead, height: G.bead }}
        >
          <span key={activeId} className="grid animate-pop-in">
            <Icon name={SECTIONS[activeId].icon} size={22} weight="bold" />
          </span>
        </div>
      </div>
    </div>
  )
}
