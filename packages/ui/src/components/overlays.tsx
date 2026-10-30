import { Dialog as RDialog } from 'radix-ui'
import { type ComponentProps, type PointerEvent, type ReactNode, useRef } from 'react'
import { cn } from '../cn'
import { icons } from '../icons'
import { IconButton } from './button'

// ─── Diálogo ─────────────────────────────────────────────────────────────────

export const Dialog = RDialog.Root
export const DialogTrigger = RDialog.Trigger
export const DialogClose = RDialog.Close

const overlay =
  'fixed inset-0 z-40 bg-overlay data-[state=open]:animate-fade-in supports-[backdrop-filter]:backdrop-blur-[2px]'

export interface DialogContentProps extends Omit<ComponentProps<typeof RDialog.Content>, 'title'> {
  /** Obligatorio: Radix lo usa como nombre accesible del diálogo. */
  title: ReactNode
  description?: ReactNode
  /** Botones al pie, alineados a la derecha. */
  footer?: ReactNode
  /** `md` 480 px (formularios), `lg` 660 px (buscador ⌘K). */
  size?: 'md' | 'lg'
  /**
   * Sin cabecera, sin relleno y sin botón de cerrar: el contenido lo pone todo (buscador ⌘K).
   * El título sigue existiendo para los lectores de pantalla. Escape cierra.
   */
  bare?: boolean
}

/**
 * Posición del diálogo SIEMPRE en píxeles enteros: centrar con translate(-50%) o margin:auto deja
 * medios píxeles y, al repintar (hover), el texto «salta» al encajar en la rejilla. Se ancla arriba
 * (12vh) para que no se mueva si el contenido crece.
 */
const DIALOG_WIDTH = { md: 480, lg: 660 } as const

const dialogPosition = (w: number) =>
  ({
    width: `min(${w}px, calc(100vw - 32px))`,
    left: `round(down, max(16px, calc((100vw - ${w}px) / 2)), 1px)`,
    top: 'round(down, max(16px, 12vh), 1px)',
    maxHeight: 'calc(100vh - max(16px, 12vh) - 16px)',
  }) as const

export function DialogContent({
  title,
  description,
  footer,
  size = 'md',
  bare,
  className,
  style,
  children,
  ...props
}: DialogContentProps) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className={overlay} />
      <RDialog.Content
        // Sin descripción, Radix exige `aria-describedby={undefined}` explícito para no avisar.
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'glass-raised fixed z-50 flex flex-col overflow-y-auto rounded-xl border border-border-strong shadow-popover outline-none data-[state=open]:animate-pop-in',
          bare ? 'overflow-hidden' : 'gap-4 p-5',
          className,
        )}
        style={{ ...dialogPosition(DIALOG_WIDTH[size]), ...style }}
        {...props}
      >
        {bare ? (
          <RDialog.Title className="sr-only">{title}</RDialog.Title>
        ) : (
          <DialogHeader title={title} description={description} />
        )}
        {bare && description ? (
          <RDialog.Description className="sr-only">{description}</RDialog.Description>
        ) : null}
        {children}
        {footer ? <div className="flex justify-end gap-2 pt-1">{footer}</div> : null}
      </RDialog.Content>
    </RDialog.Portal>
  )
}

function DialogHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  const Close = icons.close
  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <RDialog.Title className="text-lg font-semibold">{title}</RDialog.Title>
        {description ? (
          <RDialog.Description className="text-sm text-fg-muted">{description}</RDialog.Description>
        ) : null}
      </div>
      <RDialog.Close asChild>
        <IconButton
          aria-label="Cerrar"
          icon={<Close />}
          size="sm"
          className="-mt-1 -mr-1 ml-auto"
        />
      </RDialog.Close>
    </div>
  )
}

// ─── Panel lateral / hoja inferior ───────────────────────────────────────────

export interface SheetContentProps extends Omit<ComponentProps<typeof RDialog.Content>, 'title'> {
  title: ReactNode
  /** Oculta el título visualmente (si el contenido ya lo muestra a su manera). */
  hideTitle?: boolean
  /** `right`: detalle de tarea en escritorio. `bottom`: hoja en móvil. */
  side?: 'right' | 'bottom'
  /** Barra superior a la izquierda del botón de cerrar (ruta, acciones). */
  toolbar?: ReactNode
  /** Delante del título, en la cabecera: un «‹ Volver» si la hoja navega por dentro. */
  leading?: ReactNode
  footer?: ReactNode
  /** Hoja inferior: arrastrar el asa hacia abajo la cierra (llama a esto). Sin él, el asa es solo decorativa. */
  onDragClose?: () => void
}

/** Lo que hay que bajar el asa para que la hoja se cierre al soltar. */
const DRAG_CLOSE_PX = 120

/**
 * Arrastre del asa de una hoja inferior: la hoja sigue al dedo y, al soltar, se cierra si bajó lo bastante o vuelve a su
 * sitio. Se mueve con `translate` en línea, sin transición mientras se arrastra.
 */
function useDragToClose(onClose?: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)
  const place = (dy: number | null) => {
    const el = ref.current
    if (!el) return
    el.style.translate = dy ? `0 ${dy}px` : ''
    el.style.transition = dy === null ? 'translate 200ms var(--mn-motion-ease-out)' : 'none'
  }
  const handle = onClose
    ? {
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
          start.current = e.clientY
          e.currentTarget.setPointerCapture(e.pointerId)
        },
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
          if (start.current !== null) place(Math.max(0, e.clientY - start.current))
        },
        onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
          if (start.current === null) return
          const dy = e.clientY - start.current
          start.current = null
          place(null)
          if (dy > DRAG_CLOSE_PX) onClose()
        },
        onPointerCancel: () => {
          start.current = null
          place(null)
        },
      }
    : null
  return { ref, handle }
}

export function SheetContent({
  title,
  hideTitle,
  side = 'right',
  toolbar,
  leading,
  footer,
  onDragClose,
  className,
  children,
  ...props
}: SheetContentProps) {
  const Close = icons.close
  const drag = useDragToClose(side === 'bottom' ? onDragClose : undefined)
  return (
    <RDialog.Portal>
      <RDialog.Overlay className={overlay} />
      <RDialog.Content
        ref={drag.ref}
        aria-describedby={undefined}
        className={cn(
          'glass-raised fixed z-50 flex flex-col border-border-strong outline-none',
          side === 'right'
            ? 'inset-y-0 right-0 w-[min(620px,100vw)] border-l shadow-panel data-[state=open]:animate-slide-in-right'
            : 'inset-x-0 bottom-0 max-h-[92vh] rounded-t-xl border-t shadow-popover data-[state=open]:animate-slide-in-up',
          className,
        )}
        {...props}
      >
        {side === 'bottom' ? (
          drag.handle ? (
            // Zona de agarre más grande que el asa que se ve, para el dedo.
            <div
              aria-hidden="true"
              className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing"
              {...drag.handle}
            >
              <span className="h-1 w-9 rounded-full bg-border-strong" />
            </div>
          ) : (
            <span
              aria-hidden="true"
              className="mx-auto mt-2 h-1 w-9 rounded-full bg-border-strong"
            />
          )
        ) : null}
        <div
          className={cn(
            'flex h-13 shrink-0 items-center gap-1 border-b border-border-subtle pr-3',
            leading ? 'pl-2' : 'pl-5',
          )}
        >
          {leading}
          <RDialog.Title
            className={cn('text-sm font-medium text-fg-muted', hideTitle && 'sr-only')}
          >
            {title}
          </RDialog.Title>
          <div className="ml-auto flex items-center gap-1">
            {toolbar}
            <RDialog.Close asChild>
              <IconButton aria-label="Cerrar" icon={<Close />} />
            </RDialog.Close>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle px-4 py-3">
            {footer}
          </div>
        ) : null}
      </RDialog.Content>
    </RDialog.Portal>
  )
}
