import { Card, Chip, cn, Icon, type IconName } from '@muninn/ui'
import { type ReactNode, useEffect } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Botones a la derecha (en móvil bajan debajo del título). */
  actions?: ReactNode
  /** Algo delante del título (color del proyecto…). */
  leading?: ReactNode
}

/** Fija el título del documento («Notas · Muninn»). Para pantallas con cabecera propia. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Muninn`
  }, [title])
}

/** Cabecera de pantalla. También fija el título del documento («Notas · Muninn»). */
export function PageHeader({ title, description, actions, leading }: PageHeaderProps) {
  useDocumentTitle(title)
  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          {leading}
          <span className="truncate">{title}</span>
        </h1>
        {description ? <p className="text-base text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 md:ml-auto">{actions}</div> : null}
    </header>
  )
}

/**
 * Contenedor de pantalla: ocupa todo el ancho y, en escritorio, todo el alto que deja `<main>`
 * (es `flex-1` dentro de su columna). Lo que deba llenar el alto sobrante usa `md:flex-1`.
 *
 * `fit` (ADR-0050): en escritorio la pantalla mide exactamente el alto de la ventana y no crece; lo que no
 * quepa hace scroll dentro de su lista (`md:min-h-0` + `md:overflow-y-auto` en el bloque que crece). Sin
 * `fit`, si el contenido no cabe, hace scroll la pantalla entera.
 */
export function Page({
  className,
  fit,
  children,
}: {
  className?: string
  fit?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('flex w-full flex-1 flex-col gap-5', fit && 'md:min-h-0', className)}>
      {children}
    </div>
  )
}

interface EmptyStateProps {
  icon: IconName
  title: string
  children: ReactNode
  /** Fase del roadmap en la que llega («Fase 3»), si aún no está disponible. */
  soon?: string
  actions?: ReactNode
  /** Vista previa en gris de lo que aparecerá aquí (decorativa). */
  preview?: ReactNode
  className?: string
}

/**
 * Estado vacío: qué es esta pantalla, qué hacer ahora o cuándo llega. Honesto con lo que hay.
 */
export function EmptyState({
  icon,
  title,
  children,
  soon,
  actions,
  preview,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('flex flex-col items-center overflow-hidden text-center', className)}>
      {preview ? (
        <div
          aria-hidden="true"
          className="w-full border-b border-border-subtle bg-surface-sunken px-6 pt-6 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
        >
          {preview}
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-4 px-6 py-10">
        <span className="grid size-12 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon name={icon} size={24} />
        </span>
        <div className="flex max-w-md flex-col items-center gap-1.5">
          <h2 className="flex flex-wrap items-center justify-center gap-2 text-lg font-semibold">
            {title}
            {soon ? <Chip variant="accent">{soon}</Chip> : null}
          </h2>
          <p className="text-sm text-fg-muted text-pretty">{children}</p>
        </div>
        {actions ? <div className="flex flex-wrap justify-center gap-2">{actions}</div> : null}
      </div>
    </Card>
  )
}

/** Bloque gris para las vistas previas de los estados vacíos. */
export function Ghost({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-border', className)} />
}
