import type { Muninn } from '@muninn/core'
import type { Appearance } from '@muninn/ui'
import { type QueryClient, useQuery } from '@tanstack/react-query'
import {
  appearanceStore,
  defaultAppearance,
  saveAppearanceRemote,
  useAppearance,
} from './appearance'
import { fail, notifyUndo } from './feedback'
import {
  DEFAULT_REPORT,
  type MorningReportPrefs,
  reportPrefs,
  savePrefs,
} from './morning-report-prefs'
import { useMuninn } from './muninn'
import { settingsQuery } from './queries'

/**
 * Ajustes con un valor de fábrica claro, para la marca de «cambiado» y «Restablecer» (ADR-0053). Solo preferencias:
 * los módulos, la dirección de Ollama o el modelo son configuración de tu equipo y no se «restablecen».
 */
export type PrefKey = 'glass' | 'accent' | 'reportEnabled' | 'reportTime'

/** Sección de Ajustes de cada preferencia. */
export const PREF_SECTION: Record<PrefKey, 'apariencia' | 'informe'> = {
  glass: 'apariencia',
  accent: 'apariencia',
  reportEnabled: 'informe',
  reportTime: 'informe',
}

/** Qué preferencias no están en su valor de fábrica. */
export function changedPrefs(
  appearance: Appearance,
  report: Pick<MorningReportPrefs, 'enabled' | 'time'>,
  defaults: Appearance = defaultAppearance(),
): PrefKey[] {
  const out: PrefKey[] = []
  if (appearance.glass !== defaults.glass) out.push('glass')
  if (appearance.accent !== defaults.accent) out.push('accent')
  if (report.enabled !== DEFAULT_REPORT.enabled) out.push('reportEnabled')
  if (report.time !== DEFAULT_REPORT.time) out.push('reportTime')
  return out
}

/** Las preferencias cambiadas, agrupadas por sección (`{ apariencia: ['accent'] }`). */
export function bySection(keys: PrefKey[]): Partial<Record<string, PrefKey[]>> {
  const out: Partial<Record<string, PrefKey[]>> = {}
  for (const k of keys) {
    const s = PREF_SECTION[k]
    out[s] = [...(out[s] ?? []), k]
  }
  return out
}

export function useChangedPrefs(): PrefKey[] {
  const m = useMuninn()
  const appearance = useAppearance()
  const report = reportPrefs(useQuery(settingsQuery(m)).data)
  return changedPrefs(appearance, report)
}

/**
 * Devuelve esas preferencias a su valor de fábrica, con un aviso y «Deshacer» (sin diálogo: CLAUDE.md). El informe se
 * guarda en la cola de ajustes, sobre lo último guardado (gotcha «Ajustes en `preferences`»).
 */
export async function resetPrefs(
  m: Muninn,
  qc: QueryClient,
  keys: PrefKey[],
  label: string,
): Promise<void> {
  if (keys.length === 0) return
  const def = defaultAppearance()
  const look: Partial<Appearance> = {}
  if (keys.includes('glass')) look.glass = def.glass
  if (keys.includes('accent')) look.accent = def.accent
  const report: Partial<MorningReportPrefs> = {}
  if (keys.includes('reportEnabled')) report.enabled = DEFAULT_REPORT.enabled
  if (keys.includes('reportTime')) report.time = DEFAULT_REPORT.time

  const prevLook = Object.keys(look).length ? appearanceStore.set((a) => ({ ...a, ...look })) : null
  if (prevLook) saveAppearanceRemote(appearanceStore.get())
  let prevReport: MorningReportPrefs | null = null
  if (Object.keys(report).length) {
    try {
      prevReport = await savePrefs(m, qc, report)
    } catch (err) {
      if (prevLook) {
        appearanceStore.set(prevLook)
        saveAppearanceRemote(prevLook)
      }
      fail('No se pudo restablecer', err)
      return
    }
  }

  notifyUndo(label, {
    icon: 'sync',
    description: 'Vuelven a su valor de fábrica',
    undo: async () => {
      if (prevLook) {
        appearanceStore.set(prevLook)
        saveAppearanceRemote(prevLook)
      }
      if (prevReport) await savePrefs(m, qc, { enabled: prevReport.enabled, time: prevReport.time })
    },
  })
}
