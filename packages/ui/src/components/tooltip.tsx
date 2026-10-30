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
  /** No se abre (p. ej. mientras se arrastra el disparador). El disparador sigue igual: no se vuelve a montar. */
  disabled?: boolean
}

export function Tooltip({ content, children, side = 'top', disabled }: TooltipProps) {
  return (
    <RTooltip.Root open={disabled ? false : undefined}>
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
