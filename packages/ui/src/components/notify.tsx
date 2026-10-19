import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster, toast } from 'sonner'
import { cn } from '../cn'
import { type IconName, icons } from '../icons'

/**
 * Notificaciones efímeras: una píldora arriba en el centro (la «isla» del diseño).
 * La app usa SIEMPRE `notify` y `<Toaster />` de aquí, nunca 'sonner' directamente.
 */

export type NotifyTone = 'success' | 'error' | 'info' | 'loading'

export interface NotifyAction {
  label: string
  onClick: () => void
}

export interface NotifyOptions {
  /** Texto secundario, en gris tras el título. */
  description?: string
  /**
   * Icono de la acción realizada (`'link'`, `'archive'`, `'move'`…). En éxito, el icono hace su gesto
   * y se transforma en el check: resalta qué acaba de pasar. En info sustituye al icono «i».
   */
  icon?: IconName
  /** Acción en la píldora; típicamente «Deshacer». */
  action?: NotifyAction
  /** ms; por defecto 4 s, 6 s si hay acción o es un error. */
  duration?: number
  /** Reutiliza un id para reemplazar una notificación existente. */
  id?: string | number
}

export interface NotificationPillProps extends Omit<NotifyOptions, 'duration' | 'id'> {
  tone: NotifyTone
  title: string
  onDismiss?: () => void
  /** Viene de una notificación de carga: no repite la entrada de la insignia, solo dibuja el check. */
  continued?: boolean
}

/** Gesto de cada icono de acción antes de convertirse en check. */
type Motion = 'lift' | 'slide' | 'drop' | 'spin' | 'turn' | 'shake' | 'pulse'

const MOTION: Partial<Record<IconName, Motion>> = {
  link: 'lift',
  pin: 'lift',
  external: 'slide',
  move: 'slide',
  send: 'slide',
  archive: 'drop',
  download: 'drop',
  sync: 'spin',
  recurring: 'spin',
  plus: 'turn',
  trash: 'shake',
}

const TONE_CLS: Record<NotifyTone, string> = {
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
  info: 'bg-accent-soft text-accent',
  loading: '',
}

/** Insignia animada: la coreografía vive en theme.css (`.mn-badge`). */
function Badge({
  tone,
  icon,
  continued,
}: {
  tone: NotifyTone
  icon?: IconName
  continued?: boolean
}) {
  if (tone === 'loading') {
    return (
      <span aria-hidden="true" className="mn-badge" data-tone="loading">
        <span className="mn-spinner" />
      </span>
    )
  }
  const ActionIcon = icon && tone === 'success' && !continued ? icons[icon] : undefined
  const StaticIcon =
    tone === 'error' ? icons.warning : tone === 'info' ? icons[icon ?? 'info'] : undefined
  return (
    <span
      aria-hidden="true"
      className={cn('mn-badge', TONE_CLS[tone])}
      data-tone={tone}
      data-action={ActionIcon ? '' : undefined}
      data-motion={ActionIcon && icon ? (MOTION[icon] ?? 'pulse') : undefined}
      data-continued={continued ? '' : undefined}
    >
      {ActionIcon ? (
        <span className="mn-badge-action">
          <ActionIcon size={13} weight="bold" />
        </span>
      ) : null}
      {tone === 'success' ? (
        <svg className="mn-badge-check" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5 9.5 17 19 7.5" pathLength={1} />
        </svg>
      ) : null}
      {StaticIcon ? <StaticIcon size={13} weight="bold" /> : null}
    </span>
  )
}

/** La píldora en sí (exportada para el diseño y los tests). */
export function NotificationPill({
  tone,
  title,
  description,
  icon,
  action,
  onDismiss,
  continued,
}: NotificationPillProps) {
  const Close = icons.close
  return (
    <div
      className={cn(
        'glass-raised pointer-events-auto flex h-10 max-w-[calc(100vw-32px)] items-center gap-2.5 rounded-full border border-border-strong pl-2 shadow-popover',
        action || tone === 'error' ? 'pr-1.5' : 'pr-4',
      )}
    >
      <Badge tone={tone} icon={icon} continued={continued} />
      <p className="min-w-0 truncate text-sm">
        <span className="font-medium text-fg">{title}</span>
        {description ? <span className="text-fg-subtle"> · {description}</span> : null}
      </p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="ml-1 h-7 shrink-0 cursor-pointer rounded-full bg-surface-hover px-3 text-xs font-semibold text-fg transition-[background-color,scale] duration-150 ease-out hover:bg-border-strong active:scale-[0.96]"
        >
          {action.label}
        </button>
      ) : null}
      {tone === 'error' && onDismiss ? (
        <button
          type="button"
          aria-label="Cerrar notificación"
          onClick={onDismiss}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-fg-subtle transition-[color,background-color,scale] duration-150 ease-out hover:bg-surface-hover hover:text-fg active:scale-[0.92]"
        >
          <Close size={13} />
        </button>
      ) : null}
    </div>
  )
}

function show(tone: NotifyTone, title: string, opts: NotifyOptions = {}, continued = false) {
  const { description, icon, action, id } = opts
  const duration =
    opts.duration ??
    (tone === 'loading' ? Number.POSITIVE_INFINITY : action || tone === 'error' ? 6000 : 4000)
  return toast.custom(
    (toastId) => (
      <div className="flex w-full justify-center">
        <NotificationPill
          tone={tone}
          title={title}
          description={description}
          icon={icon}
          continued={continued}
          action={
            action
              ? {
                  label: action.label,
                  onClick: () => {
                    action.onClick()
                    toast.dismiss(toastId)
                  },
                }
              : undefined
          }
          onDismiss={() => toast.dismiss(toastId)}
        />
      </div>
    ),
    { id, duration },
  )
}

type Msg<T> = string | ((value: T) => string)
const resolveMsg = <T,>(m: Msg<T>, v: T) => (typeof m === 'function' ? m(v) : m)

export const notify = {
  success: (title: string, opts?: NotifyOptions) => show('success', title, opts),
  error: (title: string, opts?: NotifyOptions) => show('error', title, opts),
  info: (title: string, opts?: NotifyOptions) => show('info', title, opts),
  loading: (title: string, opts?: NotifyOptions) => show('loading', title, opts),
  dismiss: (id?: string | number) => toast.dismiss(id),
  /** Muestra «cargando» y lo sustituye por éxito o error cuando la promesa termina. */
  async promise<T>(
    promise: Promise<T>,
    msgs: { loading: string; success: Msg<T>; error: Msg<unknown> },
  ): Promise<T> {
    const id = show('loading', msgs.loading)
    try {
      const value = await promise
      show('success', resolveMsg(msgs.success, value), { id }, true)
      return value
    } catch (err) {
      show('error', resolveMsg(msgs.error, err), { id })
      throw err
    }
  },
}

/** Va una vez en la raíz de la app. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={16}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
      gap={8}
      visibleToasts={3}
      containerAriaLabel="Notificaciones"
      // Ancho máximo de la pila (escritorio); la píldora se ajusta a su contenido dentro.
      style={{ '--width': '440px' } as CSSProperties}
      toastOptions={{ unstyled: true, className: 'w-full' }}
    />
  )
}

/** Copia texto al portapapeles. Devuelve `false` si el navegador no lo permite. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback para contextos sin la API asíncrona (http, permisos denegados).
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}
