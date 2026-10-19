import { Checkbox as RCheckbox, Switch as RSwitch } from 'radix-ui'
import { cn } from '../cn'
import { icons } from '../icons'

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
