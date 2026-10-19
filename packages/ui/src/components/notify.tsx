import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster, toast } from 'sonner'
import { cn } from '../cn'
import { icons } from '../icons'

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
}

const toneIcon: Record<
  Exclude<NotifyTone, 'loading'>,
  { Icon: (typeof icons)[keyof typeof icons]; cls: string }
> = {
  success: { Icon: icons.check, cls: 'bg-success-soft text-success' },
  error: { Icon: icons.warning, cls: 'bg-danger-soft text-danger' },
  info: { Icon: icons.info, cls: 'bg-accent-soft text-accent' },
}

/** La píldora en sí (exportada para el diseño y los tests). */
export function NotificationPill({
  tone,
  title,
  description,
  action,
  onDismiss,
}: NotificationPillProps) {
  const Close = icons.close
  return (
    <div
      className={cn(
        'glass-raised pointer-events-auto flex h-10 max-w-[calc(100vw-32px)] items-center gap-2.5 rounded-full border border-border-strong pl-2 shadow-popover',
        action || tone === 'error' ? 'pr-1.5' : 'pr-4',
      )}
    >
      {tone === 'loading' ? (
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center">
          <span className="size-4 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        </span>
      ) : (
        (() => {
          const { Icon, cls } = toneIcon[tone]
          return (
            <span
              aria-hidden="true"
              className={cn('grid size-6 shrink-0 place-items-center rounded-full', cls)}
            >
              <Icon size={13} weight="bold" />
            </span>
          )
        })()
      )}
      <p className="min-w-0 truncate text-sm">
        <span className="font-medium text-fg">{title}</span>
        {description ? <span className="text-fg-subtle"> · {description}</span> : null}
      </p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="ml-1 h-7 shrink-0 cursor-pointer rounded-full bg-surface-hover px-3 text-xs font-semibold text-fg transition-colors hover:bg-border-strong"
        >
          {action.label}
        </button>
      ) : null}
      {tone === 'error' && onDismiss ? (
        <button
          type="button"
          aria-label="Cerrar notificación"
          onClick={onDismiss}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-fg-subtle hover:bg-surface-hover hover:text-fg"
        >
          <Close size={13} />
        </button>
      ) : null}
    </div>
  )
}

function show(tone: NotifyTone, title: string, opts: NotifyOptions = {}) {
  const { description, action, id } = opts
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
      show('success', resolveMsg(msgs.success, value), { id })
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
