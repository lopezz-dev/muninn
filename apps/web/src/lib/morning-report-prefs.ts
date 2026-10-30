import type { Muninn, UserSettings } from '@muninn/core'
import type { QueryClient } from '@tanstack/react-query'
import { fail, notifyUndo } from './feedback'
import { serial } from './mutations'
import { keys } from './queries'

/**
 * Ajustes del informe de la mañana (ADR-0043), aparte de la generación (`morning-report.ts`) para que Ajustes y el shell
 * no carguen `@muninn/assistant`.
 */

/** `user_settings.preferences.morningReport`. */
export interface MorningReportPrefs {
  enabled: boolean
  /** HH:MM, hora local. */
  time: string
  /** Último día (AAAA-MM-DD) para el que ya se hizo, en cualquier dispositivo. */
  lastDate: string | null
  lastNoteId: string | null
}

export const DEFAULT_REPORT: MorningReportPrefs = {
  enabled: false,
  time: '08:30',
  lastDate: null,
  lastNoteId: null,
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function reportPrefs(
  settings: Pick<UserSettings, 'preferences'> | undefined | null,
): MorningReportPrefs {
  const raw = (settings?.preferences.morningReport ?? {}) as Partial<
    Record<keyof MorningReportPrefs, unknown>
  >
  return {
    enabled: raw.enabled === true,
    time: typeof raw.time === 'string' && TIME.test(raw.time) ? raw.time : DEFAULT_REPORT.time,
    lastDate:
      typeof raw.lastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastDate)
        ? raw.lastDate
        : null,
    lastNoteId: typeof raw.lastNoteId === 'string' ? raw.lastNoteId : null,
  }
}

/** «HH:MM» de ahora en la zona del navegador. */
export const nowClock = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** ¿Toca hacer el de hoy? Activado, ya pasó la hora y aún no se hizo hoy. */
export const reportDue = (p: MorningReportPrefs, clock: string, today: string) =>
  p.enabled && p.lastDate !== today && clock >= p.time

/**
 * Guarda un cambio del informe sobre lo último guardado, que se relee dentro de la cola de ajustes: así dos cambios
 * seguidos (la hora al salir del campo y el interruptor) o el informe que acaba mientras cambias la hora no se pisan.
 * Devuelve cómo estaba justo antes.
 */
export async function savePrefs(
  m: Muninn,
  qc: QueryClient,
  patch: Partial<MorningReportPrefs>,
): Promise<MorningReportPrefs> {
  let before = DEFAULT_REPORT
  const saved = await serial('settings', async () => {
    before = reportPrefs(await m.settings.get())
    return m.settings.update({ preferences: { morningReport: { ...before, ...patch } } })
  })
  qc.setQueryData<UserSettings>(keys.settings, (s) =>
    s ? { ...s, preferences: saved.preferences } : saved,
  )
  return before
}

/** Cambia la hora o lo activa/desactiva, con «Deshacer» (ADR-0019). */
export async function changeReportPrefs(
  m: Muninn,
  qc: QueryClient,
  patch: Partial<Pick<MorningReportPrefs, 'enabled' | 'time'>>,
  undoing = false,
): Promise<boolean> {
  let before: MorningReportPrefs
  try {
    before = await savePrefs(m, qc, patch)
  } catch (err) {
    fail('No se pudo guardar el ajuste', err)
    return false
  }
  if (undoing) return true
  notifyUndo(
    patch.enabled === false
      ? 'Informe de la mañana desactivado'
      : patch.enabled
        ? `Informe de la mañana cada día a las ${patch.time ?? before.time}`
        : `El informe se hará a las ${patch.time}`,
    {
      icon: 'clock',
      undo: () => changeReportPrefs(m, qc, { enabled: before.enabled, time: before.time }, true),
    },
  )
  return true
}
