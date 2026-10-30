import { createOllamaProvider, generateDigest } from '@muninn/assistant'
import type { Muninn, NewsDigest } from '@muninn/core'
import { notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import type { AssistantPrefs } from './assistant-settings'
import { isHandheld } from './assistant-status'
import { notifyUndo } from './feedback'
import { reason } from './mutations'
import { itemDate, newsKeys, settleNews } from './news'

/** Artículos de las últimas cuántas horas entran en el resumen del día. */
export const DIGEST_WINDOW_HOURS = 30

export type DigestOutcome =
  | { status: 'saved'; digest: NewsDigest }
  | { status: 'empty' }
  | { status: 'no-model'; detail: string }

/** Una generación a la vez por pestaña (la pantalla y el informe de la mañana pueden pedirla a la vez). */
let running: Promise<DigestOutcome> | null = null

/**
 * Genera el resumen de hoy con el modelo local (ADR-0042) y lo guarda en la cuenta (`news_digests`), así se lee desde
 * cualquier dispositivo. Solo en el ordenador con Ollama: en el móvil o sin modelo devuelve `no-model` sin intentarlo.
 */
export function generateTodayDigest(
  m: Muninn,
  qc: QueryClient,
  prefs: AssistantPrefs,
): Promise<DigestOutcome> {
  running ??= (async (): Promise<DigestOutcome> => {
    if (isHandheld()) return { status: 'no-model', detail: 'En este dispositivo no hay modelo' }
    const provider = createOllamaProvider({ baseUrl: prefs.ollamaUrl, model: prefs.model })
    const status = await provider.status()
    if (status.state !== 'ready') {
      return {
        status: 'no-model',
        detail:
          status.state === 'offline' ? 'Ollama no responde' : `Falta el modelo ${prefs.model}`,
      }
    }
    const since = Date.now() - DIGEST_WINDOW_HOURS * 3_600_000
    const [items, sources, projects] = await Promise.all([
      m.news.items.list({ limit: 200 }),
      m.news.sources.list(),
      m.projects.list(),
    ])
    const recent = items.filter((i) => new Date(itemDate(i)).getTime() >= since)
    const out = await generateDigest({
      provider,
      items: recent,
      sources,
      projects,
      today: m.today(),
    })
    if (!out) return { status: 'empty' }
    const digest = await m.news.digests.save({
      date: m.today(),
      content: out.content,
      model: prefs.model,
      itemIds: out.itemIds,
    })
    qc.setQueryData(newsKeys.digest(digest.date), digest)
    settleNews(qc)
    return { status: 'saved', digest }
  })().finally(() => {
    running = null
  })
  return running
}

/** «Generar resumen» (o «Rehacer»): con feedback y, si había uno antes, «Deshacer» que lo devuelve. */
export async function generateDigestNow(m: Muninn, qc: QueryClient, prefs: AssistantPrefs) {
  const before = await m.news.digests.get().catch(() => null)
  const id = notify.loading('Resumiendo tus noticias…', { icon: 'assistant' })
  try {
    const r = await generateTodayDigest(m, qc, prefs)
    notify.dismiss(id)
    if (r.status === 'empty') return notify.info('No hay noticias de hoy que resumir')
    if (r.status === 'no-model') {
      return notify.error('No se pudo resumir', {
        description: `${r.detail}. El resumen se hace con el modelo de tu ordenador.`,
      })
    }
    notifyUndo('Resumen del día listo', {
      icon: 'assistant',
      // Si es el primero de hoy, no hay a qué volver.
      undo: before
        ? async () => {
            const back = await m.news.digests.save({
              date: before.date,
              content: before.content,
              model: before.model,
              itemIds: before.itemIds,
            })
            qc.setQueryData(newsKeys.digest(back.date), back)
          }
        : null,
      undone: 'Vuelve el resumen anterior',
      failTitle: 'No se pudo recuperar el resumen anterior',
    })
  } catch (err) {
    notify.dismiss(id)
    notify.error('No se pudo resumir', { description: reason(err) })
  }
}
