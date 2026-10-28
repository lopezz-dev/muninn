import { DropdownMenu } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../cn'
import { icons } from '../icons'
import { Kbd } from './display'

// Módulo propio (no en overlays.tsx): así DropdownMenu solo viaja en los chunks que usan menús.

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuSub = DropdownMenu.Sub

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

/** Elemento que abre un submenú (`<MenuSub>` + `<MenuSubTrigger>` + `<MenuSubContent>`). */
export function MenuSubTrigger({
  icon,
  danger,
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenu.SubTrigger> & { icon?: ReactNode; danger?: boolean }) {
  return (
    <DropdownMenu.SubTrigger
      className={cn(
        'flex h-8 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover data-[state=open]:bg-surface-hover',
        danger ? 'text-danger' : 'text-fg',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className={cn('flex', danger ? 'text-danger' : 'text-fg-subtle')}>{icon}</span>
      ) : null}
      <span className="flex-1">{children}</span>
      <icons.chevronRight size={14} className="text-fg-faint" />
    </DropdownMenu.SubTrigger>
  )
}

export function MenuSubContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenu.SubContent>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent
        sideOffset={sideOffset}
        className={cn(
          'glass-raised z-50 min-w-[180px] rounded-lg border border-border-strong p-1 shadow-popover outline-none data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
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
