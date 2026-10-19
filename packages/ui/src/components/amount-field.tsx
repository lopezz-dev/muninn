import { useState } from 'react'
import { TextField, type TextFieldProps } from './forms'

/** Lo único que se puede teclear: hasta 9 dígitos enteros y, opcionalmente, coma/punto y 2 decimales. */
const EDITABLE = /^\d{0,9}(?:[.,]\d{0,2})?$/

/** Texto del usuario → céntimos (entero). `''` → `null`. Admite coma o punto decimal. */
export function parseAmount(text: string): number | null {
  const t = text.trim()
  if (t === '' || !EDITABLE.test(t)) return null
  const [int = '', dec = ''] = t.split(/[.,]/)
  return Number(int || '0') * 100 + Number(`${dec}00`.slice(0, 2))
}

/** Céntimos → «1.284,30» (agrupa siempre miles; en es-ES Intl no agrupa 4 cifras por defecto). */
export function formatAmount(cents: number, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: 'always',
  }).format(cents / 100)
}

/** Céntimos → texto editable sin separador de miles («1284,30»). */
const toEditable = (cents: number) => formatAmount(cents).replace(/\./g, '')

export interface AmountFieldProps
  extends Omit<TextFieldProps, 'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode'> {
  /** Importe en céntimos (entero) o `null` si está vacío. */
  valueCents: number | null
  onValueChange: (cents: number | null) => void
  /** Símbolo a la derecha. */
  currency?: string
}

/**
 * Campo de importe: bloquea letras y caracteres no válidos al teclear o pegar, muestra el teclado
 * decimal en móvil y formatea al salir. Trabaja en céntimos para evitar errores de coma flotante.
 */
export function AmountField({
  valueCents,
  onValueChange,
  currency = '€',
  onFocus,
  onBlur,
  className,
  ...props
}: AmountFieldProps) {
  // Mientras se edita mostramos lo que escribe el usuario; fuera de foco, el valor formateado.
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (valueCents == null ? '' : formatAmount(valueCents))

  return (
    <TextField
      {...props}
      className={className}
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      trailing={currency}
      onFocus={(e) => {
        setDraft(valueCents == null ? '' : toEditable(valueCents))
        onFocus?.(e)
      }}
      onChange={(e) => {
        const next = e.target.value
        if (!EDITABLE.test(next)) return // se ignora: el input conserva el valor anterior
        setDraft(next)
        onValueChange(parseAmount(next))
      }}
      onBlur={(e) => {
        setDraft(null)
        onBlur?.(e)
      }}
    />
  )
}
