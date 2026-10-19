import { Checkbox as RCheckbox, Switch as RSwitch, ToggleGroup } from 'radix-ui'
import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, useId } from 'react'
import { cn } from '../cn'
import { icons } from '../icons'

const fieldBox =
  'w-full rounded-md border border-border-strong bg-surface-sunken text-fg placeholder:text-fg-faint transition-colors duration-150 outline-none focus:border-accent aria-[invalid=true]:border-danger disabled:opacity-50'

interface FieldChrome {
  label: ReactNode
  /** Texto de ayuda bajo el campo. */
  hint?: ReactNode
  /** Mensaje de error: marca el campo como inválido. */
  error?: ReactNode
  /** Oculta la etiqueta visualmente (sigue existiendo para lectores de pantalla). */
  hideLabel?: boolean
}

function Field({
  id,
  label,
  hint,
  error,
  hideLabel,
  className,
  children,
}: FieldChrome & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className={cn('text-xs font-medium text-fg-muted', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    FieldChrome {
  /** Icono o texto dentro del campo, a la izquierda. */
  leading?: ReactNode
  /** Contenido a la derecha (unidad «€», atajo…). */
  trailing?: ReactNode
  /** `lg` = 44 px, para móvil. */
  size?: 'md' | 'lg'
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  leading,
  trailing,
  size = 'md',
  className,
  id: idProp,
  ...props
}: TextFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const describedBy = error || hint ? `${id}-msg` : undefined
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      <div className="relative flex items-center">
        {leading ? (
          <span className="pointer-events-none absolute left-3 flex text-fg-subtle">{leading}</span>
        ) : null}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldBox,
            size === 'lg' ? 'h-11 px-3.5 text-md' : 'h-9 px-3 text-base',
            leading ? 'pl-9' : undefined,
            trailing ? 'pr-10' : undefined,
          )}
          {...props}
        />
        {trailing ? <span className="absolute right-3 flex text-fg-subtle">{trailing}</span> : null}
      </div>
    </Field>
  )
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChrome {}

export function TextArea({
  label,
  hint,
  error,
  hideLabel,
  className,
  id: idProp,
  rows = 4,
  ...props
}: TextAreaProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cn(fieldBox, 'resize-y px-3 py-2 text-base leading-relaxed')}
        {...props}
      />
    </Field>
  )
}

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Nombre accesible si no hay `<label>` asociado. */
  'aria-label'?: string
  id?: string
  disabled?: boolean
  className?: string
}

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <RSwitch.Root
      className={cn(
        'inline-flex h-5 w-[34px] shrink-0 cursor-pointer items-center rounded-full bg-border-strong p-0.5 transition-colors duration-200 data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RSwitch.Thumb className="block size-4 rounded-full bg-fg shadow-sm transition-transform duration-200 ease-out data-[state=checked]:translate-x-3.5" />
    </RSwitch.Root>
  )
}

export interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  'aria-label'?: string
  id?: string
  disabled?: boolean
  /** Amplía la zona táctil a 44 px sin cambiar el tamaño visual (móvil). */
  touch?: boolean
  /** Variante redonda grande, para completar tareas. */
  size?: 'md' | 'lg'
  className?: string
}

export function Checkbox({ className, touch, size = 'md', ...props }: CheckboxProps) {
  const Check = icons.check
  return (
    <RCheckbox.Root
      className={cn(
        'relative grid shrink-0 cursor-pointer place-items-center rounded-sm border-[1.5px] border-fg-faint/60 bg-transparent transition-colors duration-150 hover:border-fg-subtle data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' ? 'size-[22px] rounded-md' : 'size-4',
        touch && "before:absolute before:-inset-3 before:content-['']",
        className,
      )}
      {...props}
    >
      <RCheckbox.Indicator className="text-accent-fg">
        <Check size={size === 'lg' ? 13 : 11} weight="bold" />
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  )
}

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
