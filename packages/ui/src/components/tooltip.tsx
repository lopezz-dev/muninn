import { Tooltip as RTooltip } from 'radix-ui'
import type { ReactNode } from 'react'

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
