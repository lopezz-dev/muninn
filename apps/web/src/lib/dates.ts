/**
 * Fechas de la UI. `dueDate` es una fecha local `AAAA-MM-DD` (sin hora): se compara como texto
 * con «hoy» (`m.today()`), nunca con `new Date(dueDate)`, que la interpretaría en UTC.
 */

const MONTH = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const MONTH_YEAR = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const asDate = (iso: string) => new Date(`${iso}T12:00:00`)

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** «Hoy», «Mañana», «Ayer», «17 oct» (con el año si no es el actual). */
export function dueLabel(due: string, today: string) {
  if (due === today) return 'Hoy'
  if (due === addDays(today, 1)) return 'Mañana'
  if (due === addDays(today, -1)) return 'Ayer'
  const sameYear = due.slice(0, 4) === today.slice(0, 4)
  return (sameYear ? MONTH : MONTH_YEAR).format(asDate(due)).replace('.', '')
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

export function dueTone(due: string, today: string): DueTone {
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return due <= addDays(today, 3) ? 'soon' : 'later'
}

const REL = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** «hace 20 min», «ayer», «hace 3 días»; a partir de una semana, la fecha. */
export function timeAgo(iso: string, now = new Date()) {
  const secs = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(secs)
  if (abs < 45) return 'ahora mismo'
  if (abs < 3600) return REL.format(Math.round(secs / 60), 'minute')
  if (abs < 86_400) return REL.format(Math.round(secs / 3600), 'hour')
  if (abs < 7 * 86_400) return REL.format(Math.round(secs / 86_400), 'day')
  return MONTH.format(new Date(iso)).replace('.', '')
}

/** «09:12» en la zona horaria del navegador. */
export const clock = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

/** Inicial de la semana en español para la gráfica: «Lun», «Mar»… */
export function weekdayShort(iso: string) {
  const s = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
    .format(asDate(iso))
    .replace('.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
