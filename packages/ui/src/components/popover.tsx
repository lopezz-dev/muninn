import { Popover as RPopover } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '../cn'

// Módulo propio, como el de fechas: Popover solo viaja en los chunks que lo usan.

export const Popover = RPopover.Root
export const PopoverTrigger = RPopover.Trigger
export const PopoverAnchor = RPopover.Anchor
export const PopoverClose = RPopover.Close

/** Panel flotante con cristal, junto a su disparador. Crece desde él con la animación de entrada. */
export function PopoverContent({
  className,
  sideOffset = 6,
  collisionPadding = 12,
  ...props
}: ComponentProps<typeof RPopover.Content>) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'glass-raised z-50 origin-(--radix-popover-content-transform-origin) rounded-lg border border-border-strong bg-surface-raised p-1.5 shadow-popover outline-none data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </RPopover.Portal>
  )
}
