/**
 * Fechas de la UI. `dueDate` es una fecha local `AAAA-MM-DD` (sin hora): se compara como texto
 * con «hoy» (`m.today()`), nunca con `new Date(dueDate)`, que la interpretaría en UTC.
 */
import { currentLocale, t } from '../i18n'

/** Etiqueta de Intl del idioma activo (ADR-0077): `es-ES` en español y `en` en inglés. */
const tag = () => (currentLocale() === 'es' ? 'es-ES' : 'en')

/** Formateadores por idioma, creados una vez: `Intl` es caro de construir. */
const cache = new Map<string, unknown>()
function cached<T>(key: string, make: (locale: string) => T): T {
  const id = `${tag()}|${key}`
  if (!cache.has(id)) cache.set(id, make(tag()))
  return cache.get(id) as T
}
const dtf = (key: string, opts: Intl.DateTimeFormatOptions) =>
  cached(key, (l) => new Intl.DateTimeFormat(l, opts))
const MONTH = () => dtf('month', { day: 'numeric', month: 'short' })
const MONTH_YEAR = () => dtf('monthYear', { day: 'numeric', month: 'short', year: 'numeric' })
const CLOCK = () => dtf('clock', { hour: '2-digit', minute: '2-digit' })
const WEEKDAY_SHORT = () => dtf('weekday', { weekday: 'short' })
const REL = () => cached('rel', (l) => new Intl.RelativeTimeFormat(l, { numeric: 'auto' }))

/** Una fecha `AAAA-MM-DD` a mediodía local: así ninguna zona horaria la mueve de día al formatearla. */
export const asDate = (iso: string) => new Date(`${iso}T12:00:00`)

/** Primera letra en mayúscula («lun» → «Lun»). */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** «Hoy», «Mañana», «Ayer», «17 oct» (con el año si no es el actual), en el idioma activo. */
export function dueLabel(due: string, today: string) {
  if (due === today) return t('dates.today')
  if (due === addDays(today, 1)) return t('dates.tomorrow')
  if (due === addDays(today, -1)) return t('dates.yesterday')
  const sameYear = due.slice(0, 4) === today.slice(0, 4)
  return (sameYear ? MONTH() : MONTH_YEAR()).format(asDate(due)).replace('.', '')
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

export function dueTone(due: string, today: string): DueTone {
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return due <= addDays(today, 3) ? 'soon' : 'later'
}

/** «hace 20 min», «ayer», «hace 3 días»; a partir de una semana, la fecha. */
export function timeAgo(iso: string, now = new Date()) {
  const secs = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(secs)
  if (abs < 45) return t('dates.justNow')
  if (abs < 3600) return REL().format(Math.round(secs / 60), 'minute')
  if (abs < 86_400) return REL().format(Math.round(secs / 3600), 'hour')
  if (abs < 7 * 86_400) return REL().format(Math.round(secs / 86_400), 'day')
  return MONTH().format(new Date(iso)).replace('.', '')
}

/** «09:12» en la zona horaria del navegador. */
export const clock = (iso: string) => CLOCK().format(new Date(iso))

/** Día de la semana abreviado para la gráfica, en el idioma activo: «Lun», «Mar»… o «Mon», «Tue»… */
export const weekdayShort = (iso: string) =>
  capitalize(WEEKDAY_SHORT().format(asDate(iso)).replace('.', ''))
