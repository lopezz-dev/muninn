import type { Muninn, NewsItem, NewsSource } from '@muninn/core'
import { notify } from '@muninn/ui'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { currentLocale, t } from '../i18n'
import { fail, notifyUndo } from './feedback'
import { isBusy, serial } from './mutations'
import { matchesAll, words } from './text'

/**
 * Noticias (ADR-0042): consultas bajo `['news', …]` (el tiempo real refresca ese prefijo entero) y acciones con
 * feedback y «Deshacer» (ADR-0019) por una sola cola (`serial('news')`). Nada se borra: las fuentes se archivan.
 */

export const NEWS_QUEUE = 'news'

export const newsKeys = {
  all: ['news'] as const,
  sources: ['news', 'sources'] as const,
  items: ['news', 'items'] as const,
  digest: (date: string) => ['news', 'digest', date] as const,
}

export const newsSourcesQuery = (m: Muninn) =>
  queryOptions({ queryKey: newsKeys.sources, queryFn: () => m.news.sources.list() })

/** Los últimos 200 artículos: la pantalla filtra por tema, búsqueda y guardadas en el navegador. */
export const newsItemsQuery = (m: Muninn) =>
  queryOptions({ queryKey: newsKeys.items, queryFn: () => m.news.items.list({ limit: 200 }) })

export const newsDigestQuery = (m: Muninn, date: string) =>
  queryOptions({ queryKey: newsKeys.digest(date), queryFn: () => m.news.digests.get(date) })

/** Fecha por la que se ordena y se cuenta un artículo. */
export const itemDate = (i: Pick<NewsItem, 'publishedAt' | 'fetchedAt'>) =>
  i.publishedAt ?? i.fetchedAt

export interface NewsFilter {
  /** `null`: todas; `'__saved'`: las guardadas; si no, un tema. */
  tab: string | null
  /** Solo los de una fuente (al pulsar su nombre en un artículo); `null` o sin poner: todas. */
  source?: string | null
  search: string
}

export const SAVED_TAB = '__saved'

/** Los artículos que se ven con ese filtro (por tema de su fuente, guardadas y texto). */
export function filterNews(items: NewsItem[], sources: NewsSource[], f: NewsFilter): NewsItem[] {
  const topic = new Map(sources.map((s) => [s.id, s.topic]))
  const terms = words(f.search)
  return items.filter(
    (i) =>
      (f.tab === null ||
        (f.tab === SAVED_TAB ? Boolean(i.savedAt) : topic.get(i.sourceId) === f.tab)) &&
      (!f.source || i.sourceId === f.source) &&
      matchesAll(`${i.title}\n${i.summary}`, terms),
  )
}

/** Artículos seguidos de una misma fuente que se ven antes de plegar el resto de la racha. */
export const NEWS_RUN_KEEP = 3

export type NewsRow =
  | { kind: 'item'; item: NewsItem }
  /** Lo plegado de una racha; `key` (el id de su primer artículo) es lo que se guarda al desplegarla. */
  | { kind: 'more'; key: string; sourceId: string; items: NewsItem[] }

/**
 * Pliega las rachas de una misma fuente (ADR-0069): de cada tramo seguido de la misma fuente se ven `keep` y el resto
 * queda tras «Ver N más de …», en su sitio, para que las demás fuentes asomen sin perder el orden por fecha. Una racha
 * que solo esconde un artículo no se pliega. `open` son las rachas ya desplegadas.
 */
export function collapseRuns(
  items: NewsItem[],
  open: ReadonlySet<string> = new Set(),
  keep = NEWS_RUN_KEEP,
): NewsRow[] {
  const rows: NewsRow[] = []
  for (let i = 0; i < items.length; ) {
    let j = i + 1
    while (j < items.length && items[j]?.sourceId === items[i]?.sourceId) j++
    const run = items.slice(i, j)
    const key = run[0]?.id ?? ''
    const fold = run.length > keep + 1 && !open.has(key)
    for (const item of fold ? run.slice(0, keep) : run) rows.push({ kind: 'item', item })
    if (fold)
      rows.push({ kind: 'more', key, sourceId: run[0]?.sourceId ?? '', items: run.slice(keep) })
    i = j
  }
  return rows
}

/** Pestañas de temas: los de las fuentes activas, con cuántos artículos tiene cada uno. */
export function topicTabs(items: NewsItem[], sources: NewsSource[]) {
  const counts = new Map<string, number>()
  const topic = new Map(sources.map((s) => [s.id, s.topic]))
  for (const i of items) {
    const t = topic.get(i.sourceId)
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => a[0].localeCompare(b[0], currentLocale()))
}

/** Cuántas han llegado en las últimas 24 horas (el «6 nuevas desde ayer» del diseño). */
export const newSince = (items: NewsItem[], now = Date.now()) =>
  items.filter((i) => new Date(itemDate(i)).getTime() >= now - 86_400_000).length

const run = <T>(fn: () => Promise<T>) => serial(NEWS_QUEUE, fn)

export function settleNews(qc: QueryClient) {
  if (isBusy(NEWS_QUEUE)) return
  void qc.invalidateQueries({ queryKey: newsKeys.all })
}

export async function addSource(
  m: Muninn,
  qc: QueryClient,
  input: { url: string; title?: string; topic?: string | null },
): Promise<NewsSource | null> {
  let source: NewsSource
  try {
    source = await run(() => m.news.sources.create(input))
  } catch (err) {
    fail(t('actions.addFailed', { ns: 'news' }), err)
    return null
  } finally {
    settleNews(qc)
  }
  notifyUndo(t('actions.added', { ns: 'news', title: source.title }), {
    icon: 'news',
    description: t('actions.addedHint', { ns: 'news' }),
    undo: () => archiveSource(m, qc, source, { undoing: true }),
    undone: t('actions.addUndone', { ns: 'news' }),
  })
  return source
}

export async function setSourceEnabled(
  m: Muninn,
  qc: QueryClient,
  source: NewsSource,
  enabled: boolean,
  undoing = false,
): Promise<boolean> {
  qc.setQueryData<NewsSource[]>(newsKeys.sources, (list) =>
    list?.map((s) => (s.id === source.id ? { ...s, enabled } : s)),
  )
  try {
    await run(() => m.news.sources.update(source.id, { enabled }))
  } catch (err) {
    fail(t('actions.toggleFailed', { ns: 'news' }), err)
    settleNews(qc)
    return false
  }
  settleNews(qc)
  if (undoing) return true
  const title = (on: boolean) =>
    t(on ? 'actions.enabled' : 'actions.paused', { ns: 'news', title: source.title })
  notifyUndo(title(enabled), {
    icon: 'news',
    undo: () => setSourceEnabled(m, qc, { ...source, enabled }, !enabled, true),
    undone: title(!enabled),
  })
  return true
}

export async function archiveSource(
  m: Muninn,
  qc: QueryClient,
  source: NewsSource,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  qc.setQueryData<NewsSource[]>(newsKeys.sources, (list) => list?.filter((s) => s.id !== source.id))
  try {
    await run(() => m.news.sources.archive(source.id))
  } catch (err) {
    fail(t('actions.archiveFailed', { ns: 'news' }), err)
    settleNews(qc)
    return false
  }
  settleNews(qc)
  if (opts.undoing) return true
  notifyUndo(t('actions.archived', { ns: 'news', title: source.title }), {
    icon: 'archive',
    description: t('actions.archivedHint', { ns: 'news' }),
    undo: () => run(() => m.news.sources.restore(source.id)).finally(() => settleNews(qc)),
    undone: t('actions.archiveUndone', { ns: 'news' }),
    failTitle: t('actions.restoreFailed', { ns: 'news' }),
  })
  return true
}

export async function setSaved(
  m: Muninn,
  qc: QueryClient,
  item: NewsItem,
  saved: boolean,
  undoing = false,
): Promise<boolean> {
  const savedAt = saved ? new Date().toISOString() : null
  qc.setQueryData<NewsItem[]>(newsKeys.items, (list) =>
    list?.map((i) => (i.id === item.id ? { ...i, savedAt } : i)),
  )
  try {
    await run(() => m.news.items.setSaved(item.id, saved))
  } catch (err) {
    fail(t('actions.saveFailed', { ns: 'news' }), err)
    settleNews(qc)
    return false
  }
  settleNews(qc)
  if (undoing) return true
  notifyUndo(t(saved ? 'actions.saved' : 'actions.unsaved', { ns: 'news' }), {
    icon: 'pin',
    undo: () => setSaved(m, qc, item, !saved, true),
  })
  return true
}

/** Al abrir un artículo: leído, sin aviso (es navegar, no cambiar nada que haya que deshacer). */
export function markRead(m: Muninn, qc: QueryClient, item: NewsItem) {
  if (item.readAt) return
  qc.setQueryData<NewsItem[]>(newsKeys.items, (list) =>
    list?.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)),
  )
  void run(() => m.news.items.markRead(item.id)).catch(() => {})
}

/**
 * «Actualizar»: la descarga la hace la Edge Function `news`. Sin ella (demo) o si no responde (aún sin desplegar, o sin
 * red) se dice en palabras; cualquier otro fallo, como un error.
 */
export async function refreshNews(m: Muninn, qc: QueryClient) {
  const id = notify.loading(t('actions.fetching', { ns: 'news' }), { icon: 'sync' })
  try {
    const r = await m.news.fetchNow()
    notify.dismiss(id)
    notify.success(
      r.added
        ? t('actions.newArticles', { ns: 'news', count: r.added })
        : t('actions.nothingNew', { ns: 'news' }),
      {
        icon: 'news',
        description: r.errors.length
          ? t('actions.sourcesFailed', { ns: 'news', count: r.errors.length })
          : undefined,
      },
    )
  } catch (err) {
    notify.dismiss(id)
    if (err instanceof Error && err.name === 'ValidationError') {
      notify.error(t('actions.notHereYet', { ns: 'news' }), {
        description: t('actions.demoNoFeeds', { ns: 'news' }),
      })
    } else if (err instanceof Error && err.name === 'FunctionsFetchError' && navigator.onLine) {
      notify.error(t('actions.notHereYet', { ns: 'news' }), {
        description: t('actions.serverDown', { ns: 'news' }),
      })
    } else {
      fail(t('actions.fetchFailed', { ns: 'news' }), err)
    }
  } finally {
    settleNews(qc)
  }
}

/**
 * Texto de la nota que se crea desde un artículo: resumen y enlace. Se guarda en la nota: sin traducir hasta la fase 5
 * del ADR-0077 (textos guardados).
 */
export const noteFromItem = (item: NewsItem, sourceTitle: string | undefined) =>
  `${item.summary ? `${item.summary}\n\n` : ''}[Leer en ${sourceTitle ?? 'la fuente'}](${item.url})`
