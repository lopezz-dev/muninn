import { ColorDot, cn, icons, Menu, MenuContent, MenuItem, MenuTrigger } from '@muninn/ui'
import type { ReactNode } from 'react'

export interface SelectOption<T extends string> {
  value: T
  label: string
  /** Color de proyecto o de tipo de columna (cuadradito a la izquierda). */
  dot?: string
  icon?: ReactNode
  /** Clases del texto (la prioridad se pinta con su color). */
  tone?: string
  /** Texto pequeño a la derecha («en Huginn»): por qué no se puede elegir, o un detalle. */
  hint?: string
  disabled?: boolean
}

interface SelectMenuProps<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** Nombre accesible: «Prioridad», «Estado»… El botón dice «Prioridad: Alta». */
  label: string
  /** `field`: botón con borde (formularios). `inline`: sin borde, como una propiedad editable. */
  variant?: 'field' | 'inline'
  /** Texto fijo del botón en lugar del valor elegido («Mover a…»). */
  buttonText?: string
  /** Táctil: 44 px (móvil). */
  large?: boolean
  /** Mientras se cargan las opciones. */
  disabled?: boolean
  className?: string
}

/** Selector con menú desplegable. Sin `<select>` nativo: el diseño pide el menú de Muninn. */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  label,
  variant = 'field',
  large,
  buttonText,
  disabled,
  className,
}: SelectMenuProps<T>) {
  const current = options.find((o) => o.value === value)
  // Con pistas, cada fila ocupa todo el ancho para alinearlas a la derecha.
  const withHints = options.some((o) => o.hint)
  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`${label}: ${current?.label ?? ''}`}
          className={cn(
            'inline-flex cursor-pointer items-center gap-2 rounded-md font-medium whitespace-nowrap outline-none transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:text-fg-faint',
            variant === 'field'
              ? 'border border-border-strong bg-surface-raised px-3 text-fg hover:bg-surface-hover'
              : '-ml-2 px-2 text-fg hover:bg-surface-hover',
            large ? 'h-[38px] text-sm' : variant === 'field' ? 'h-9 text-sm' : 'h-7 text-sm',
            current?.tone,
            className,
          )}
        >
          {buttonText ? null : current?.dot ? <ColorDot color={current.dot} /> : null}
          {buttonText ? null : current?.icon}
          <span className="truncate">{buttonText ?? current?.label}</span>
          <icons.chevronDown size={12} className="shrink-0 text-fg-subtle" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="max-h-72 overflow-y-auto">
        {options.map((o) => (
          <MenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            disabled={o.disabled}
            className={o.tone}
          >
            <span className={cn('flex items-center gap-2', withHints && 'w-full')}>
              {o.dot ? <ColorDot color={o.dot} /> : null}
              {o.icon}
              {o.label}
              {o.hint ? <span className="ml-auto pl-3 text-xs text-fg-faint">{o.hint}</span> : null}
              {o.value === value ? (
                <icons.check size={13} className="ml-auto text-accent" aria-hidden="true" />
              ) : null}
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
