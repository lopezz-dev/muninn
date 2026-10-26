import type { z } from 'zod'
import { ValidationError } from './errors'
import { assertPublicUrl, type FetchFeedOptions, fetchFeed, type ParsedFeed } from './news-feed'
import {
  type Activity,
  type CreateNewsSourceInput,
  createNewsSourceInput,
  type NewsItem,
  type NewsQuery,
  type NewsSource,
  newsQuery,
  type Project,
  type SaveDigestInput,
  saveDigestInput,
  type UpdateNewsSourceInput,
  updateNewsSourceInput,
} from './schemas'
import { type NewsFetchSummary, NotFoundError, type Store } from './store'

export interface NewsContext {
  store: Store
  nowIso: () => string
  today: () => string
  parse: <S extends z.ZodType>(schema: S, value: unknown) => z.output<S>
  log: (
    entityType: Activity['entityType'],
    entityId: string,
    action: string,
    projectId: string | null,
    payload?: Record<string, unknown>,
  ) => Promise<Activity>
}

/** El título por defecto de una fuente: su dominio, sin `www.` (se cambia por el del feed en la primera descarga). */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.slice(0, 120)
  }
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Proyectos con los que tiene que ver un artículo: su nombre (de 3 letras o más) aparece en el título o el resumen,
 * como palabra. Sin modelo: es lo que pinta «Relacionada con HuginnDB» en la pantalla.
 */
export function relatedProjects<P extends Pick<Project, 'id' | 'name'>>(
  item: Pick<NewsItem, 'title' | 'summary'>,
  projects: P[],
): P[] {
  const text = ` ${norm(`${item.title} ${item.summary}`)} `
  return projects.filter((p) => {
    const name = norm(p.name).trim()
    if (name.length < 3) return false
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`[^\\p{L}\\p{N}]${escaped}[^\\p{L}\\p{N}]`, 'u').test(text)
  })
}

/** Noticias (ADR-0042): fuentes del usuario, artículos descargados por la Edge Function y el resumen diario. */
export function createNews({ store, nowIso, today, parse, log }: NewsContext) {
  const getSource = async (id: string) => {
    const s = await store.newsSources.get(id)
    if (!s) throw new NotFoundError('Fuente', id)
    return s
  }

  async function listSources(opts: { includeArchived?: boolean } = {}) {
    return store.newsSources.list(opts)
  }

  /** Añade una fuente. Si ya estaba (aunque archivada), la recupera en vez de duplicarla. */
  async function createSource(input: CreateNewsSourceInput) {
    const data = parse(createNewsSourceInput, input)
    // Antes de guardarla: solo direcciones públicas (la Edge Function la descargará, ADR-0042).
    await assertPublicUrl(data.url).catch((err: Error) => {
      throw new ValidationError(err.message)
    })
    const existing = (await store.newsSources.list({ includeArchived: true })).find(
      (s) => s.url === data.url,
    )
    if (existing) {
      if (!existing.archivedAt) throw new ValidationError('Ya tienes esa fuente')
      const restored = await store.newsSources.update(existing.id, {
        archivedAt: null,
        enabled: true,
        ...(data.title ? { title: data.title } : {}),
        ...(data.topic !== undefined ? { topic: data.topic } : {}),
      })
      await log('news_source', existing.id, 'restored', null, { title: restored.title })
      return restored
    }
    const source = await store.newsSources.insert({
      url: data.url,
      title: data.title ?? hostOf(data.url),
      siteUrl: null,
      topic: data.topic ?? null,
      enabled: true,
      etag: null,
      lastModified: null,
      lastFetchedAt: null,
      lastError: null,
      archivedAt: null,
    })
    await log('news_source', source.id, 'created', null, { title: source.title, url: source.url })
    return source
  }

  async function updateSource(id: string, input: UpdateNewsSourceInput) {
    const patch = parse(updateNewsSourceInput, input)
    await getSource(id)
    const source = await store.newsSources.update(id, patch)
    await log('news_source', id, 'updated', null, patch)
    return source
  }

  async function archiveSource(id: string) {
    const s = await getSource(id)
    const archived = await store.newsSources.update(id, { archivedAt: nowIso() })
    await log('news_source', id, 'archived', null, { title: s.title })
    return archived
  }

  async function restoreSource(id: string) {
    const s = await getSource(id)
    const restored = await store.newsSources.update(id, { archivedAt: null })
    await log('news_source', id, 'restored', null, { title: s.title })
    return restored
  }

  /** Artículos de las fuentes no archivadas (o de una), del más reciente al más antiguo. */
  async function listItems(query: NewsQuery = {}) {
    const q = parse(newsQuery, query)
    const sources = await store.newsSources.list({})
    const allowed = sources.filter(
      (s) =>
        (!q.sourceId || s.id === q.sourceId) &&
        (!q.topic || (s.topic ?? '').toLowerCase() === q.topic.toLowerCase()),
    )
    if (!allowed.length) return []
    return store.newsItems.list({
      sourceIds: allowed.map((s) => s.id),
      saved: q.saved,
      unread: q.unread,
      since: q.since,
      search: q.search,
      limit: q.limit ?? 100,
    })
  }

  const getItem = async (id: string) => {
    const i = await store.newsItems.get(id)
    if (!i) throw new NotFoundError('Artículo', id)
    return i
  }

  /**
   * Guarda los artículos nuevos de una descarga y apunta cómo fue (ETag, fecha, error). Los repetidos (misma fuente y
   * `guid`) no se duplican. Lo usa la Edge Function `news`; no deja actividad (sería ruido cada hora).
   */
  async function ingest(
    sourceId: string,
    result:
      | { feed: ParsedFeed; etag: string | null; lastModified: string | null }
      | { notModified: true }
      | { error: string },
  ) {
    const source = await getSource(sourceId)
    const fetchedAt = nowIso()
    if ('error' in result) {
      await store.newsSources.update(sourceId, {
        lastError: result.error.slice(0, 500),
        lastFetchedAt: fetchedAt,
      })
      return { added: [] as NewsItem[] }
    }
    if ('notModified' in result) {
      await store.newsSources.update(sourceId, { lastError: null, lastFetchedAt: fetchedAt })
      return { added: [] as NewsItem[] }
    }
    const added = await store.newsItems.insertNew(
      result.feed.items.map((i) => ({
        sourceId,
        guid: i.guid,
        url: i.url,
        title: i.title,
        summary: i.summary,
        author: i.author,
        publishedAt: i.publishedAt,
        fetchedAt,
        readAt: null,
        savedAt: null,
      })),
    )
    // El título del feed sustituye al dominio que se puso al añadirla, no a uno que haya escrito el usuario.
    const title =
      source.title === hostOf(source.url) && result.feed.title
        ? result.feed.title.slice(0, 120)
        : undefined
    await store.newsSources.update(sourceId, {
      etag: result.etag,
      lastModified: result.lastModified,
      lastFetchedAt: fetchedAt,
      lastError: null,
      ...(title ? { title } : {}),
      ...(result.feed.siteUrl && !source.siteUrl ? { siteUrl: result.feed.siteUrl } : {}),
    })
    return { added }
  }

  /**
   * Descarga ahora las fuentes activas de este usuario, una a una (pocas fuentes; así un feed lento no tumba a los demás).
   * La llama la Edge Function `news`: desde el navegador, la mayoría de los feeds no se dejan leer (CORS).
   */
  async function refresh(
    fetchFn: typeof fetch,
    options: FetchFeedOptions,
  ): Promise<NewsFetchSummary> {
    const sources = (await store.newsSources.list({})).filter((s) => s.enabled)
    const summary: NewsFetchSummary = {
      sources: sources.length,
      added: 0,
      notModified: 0,
      errors: [],
    }
    for (const s of sources) {
      try {
        const r = await fetchFeed(s, fetchFn, options)
        if (r.status === 'not-modified') {
          summary.notModified++
          await ingest(s.id, { notModified: true })
        } else {
          summary.added += (await ingest(s.id, r)).added.length
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        summary.errors.push({ sourceId: s.id, error })
        await ingest(s.id, { error })
      }
    }
    return summary
  }

  /** Pide la descarga a quien sepa hacerla (la Edge Function); si este store no puede, lo dice. */
  async function fetchNow() {
    if (!store.newsFeeds) {
      throw new ValidationError(
        'Aquí no se pueden descargar las noticias: lo hace el servidor de Muninn',
      )
    }
    return store.newsFeeds.fetchNow()
  }

  async function saveDigest(input: SaveDigestInput) {
    const data = parse(saveDigestInput, input)
    const digest = await store.newsDigests.upsert({
      date: data.date,
      content: data.content,
      model: data.model ?? null,
      itemIds: data.itemIds ?? [],
    })
    await log('news_digest', digest.id, 'created', null, { date: digest.date, model: digest.model })
    return digest
  }

  return {
    sources: {
      list: listSources,
      get: getSource,
      create: createSource,
      update: updateSource,
      archive: archiveSource,
      restore: restoreSource,
    },
    items: {
      list: listItems,
      get: getItem,
      markRead: async (id: string) => {
        const i = await getItem(id)
        return i.readAt ? i : store.newsItems.update(id, { readAt: nowIso() })
      },
      /** Guardar (o dejar de guardar): lo guardado no caduca. */
      setSaved: async (id: string, saved: boolean) => {
        await getItem(id)
        return store.newsItems.update(id, { savedAt: saved ? nowIso() : null })
      },
    },
    digests: {
      /** El de hoy (fecha local), o el de la fecha dada. */
      get: (date?: string) => store.newsDigests.get(date ?? today()),
      latest: () => store.newsDigests.latest(),
      save: saveDigest,
    },
    /** Proyectos con los que tiene que ver un artículo (la UI no importa valores del core: lo usa desde aquí). */
    related: relatedProjects,
    ingest,
    refresh,
    fetchNow,
  }
}

export type News = ReturnType<typeof createNews>
export type { NewsSource }
