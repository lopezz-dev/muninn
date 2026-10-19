import { DropdownMenu, Dialog as RDialog, Tooltip as RTooltip } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../cn'
import { icons } from '../icons'
import { IconButton } from './button'
import { Kbd } from './display'

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
}

export function DialogContent({
  title,
  description,
  footer,
  className,
  children,
  ...props
}: DialogContentProps) {
  const Close = icons.close
  return (
    <RDialog.Portal>
      <RDialog.Overlay className={overlay} />
      <RDialog.Content
        // Sin descripción, Radix exige `aria-describedby={undefined}` explícito para no avisar.
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'glass-raised fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border border-border-strong p-5 shadow-popover outline-none data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <RDialog.Title className="text-lg font-semibold">{title}</RDialog.Title>
            {description ? (
              <RDialog.Description className="text-sm text-fg-muted">
                {description}
              </RDialog.Description>
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
        {children}
        {footer ? <div className="flex justify-end gap-2 pt-1">{footer}</div> : null}
      </RDialog.Content>
    </RDialog.Portal>
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
  footer?: ReactNode
}

export function SheetContent({
  title,
  hideTitle,
  side = 'right',
  toolbar,
  footer,
  className,
  children,
  ...props
}: SheetContentProps) {
  const Close = icons.close
  return (
    <RDialog.Portal>
      <RDialog.Overlay className={overlay} />
      <RDialog.Content
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
          <span aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-border-strong" />
        ) : null}
        <div className="flex h-13 shrink-0 items-center gap-1 border-b border-border-subtle pr-3 pl-5">
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

// ─── Menú ────────────────────────────────────────────────────────────────────

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'glass-raised z-50 min-w-[200px] rounded-lg border border-border-strong p-1 shadow-popover outline-none data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export interface MenuItemProps extends ComponentProps<typeof DropdownMenu.Item> {
  icon?: ReactNode
  /** Atajo de teclado a la derecha. */
  shortcut?: string
  danger?: boolean
}

export function MenuItem({ icon, shortcut, danger, className, children, ...props }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex h-8 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover',
        danger ? 'text-danger' : 'text-fg',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className={cn('flex', danger ? 'text-danger' : 'text-fg-subtle')}>{icon}</span>
      ) : null}
      <span className="flex-1">{children}</span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </DropdownMenu.Item>
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn(
        'px-2 pt-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-fg-faint',
        className,
      )}
      {...props}
    />
  )
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Separator>) {
  return (
    <DropdownMenu.Separator className={cn('my-1 h-px bg-border-subtle', className)} {...props} />
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

/** Va una vez en la raíz de la app. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={400}>{children}</RTooltip.Provider>
}

export interface TooltipProps {
  content: ReactNode
  /** El disparador: un elemento enfocable (botón, enlace). */
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-sm border border-border-strong bg-surface-raised px-2 py-1 text-xs text-fg shadow-popover data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
