import type { Muninn, UserSettings } from '@muninn/core'
import { notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { fail, serial } from './mutations'
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

export async function savePrefs(m: Muninn, qc: QueryClient, next: MorningReportPrefs) {
  const saved = await serial('settings', () =>
    m.settings.update({ preferences: { morningReport: { ...next } } }),
  )
  qc.setQueryData<UserSettings>(keys.settings, (s) =>
    s ? { ...s, preferences: saved.preferences } : saved,
  )
}

/** Cambia la hora o lo activa/desactiva, con «Deshacer» (ADR-0019). */
export async function changeReportPrefs(
  m: Muninn,
  qc: QueryClient,
  patch: Partial<Pick<MorningReportPrefs, 'enabled' | 'time'>>,
  undoing = false,
) {
  const before = reportPrefs(
    qc.getQueryData<UserSettings>(keys.settings) ?? (await m.settings.get()),
  )
  try {
    await savePrefs(m, qc, { ...before, ...patch })
  } catch (err) {
    return fail('No se pudo guardar el ajuste', err)
  }
  if (undoing) return notify.info('Cambio deshecho')
  notify.success(
    patch.enabled === false
      ? 'Informe de la mañana desactivado'
      : patch.enabled
        ? `Informe de la mañana cada día a las ${patch.time ?? before.time}`
        : `El informe se hará a las ${patch.time}`,
    {
      icon: 'clock',
      action: {
        label: 'Deshacer',
        onClick: () =>
          void changeReportPrefs(m, qc, { enabled: before.enabled, time: before.time }, true),
      },
    },
  )
}
