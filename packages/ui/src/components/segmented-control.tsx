import { ToggleGroup } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedOption<T>[]
  'aria-label': string
  /** Reparte el ancho a partes iguales. */
  fill?: boolean
  size?: 'md' | 'lg'
  className?: string
}

/** Selector de una opción (Tablero/Lista, Gasto/Ingreso…). Nunca queda sin selección. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  fill,
  size = 'md',
  className,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange(v as T)
      }}
      className={cn(
        'inline-flex gap-0.5 rounded-md border border-border bg-surface p-0.5',
        fill && 'flex w-full',
        className,
      )}
      {...aria}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2.5 font-medium text-fg-muted transition-colors duration-150 hover:text-fg data-[state=on]:bg-surface-raised data-[state=on]:text-fg',
            size === 'lg' ? 'h-[38px] text-sm' : 'h-[26px] text-[12.5px]',
            fill && 'flex-1',
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
