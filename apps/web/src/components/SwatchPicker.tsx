import { cn } from '@muninn/ui'
import type { CSSProperties } from 'react'

export interface Swatch<T extends string> {
  value: T
  label: string
  /** Color ya resuelto (hex de los tokens). */
  color: string
}

interface SwatchPickerProps<T extends string> {
  legend: string
  hideLegend?: boolean
  /** Nombre del grupo de radios (único en la página). */
  name: string
  value: T
  options: Swatch<T>[]
  onChange: (value: T) => void
  className?: string
}

/**
 * Selector de color con radios nativos: las flechas cambian de opción y Tab entra y sale del grupo
 * sin código extra. Cada muestra mide 22 px y su zona táctil, 44 px en móvil.
 */
export function SwatchPicker<T extends string>({
  legend,
  hideLegend,
  name,
  value,
  options,
  onChange,
  className,
}: SwatchPickerProps<T>) {
  return (
    <fieldset className={cn('flex flex-col gap-1.5', className)}>
      <legend className={cn('mb-1.5 text-xs font-medium text-fg-muted', hideLegend && 'sr-only')}>
        {legend}
      </legend>
      <div className="-m-[11px] flex flex-wrap md:-m-[5px]">
        {options.map((o) => (
          <label
            key={o.value}
            className="grid size-11 cursor-pointer place-items-center md:size-8"
            style={{ '--swatch': o.color } as CSSProperties}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              aria-label={o.label}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="size-[22px] rounded-md bg-(--swatch) ring-offset-2 ring-offset-bg transition-shadow peer-checked:ring-2 peer-checked:ring-(--swatch) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent"
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
