import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { cn } from '../cn'
import { Field } from './forms'

export interface CodeFieldProps {
  label: ReactNode
  /** Solo cifras, como mucho `length`. */
  value: string
  onChange: (value: string) => void
  /** Al completar las cifras, al teclear la última o al pegar el código entero. */
  onComplete?: (value: string) => void
  /** Cifras del código. Con seis, se agrupan de tres en tres. */
  length?: number
  hint?: ReactNode
  /** Mensaje de error. Cada vez que cambia a uno nuevo, las casillas tiemblan. */
  error?: ReactNode
  hideLabel?: boolean
  disabled?: boolean
  autoFocus?: boolean
  id?: string
  className?: string
}

/**
 * Código de una sola vez (segundo factor, verificación) con una casilla por cifra. Por debajo es UN solo `<input>`
 * transparente encima de las casillas: así pegar, el autocompletado del móvil (`one-time-code`), los gestores de
 * contraseñas y el borrado funcionan como en cualquier campo, y el lector de pantalla oye un campo, no seis.
 */
export function CodeField({
  label,
  value,
  onChange,
  onComplete,
  length = 6,
  hint,
  error,
  hideLabel,
  disabled,
  autoFocus,
  id: idProp,
  className,
}: CodeFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const input = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  // Cada error nuevo vuelve a montar la fila, y con ello repite el temblor.
  const [shakes, setShakes] = useState(0)
  useEffect(() => {
    if (error) setShakes((n) => n + 1)
  }, [error])

  // El cursor siempre al final: las casillas no tienen cursor propio y escribir en medio confundiría.
  const toEnd = () => {
    const el = input.current
    if (el) el.setSelectionRange(el.value.length, el.value.length)
  }
  const change = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, length)
    onChange(next)
    if (next.length === length && value.length < length) onComplete?.(next)
  }

  const active = focused && !disabled ? Math.min(value.length, length - 1) : -1
  const half = length === 6 ? 3 : -1
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      <div className={cn('relative w-fit', disabled && 'opacity-50')}>
        <div
          key={shakes}
          className={cn(
            'flex items-center gap-1.5 sm:gap-2',
            shakes > 0 && error ? 'animate-shake' : undefined,
          )}
        >
          {Array.from({ length }, (_, i) => {
            const digit = value[i]
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: las casillas son fijas, la posición es su identidad.
              <span key={i} className="contents">
                {i === half ? (
                  <span aria-hidden="true" className="h-0.5 w-2.5 rounded-full bg-border-strong" />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid h-12 w-10 place-items-center rounded-md border bg-surface-sunken font-mono text-xl font-medium text-fg transition-[border-color,box-shadow] duration-150 sm:h-14 sm:w-12 sm:text-2xl',
                    error
                      ? 'border-danger'
                      : i === active
                        ? 'border-accent shadow-[0_0_0_3px_var(--mn-color-accent-soft)]'
                        : digit
                          ? 'border-border-strong'
                          : 'border-border',
                  )}
                >
                  {digit ? (
                    <span key={digit} className="animate-digit-in">
                      {digit}
                    </span>
                  ) : i === active ? (
                    <span className="h-5 w-px animate-caret bg-fg sm:h-6" />
                  ) : null}
                </span>
              </span>
            )
          })}
        </div>
        {/* Encima de las casillas, y fuera de la fila: si se volviera a montar con el temblor, perdería el foco. */}
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          spellCheck={false}
          // Sin maxLength: el navegador recortaría «123 456» al pegar antes de quitar el espacio. Lo recorta `change`.
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          // 16 px: con menos, el iPhone hace zoom al enfocar (gotchas/web). El texto es invisible igualmente.
          className="absolute inset-0 size-full cursor-text bg-transparent text-[16px] text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent disabled:cursor-not-allowed"
          value={value}
          disabled={disabled}
          // biome-ignore lint/a11y/noAutofocus: lo pide quien lo usa (un diálogo que solo sirve para escribir el código).
          autoFocus={autoFocus}
          onChange={(e) => change(e.target.value)}
          onFocus={() => {
            setFocused(true)
            toEnd()
          }}
          onBlur={() => setFocused(false)}
          onSelect={toEnd}
        />
      </div>
    </Field>
  )
}
