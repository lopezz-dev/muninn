import { Avatar, cn, Icon } from '@muninn/ui'
import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { accountSheet, useAccountSheet } from '../lib/account-sheet'
import { useDockTabs } from '../lib/dock'
import { useAuth } from '../lib/muninn'
import { DOCK_TAB, SECTIONS, sectionOf, tabIndexOf } from './nav'
import { useShell } from './shell-context'

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
 * Barra de pestañas del teléfono (< 768 px), ADR-0054 y ADR-0072; el aspecto, de ADR-0087 (lienzo «Muninn — Inversiones»):
 * una cápsula en la que solo la pestaña activa enseña su nombre, y tu avatar en un círculo aparte. De una a cuatro pestañas
 * que eliges tú (Ajustes › Barra de abajo); el avatar abre la hoja «Tu cuenta» con todo lo demás.
 */
export function TabBar({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const shell = useShell()
  const auth = useAuth()
  const sheet = useAccountSheet()
  const { t } = useTranslation()
  // Con un módulo desactivado, su pestaña desaparece y las demás se reparten el ancho.
  const tabs = useDockTabs()
  const active = tabIndexOf(sectionOf(pathname), tabs)
  const gap = useStandaloneGap(pathname)
  const [compact, setCompact] = useCompactOnScroll(pathname)
  // Encogida, solo queda la pestaña activa; si la pantalla no tiene pestaña, no se encoge.
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
      <div className="relative mx-2.5 mb-[calc(14px+env(safe-area-inset-bottom))] flex h-16 items-stretch gap-1.5">
        <nav
          aria-label={t('shell.dockNav')}
          className={cn(
            'glass-raised pointer-events-auto flex min-w-0 items-center justify-evenly gap-0.5 overflow-hidden rounded-full border border-white/[0.09] bg-surface-raised p-1.5 shadow-popover',
            'transition-[flex-basis] duration-[400ms] ease-(--mn-motion-ease-out) motion-reduce:transition-none',
            shrunk ? 'flex-[0_0_64px]' : 'flex-[1_1_100%]',
          )}
        >
          {tabs.map((id, i) => {
            const s = DOCK_TAB[id]
            const isActive = i === active
            const hidden = shrunk && !isActive
            // Solo la activa enseña su nombre (ADR-0087); las demás, el icono, con el nombre en `aria-label`. En un
            // teléfono de 360 px con cuatro pestañas no sobra nada: los iconos ceden primero (de 44 a 40 px, con un
            // factor de encogido mucho mayor) y, solo si aun así no cabe, el nombre de la activa se corta.
            const tabClass = cn(
              'flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-full outline-offset-[-2px] transition-[flex-basis,opacity,background-color,color,padding] duration-300 motion-reduce:transition-none',
              hidden
                ? 'pointer-events-none min-w-0 flex-[0_0_0px] opacity-0'
                : isActive
                  ? 'min-w-12 flex-[0_1_auto]'
                  : 'min-w-10 flex-[0_1000_44px]',
              isActive ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:text-fg',
              isActive && (shrunk ? 'w-full px-0' : 'px-3'),
            )
            const content = (
              <>
                <Icon
                  name={s.icon}
                  size={22}
                  weight={isActive ? 'bold' : undefined}
                  className="shrink-0"
                />
                {isActive && !shrunk ? (
                  <span aria-hidden="true" className="truncate text-sm leading-none font-semibold">
                    {s.label}
                  </span>
                ) : null}
              </>
            )
            // «Buscar» no lleva a ninguna pantalla: abre el buscador encima de la que estés.
            if (id === 'search') {
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={t('shell.searchOrAsk')}
                  tabIndex={hidden ? -1 : undefined}
                  aria-hidden={hidden || undefined}
                  onClick={() => (shrunk ? setCompact(false) : shell.openPalette())}
                  className={tabClass}
                >
                  {content}
                </button>
              )
            }
            return (
              <Link
                key={id}
                to={SECTIONS[id].to}
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
                className={tabClass}
              >
                {content}
              </Link>
            )
          })}
        </nav>
        <span className="flex-1" />
        <button
          type="button"
          aria-label={t('shell.accountAndMore')}
          aria-haspopup="dialog"
          aria-expanded={sheet.open}
          onClick={() => (sheet.open ? accountSheet.close() : accountSheet.open())}
          className={cn(
            'glass-raised pointer-events-auto grid size-16 shrink-0 cursor-pointer place-items-center rounded-full border border-white/[0.09] bg-surface-raised shadow-popover outline-offset-2 transition-[scale,box-shadow] duration-150 active:scale-[0.96]',
            sheet.open && 'border-accent ring-2 ring-accent/25',
          )}
        >
          {auth.kind === 'user' ? (
            <Avatar
              name={auth.account.name}
              src={auth.account.avatarUrl}
              className="size-10 text-sm"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-full bg-border-strong text-fg-subtle"
            >
              <Icon name="user" size={20} />
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
