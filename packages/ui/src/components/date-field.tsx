import { Popover } from 'radix-ui'
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { cn } from '../cn'
import { icons } from '../icons'
import { Button, IconButton } from './button'
import { Field, type FieldChrome, fieldBox } from './forms'

// Módulo propio (no en forms.tsx): así Popover solo viaja en los chunks que piden fechas o meses.

/** Fecha `AAAA-MM-DD` → partes. Sin `Date` local: el día no se mueve con la zona horaria. */
const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return { y, m, d }
}
const isoOf = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.toISOString().slice(0, 10)
}
const addDays = (iso: string, n: number) => {
  const { y, m, d } = parts(iso)
  return isoOf(y, m, d + n)
}
/** Mismo día del mes `n` meses después, sin pasarse de su último día (31 ene + 1 → 28 feb). */
const addMonths = (iso: string, n: number) => {
  const { y, m, d } = parts(iso)
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate()
  return isoOf(y, m + n, Math.min(d, last))
}
/** Lunes = 0 … domingo = 6. */
const weekday = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
const localToday = () => {
  const n = new Date()
  return isoOf(n.getFullYear(), n.getMonth() + 1, n.getDate())
}
const isIso = (v: string | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v))

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-ES', { ...opts, timeZone: 'UTC' })
const monthFmt = fmt({ month: 'long', year: 'numeric' })
const longFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «mar, 27 oct 2026». Para mostrar una fecha elegida. */
export const formatDateShort = (iso: string) => shortFmt.format(utc(iso)).replaceAll('.', '')

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/**
 * ¿Puntero grueso (táctil)? Ahí el selector nativo del sistema (iOS, Android) es mejor que el
 * calendario propio. Con ratón, el nativo de escritorio no respeta el tema ni el idioma de la app.
 */
export function useCoarsePointer() {
  return useSyncExternalStore(
    (notify) => {
      if (typeof matchMedia !== 'function') return () => {}
      const mq = matchMedia('(pointer: coarse)')
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    () => false,
  )
}

export interface CalendarProps {
  /** Día elegido (`AAAA-MM-DD`) o vacío. */
  value?: string
  onSelect: (iso: string) => void
  /** Hoy, para marcarlo. Por defecto, el día local. */
  today?: string
  /** Añade «Quitar» al pie (solo si hay fecha). */
  onClear?: () => void
  /** Pone el foco en el día activo al montarse (al abrir el popover). */
  autoFocus?: boolean
}

/**
 * Calendario mensual en español, con la semana empezando en lunes. Se maneja con el teclado:
 * flechas (día y semana), Inicio/Fin (semana), RePág/AvPág (mes; con Mayús, año).
 */
export function Calendar({
  value,
  onSelect,
  today = localToday(),
  onClear,
  autoFocus,
}: CalendarProps) {
  const selected = isIso(value) ? value : undefined
  // Día con el foco (tabindex itinerante); el mes visible es el suyo.
  const [active, setActive] = useState(selected ?? today)
  const [focusNext, setFocusNext] = useState(Boolean(autoFocus))
  const grid = useRef<HTMLTableElement>(null)
  const labelId = useId()

  useEffect(() => {
    if (!focusNext) return
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)?.focus()
    setFocusNext(false)
  }, [active, focusNext])

  const { y, m } = parts(active)
  const first = isoOf(y, m, 1)
  const start = addDays(first, -weekday(first))
  // Siempre seis semanas: el popover no cambia de alto al pasar de mes.
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))

  const go = (iso: string) => {
    setActive(iso)
    setFocusNext(true)
  }
  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(active, -1),
      ArrowRight: () => addDays(active, 1),
      ArrowUp: () => addDays(active, -7),
      ArrowDown: () => addDays(active, 7),
      Home: () => addDays(active, -weekday(active)),
      End: () => addDays(active, 6 - weekday(active)),
      PageUp: () => addMonths(active, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(active, e.shiftKey ? 12 : 1),
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    go(move())
  }

  return (
    <div className="flex w-[252px] flex-col gap-2">
      <div className="flex items-center gap-1">
        <span id={labelId} aria-live="polite" className="flex-1 pl-1.5 text-sm font-semibold">
          {capital(monthFmt.format(utc(first)))}
        </span>
        <IconButton
          aria-label="Mes anterior"
          icon={<icons.chevronLeft size={14} />}
          size="sm"
          onClick={() => setActive(addMonths(active, -1))}
        />
        <IconButton
          aria-label="Mes siguiente"
          icon={<icons.chevronRight size={14} />}
          size="sm"
          onClick={() => setActive(addMonths(active, 1))}
        />
      </div>

      <table
        ref={grid}
        aria-labelledby={labelId}
        onKeyDown={onKey}
        className="w-full border-collapse"
      >
        <thead>
          <tr>
            {WEEKDAYS.map((d, i) => (
              <th key={d} scope="col" className="h-7 p-0 text-2xs font-medium text-fg-subtle">
                <abbr title={WEEKDAY_NAMES[i]} className="no-underline">
                  {d}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((w) => (
            <tr key={w}>
              {days.slice(w * 7, w * 7 + 7).map((day) => {
                const inMonth = parts(day).m === m
                const isSelected = day === selected
                const isToday = day === today
                return (
                  <td key={day} className="p-px text-center">
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === active ? 0 : -1}
                      aria-label={longFmt.format(utc(day))}
                      aria-pressed={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onSelect(day)}
                      onFocus={() => setActive(day)}
                      className={cn(
                        'relative mx-auto grid size-8 cursor-pointer place-items-center rounded-md text-sm tabular outline-none transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-accent',
                        isSelected
                          ? 'bg-accent font-semibold text-accent-fg'
                          : cn(
                              'hover:bg-surface-hover',
                              inMonth ? 'text-fg' : 'text-fg-faint',
                              isToday && 'font-semibold text-accent',
                            ),
                      )}
                    >
                      {parts(day).d}
                      {isToday && !isSelected ? (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1 size-1 rounded-full bg-accent"
                        />
                      ) : null}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t border-border-subtle pt-2">
        <Button size="sm" variant="ghost" onClick={() => onSelect(today)}>
          Hoy
        </Button>
        {onClear && selected ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Quitar fecha
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export interface DatePickerProps {
  value: string
  onChange: (iso: string) => void
  /** El botón que lo abre (se usa con `asChild`). */
  children: ReactNode
  /** Permite dejar la fecha vacía («Quitar fecha»). */
  clearable?: boolean
  today?: string
  align?: 'start' | 'center' | 'end'
}

/** Popover con el calendario, abierto desde el botón que le pases. Se cierra al elegir. */
export function DatePicker({
  value,
  onChange,
  children,
  clearable,
  today,
  align = 'start',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const pick = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          // El calendario enfoca su día activo: Radix no debe mover el foco antes.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={popoverBox}
        >
          <Calendar
            value={value}
            onSelect={pick}
            today={today}
            onClear={clearable ? () => pick('') : undefined}
            autoFocus
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

const popoverBox =
  'glass-raised z-50 origin-(--radix-popover-content-transform-origin) rounded-lg border border-border-strong p-2.5 shadow-popover outline-none data-[state=open]:animate-pop-in'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthOnlyFmt = fmt({ month: 'long' })
/** Mes `AAAA-MM` desplazado `n` meses. */
const shiftYm = (ym: string, n: number) => addMonths(`${ym}-01`, n).slice(0, 7)

export interface MonthCalendarProps {
  /** Mes elegido, `AAAA-MM`. */
  value: string
  onSelect: (month: string) => void
  /** Mes actual (`AAAA-MM`), para marcarlo. Por defecto, el local. */
  current?: string
  autoFocus?: boolean
}

/**
 * Los doce meses de un año, con el año a la vista y flechas para cambiarlo. Teclado: flechas (mes y
 * trimestre), Inicio/Fin (enero y diciembre), RePág/AvPág (año).
 */
export function MonthCalendar({
  value,
  onSelect,
  current = localToday().slice(0, 7),
  autoFocus,
}: MonthCalendarProps) {
  const [active, setActive] = useState(value)
  const [focusNext, setFocusNext] = useState(Boolean(autoFocus))
  const grid = useRef<HTMLFieldSetElement>(null)
  const labelId = useId()

  useEffect(() => {
    if (!focusNext) return
    grid.current?.querySelector<HTMLButtonElement>(`[data-month="${active}"]`)?.focus()
    setFocusNext(false)
  }, [active, focusNext])

  const year = Number(active.slice(0, 4))
  const monthNum = Number(active.slice(5, 7))
  const go = (ym: string) => {
    setActive(ym)
    setFocusNext(true)
  }
  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shiftYm(active, -1),
      ArrowRight: () => shiftYm(active, 1),
      ArrowUp: () => shiftYm(active, -3),
      ArrowDown: () => shiftYm(active, 3),
      Home: () => `${year}-01`,
      End: () => `${year}-12`,
      PageUp: () => shiftYm(active, -12),
      PageDown: () => shiftYm(active, 12),
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    go(move())
  }

  return (
    <div className="flex w-[252px] flex-col gap-2">
      <div className="flex items-center gap-1">
        <IconButton
          aria-label="Año anterior"
          icon={<icons.chevronLeft size={14} />}
          size="sm"
          onClick={() => setActive(shiftYm(active, -12))}
        />
        <span
          id={labelId}
          aria-live="polite"
          className="flex-1 text-center text-sm font-semibold tabular"
        >
          {year}
        </span>
        <IconButton
          aria-label="Año siguiente"
          icon={<icons.chevronRight size={14} />}
          size="sm"
          onClick={() => setActive(shiftYm(active, 12))}
        />
      </div>

      <fieldset
        ref={grid}
        aria-labelledby={labelId}
        onKeyDown={onKey}
        className="m-0 grid min-w-0 grid-cols-3 gap-1 border-0 p-0"
      >
        {MONTHS.map((label, i) => {
          const ym = `${year}-${String(i + 1).padStart(2, '0')}`
          const isSelected = ym === value
          const isCurrent = ym === current
          return (
            <button
              key={ym}
              type="button"
              data-month={ym}
              tabIndex={i + 1 === monthNum ? 0 : -1}
              aria-label={`${capital(monthOnlyFmt.format(utc(`${ym}-01`)))} de ${year}`}
              aria-pressed={isSelected}
              aria-current={isCurrent ? 'date' : undefined}
              onClick={() => onSelect(ym)}
              onFocus={() => setActive(ym)}
              className={cn(
                'relative grid h-10 cursor-pointer place-items-center rounded-md text-sm capitalize outline-none transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-accent',
                isSelected
                  ? 'bg-accent font-semibold text-accent-fg'
                  : cn('text-fg hover:bg-surface-hover', isCurrent && 'font-semibold text-accent'),
              )}
            >
              {label}
              {isCurrent && !isSelected ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 size-1 rounded-full bg-accent"
                />
              ) : null}
            </button>
          )
        })}
      </fieldset>

      <div className="flex items-center border-t border-border-subtle pt-2">
        <Button size="sm" variant="ghost" onClick={() => onSelect(current)}>
          Este mes
        </Button>
      </div>
    </div>
  )
}

export interface MonthPickerProps {
  /** `AAAA-MM`. */
  value: string
  onChange: (month: string) => void
  /** El botón que lo abre (se usa con `asChild`). */
  children: ReactNode
  current?: string
  align?: 'start' | 'center' | 'end'
}

/** Popover con los meses del año, abierto desde el botón que le pases. Se cierra al elegir. */
export function MonthPicker({
  value,
  onChange,
  children,
  current,
  align = 'center',
}: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={popoverBox}
        >
          <MonthCalendar
            value={value}
            current={current}
            onSelect={(ym) => {
              onChange(ym)
              setOpen(false)
            }}
            autoFocus
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export interface DateFieldProps extends FieldChrome {
  value: string
  onChange: (iso: string) => void
  /** `lg` = 44 px, para móvil. */
  size?: 'md' | 'lg'
  clearable?: boolean
  /** Texto cuando no hay fecha. */
  placeholder?: string
  today?: string
  disabled?: boolean
  id?: string
  className?: string
}

/**
 * Campo de fecha: con ratón, botón + calendario propio; en táctil, el `<input type="date">` nativo
 * (la rueda de iOS o el calendario de Android, que ahí son mejores).
 */
export function DateField({
  label,
  hint,
  error,
  hideLabel,
  value,
  onChange,
  size = 'md',
  clearable,
  placeholder = 'Sin fecha',
  today,
  disabled,
  id: idProp,
  className,
}: DateFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const coarse = useCoarsePointer()
  const describedBy = error || hint ? `${id}-msg` : undefined
  const box = cn(
    fieldBox,
    'flex items-center gap-2 pl-3 text-left',
    size === 'lg' ? 'h-11 pr-3.5 text-md' : 'h-9 pr-3 text-base',
  )
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      {coarse ? (
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 flex text-fg-subtle">
            <icons.calendar size={16} />
          </span>
          <input
            id={id}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(box, 'pl-9')}
          />
        </div>
      ) : (
        <DatePicker value={value} onChange={onChange} clearable={clearable} today={today}>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              box,
              'cursor-pointer hover:border-fg-faint data-[state=open]:border-accent',
            )}
          >
            <icons.calendar size={16} className="shrink-0 text-fg-subtle" />
            <span className={cn('flex-1 truncate', isIso(value) ? 'text-fg' : 'text-fg-faint')}>
              {isIso(value) ? capital(formatDateShort(value)) : placeholder}
            </span>
            <icons.chevronDown size={12} className="shrink-0 text-fg-subtle" />
          </button>
        </DatePicker>
      )}
    </Field>
  )
}
