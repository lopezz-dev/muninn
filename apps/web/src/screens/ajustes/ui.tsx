import { Button, cn, IconButton, icons } from '@muninn/ui'
import { Link, useRouterState } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { AppIcon, type AppIconName } from '../../components/AppIcon'
import type { SettingsSection } from './sections'

/** Punto ámbar de «cambiado»: el ajuste no está en su valor de fábrica. `decorative` si al lado ya se dice con texto. */
export function ChangedDot({
  className,
  decorative,
}: {
  className?: string
  decorative?: boolean
}) {
  return (
    <span
      title={decorative ? undefined : 'Cambiado'}
      aria-hidden={decorative || undefined}
      className={cn('inline-block size-1.5 shrink-0 rounded-full bg-accent', className)}
    >
      {decorative ? null : <span className="sr-only">Cambiado</span>}
    </span>
  )
}

/** Título de grupo en mayúsculas pequeñas, con su icono. */
export function MicroTitle({
  icon,
  children,
  className,
}: {
  icon?: AppIconName
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        'flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-fg-subtle uppercase',
        className,
      )}
    >
      {icon ? <AppIcon name={icon} size={13} /> : null}
      {children}
    </h2>
  )
}

/**
 * Cabecera de cada sección (ADR-0053): icono, título y para qué es. Si algo de la sección no está en su valor de
 * fábrica, cuántos y «Restablecer sección».
 */
export function SectionHeader({
  section,
  changed = 0,
  onReset,
}: {
  section: SettingsSection
  changed?: number
  onReset?: () => void
}) {
  useEffect(() => {
    document.title = `${section.label} · Ajustes · Muninn`
  }, [section.label])
  return (
    <header className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-border-subtle pb-5">
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-lg', section.tile)}>
        <AppIcon name={section.icon} size={22} />
      </span>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{section.label}</h1>
        <p className="text-base text-fg-subtle">{section.subtitle}</p>
      </div>
      {changed > 0 && onReset ? (
        <div className="flex items-center gap-2.5 pt-1.5">
          <span className="flex items-center gap-1.5 text-sm text-fg-muted">
            <ChangedDot decorative />
            {changed === 1 ? '1 cambiado' : `${changed} cambiados`}
          </span>
          <Button size="sm" onClick={onReset}>
            <AppIcon name="reset" size={13} />
            Restablecer sección
          </Button>
        </div>
      ) : null}
    </header>
  )
}

/** Un grupo de ajustes: subtítulo en mayúsculas pequeñas y una tarjeta de cristal con sus filas. */
export function PrefGroup({
  title,
  icon,
  description,
  action,
  padded,
  children,
}: {
  title?: string
  icon?: AppIconName
  description?: ReactNode
  /** A la derecha del título: un recuento o un botón para todo el grupo. */
  action?: ReactNode
  /** Contenido libre (un formulario) con margen, en vez de filas de borde a borde. */
  padded?: boolean
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      {title || action ? (
        <div className="flex min-h-6 items-center justify-between gap-2 px-0.5">
          {title ? <MicroTitle icon={icon}>{title}</MicroTitle> : <span />}
          {action}
        </div>
      ) : null}
      {description ? <p className="-mt-1 px-0.5 text-sm text-fg-subtle">{description}</p> : null}
      <div
        className={cn(
          'glass overflow-hidden rounded-lg border border-border',
          padded && 'flex flex-col gap-3 p-4',
        )}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * Si la dirección pide un ajuste (`#ajuste-<id>`, desde el buscador), lo centra y lo resalta un momento. Vale para
 * cualquier elemento con ese id (una fila, un campo, una lista), no solo para `PrefRow`.
 */
export function useFlashHash() {
  const hash = useRouterState({ select: (s) => s.location.hash.replace(/^#/, '') })
  useEffect(() => {
    if (!hash.startsWith('ajuste-')) return
    let el: HTMLElement | null = null
    let t: ReturnType<typeof setTimeout> | undefined
    // Un fotograma después: al venir de los resultados, la sección se monta en este mismo render.
    const frame = requestAnimationFrame(() => {
      el = document.getElementById(hash)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.style.transition = 'box-shadow 300ms'
      el.style.boxShadow = 'inset 0 0 0 2px var(--mn-color-accent)'
      t = setTimeout(() => {
        if (el) el.style.boxShadow = ''
      }, 1600)
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(t)
      if (el) el.style.boxShadow = ''
    }
  }, [hash])
}

/**
 * Una fila de ajuste: icono, nombre y descripción a la izquierda y el control a la derecha. Con `changed`, el punto
 * de «cambiado» y un botón para volver al valor de fábrica.
 */
export function PrefRow({
  id,
  icon,
  title,
  description,
  htmlFor,
  changed,
  onReset,
  resetLabel,
  tile,
  children,
}: {
  /** Destino del buscador: la fila lleva `id="ajuste-<id>"`. */
  id?: string
  icon?: AppIconName
  title: ReactNode
  description?: ReactNode
  htmlFor?: string
  changed?: boolean
  onReset?: () => void
  resetLabel?: string
  /** Color del recuadro del icono (por defecto, neutro). */
  tile?: string
  children?: ReactNode
}) {
  const Title = htmlFor ? 'label' : 'span'
  return (
    <div
      id={id ? `ajuste-${id}` : undefined}
      className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-t border-border-subtle px-4 py-3.5 first:border-t-0 md:px-[18px]"
    >
      {icon ? (
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-md',
            tile ?? 'bg-surface-raised text-fg-muted',
          )}
        >
          <AppIcon name={icon} size={16} />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <Title htmlFor={htmlFor} className="flex items-center gap-2 text-base font-medium">
          {changed ? <ChangedDot /> : null}
          {title}
        </Title>
        {description ? (
          <span className="text-[12.5px] leading-snug text-fg-subtle">{description}</span>
        ) : null}
      </div>
      {children || (changed && onReset) ? (
        <div className="flex items-center gap-1.5">
          {children}
          {changed && onReset ? (
            <IconButton
              aria-label={resetLabel ?? 'Volver al valor de fábrica'}
              title={resetLabel ?? 'Volver al valor de fábrica'}
              size="sm"
              icon={<AppIcon name="reset" size={14} />}
              onClick={onReset}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Columna «En la documentación» (pantallas muy anchas): la guía de la sección. */
export function HelpAside({ section }: { section: SettingsSection }) {
  const doc = section.doc
  if (!doc) return null
  return (
    <aside
      aria-label="En la documentación"
      className="sticky top-7 ml-auto hidden w-[280px] shrink-0 flex-col gap-3 self-start 2xl:flex"
    >
      <MicroTitle icon="docs">En la documentación</MicroTitle>
      <Link
        to="/documentacion/$pagina"
        params={{ pagina: doc.pagina }}
        hash={doc.hash}
        className="glass flex gap-3 rounded-lg border border-border p-4 text-fg transition-colors hover:border-border-strong hover:bg-surface-hover"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <icons.docs size={16} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="text-base font-medium">{doc.title}</span>
          <span className="text-sm leading-snug text-fg-subtle">{doc.text}</span>
          <span className="flex items-center gap-1 text-sm text-accent">
            Abrir la guía
            <icons.move size={13} aria-hidden="true" />
          </span>
        </span>
      </Link>
      <p className="flex flex-col gap-1 rounded-lg bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-fg-subtle">
        <span className="flex items-center gap-1.5 font-medium text-fg-muted">
          <ChangedDot decorative />
          Marca de cambiado
        </span>
        Los ajustes que no están en su valor de fábrica llevan un punto. El botón de la flecha
        devuelve uno; «Restablecer sección», todos, con Deshacer.
      </p>
    </aside>
  )
}
