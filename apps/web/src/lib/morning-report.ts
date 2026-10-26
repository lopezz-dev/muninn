import {
  buildMorningReport,
  createOllamaProvider,
  reportIntro,
  reportTitle,
  saveMorningReport,
} from '@muninn/assistant'
import type { ModuleName, Muninn, Note } from '@muninn/core'
import type { QueryClient } from '@tanstack/react-query'
import { assistantPrefs } from './assistant-settings'
import { reportPrefs, savePrefs } from './morning-report-prefs'
import { generateTodayDigest } from './news-digest'

/**
 * Informe de la mañana (ADR-0043): a la hora elegida, el ordenador lo prepara (tareas, cobros y noticias, más una
 * entradilla del modelo si está) y lo guarda como nota fijada. Si a esa hora estaba apagado, se hace al abrir Muninn ese
 * día y lo dice. Nunca recupera días pasados.
 */

let running: Promise<Note | null> | null = null

/**
 * Hace el informe de hoy y lo guarda. Vuelve a leer los ajustes del servidor justo antes (otro ordenador pudo hacerlo).
 * `force`: aunque ya esté hecho hoy o esté desactivado («Hacer ahora»).
 */
export function generateMorningReport(
  m: Muninn,
  qc: QueryClient,
  opts: { modules: ReadonlySet<ModuleName> | null; force?: boolean },
): Promise<Note | null> {
  running ??= (async () => {
    const settings = await m.settings.get()
    const prefs = reportPrefs(settings)
    const today = m.today()
    if (!opts.force && (!prefs.enabled || prefs.lastDate === today)) return null
    const on = (id: ModuleName) => !opts.modules || opts.modules.has(id)
    const assistant = assistantPrefs(settings)

    const digest = on('news')
      ? ((await m.news.digests.get(today)) ??
        (await generateTodayDigest(m, qc, assistant)
          .then((r) => (r.status === 'saved' ? r.digest : null))
          .catch(() => null)))
      : null
    const body = buildMorningReport({
      today,
      overview: on('tasks') ? await m.overview() : null,
      charges: on('finance') ? await m.finance.subscriptions.upcoming({ days: 7 }) : null,
      digest,
      generatedAt: new Date(),
      scheduledTime: prefs.time,
    })
    const provider = createOllamaProvider({ baseUrl: assistant.ollamaUrl, model: assistant.model })
    const intro =
      (await provider.status()).state === 'ready' ? await reportIntro(provider, body) : null
    const note = await saveMorningReport(m, {
      title: reportTitle(today),
      content: intro ? `${intro}\n\n${body}` : body,
      previousNoteId: prefs.lastNoteId,
    })
    await savePrefs(m, qc, { ...prefs, lastDate: today, lastNoteId: note.id })
    void qc.invalidateQueries({ queryKey: ['notes'] })
    return note
  })().finally(() => {
    running = null
  })
  return running
}
