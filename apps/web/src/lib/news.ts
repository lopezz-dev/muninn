import type { Muninn, NewsItem, NewsSource } from '@muninn/core'
import { notify } from '@muninn/ui'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { fail, notifyUndo } from './feedback'
import { isBusy, serial } from './mutations'
import { normalize as fold } from './text'

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
  const needle = fold(f.search.trim())
  return items.filter(
    (i) =>
      (f.tab === null ||
        (f.tab === SAVED_TAB ? Boolean(i.savedAt) : topic.get(i.sourceId) === f.tab)) &&
      (!f.source || i.sourceId === f.source) &&
      (!needle || fold(`${i.title} ${i.summary}`).includes(needle)),
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
  return [...counts].sort((a, b) => a[0].localeCompare(b[0], 'es'))
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
    fail('No se pudo añadir la fuente', err)
    return null
  } finally {
    settleNews(qc)
  }
  notifyUndo(`Fuente «${source.title}» añadida`, {
    icon: 'news',
    description: 'Sus artículos llegan en la próxima descarga',
    undo: () => archiveSource(m, qc, source, { undoing: true }),
    undone: 'Fuente quitada',
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
    fail('No se pudo cambiar la fuente', err)
    settleNews(qc)
    return false
  }
  settleNews(qc)
  if (undoing) return true
  const title = (on: boolean) => (on ? `«${source.title}» activada` : `«${source.title}» en pausa`)
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
    fail('No se pudo quitar la fuente', err)
    settleNews(qc)
    return false
  }
  settleNews(qc)
  if (opts.undoing) return true
  notifyUndo(`«${source.title}» quitada`, {
    icon: 'archive',
    description: 'Sus artículos guardados se conservan',
    undo: () => run(() => m.news.sources.restore(source.id)).finally(() => settleNews(qc)),
    undone: 'Fuente recuperada',
    failTitle: 'No se pudo recuperar',
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
    fail('No se pudo guardar', err)
    settleNews(qc)
    return false
  }
  settleNews(qc)
  if (undoing) return true
  notifyUndo(saved ? 'Guardada para leer luego' : 'Ya no está guardada', {
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
  const id = notify.loading('Buscando noticias…', { icon: 'sync' })
  try {
    const r = await m.news.fetchNow()
    notify.dismiss(id)
    notify.success(
      r.added
        ? `${r.added} ${r.added === 1 ? 'artículo nuevo' : 'artículos nuevos'}`
        : 'No hay nada nuevo',
      {
        icon: 'news',
        description: r.errors.length
          ? `${r.errors.length} ${r.errors.length === 1 ? 'fuente no respondió' : 'fuentes no respondieron'}`
          : undefined,
      },
    )
  } catch (err) {
    notify.dismiss(id)
    if (err instanceof Error && err.name === 'ValidationError') {
      notify.error('Las noticias aún no se descargan desde aquí', {
        description: 'En la demo no se descargan feeds.',
      })
    } else if (err instanceof Error && err.name === 'FunctionsFetchError' && navigator.onLine) {
      notify.error('Las noticias aún no se descargan desde aquí', {
        description:
          'El servidor de Muninn no responde: la descarga aún no está en marcha (fase final).',
      })
    } else {
      fail('No se pudieron buscar noticias', err)
    }
  } finally {
    settleNews(qc)
  }
}

/** Texto de la nota que se crea desde un artículo: resumen y enlace. */
export const noteFromItem = (item: NewsItem, sourceTitle: string | undefined) =>
  `${item.summary ? `${item.summary}\n\n` : ''}[Leer en ${sourceTitle ?? 'la fuente'}](${item.url})`
