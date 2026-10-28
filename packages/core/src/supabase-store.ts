import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Activity,
  GithubRepoSummary,
  GithubSyncScope,
  NewsDigest,
  NewsItem,
  NewsSource,
  UserSettings,
} from './schemas'
import { imageExt } from './schemas'
import {
  type AccountStoreQuery,
  type ActivityLog,
  type CategoryStoreQuery,
  type Collection,
  type GithubOutbox,
  type NewRow,
  type NewsDigestStore,
  type NewsFetchSummary,
  type NewsItemStore,
  type NewsItemStoreQuery,
  type NoteStoreQuery,
  NotFoundError,
  type OutboxEntry,
  type ProjectStoreQuery,
  type SettingsStore,
  type Store,
  type TaskStoreQuery,
  type TransactionStoreQuery,
} from './store'

// biome-ignore lint/suspicious/noExplicitAny: cliente genérico sin tipos generados; validamos en el servicio.
type Client = SupabaseClient<any, any, any>
// biome-ignore lint/suspicious/noExplicitAny: builder de PostgREST sin tipos generados.
type Builder = any
type Row = Record<string, unknown>

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

function toRow(obj: object): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[toSnake(k)] = v
  return out
}

function fromRow<T>(row: Row): T {
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) if (k !== 'owner_id') out[toCamel(k)] = v
  return out as T
}

/** Un valor literal para `ilike`: `_` y `%` no hacen de comodín (`mi_repo` no casa con `miXrepo`). */
export const ilikeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Quita los caracteres con significado en los filtros `or()` de PostgREST y en LIKE. */
const likeTerm = (s: string) => `%${s.replace(/[,()*"\\%_]/g, ' ').trim()}%`

/** Bucket de Storage de las imágenes de proyecto (migración 20261028120000_project_images). */
const PROJECT_IMAGES_BUCKET = 'project-images'

/** Filas por petición: el `max-rows` por defecto de PostgREST en Supabase. */
const PAGE = 1000

class SupabaseCollection<T extends { id: string }, Q> implements Collection<T, Q> {
  constructor(
    private readonly client: Client,
    private readonly ownerId: string,
    private readonly table: string,
    private readonly entity: string,
    private readonly applyQuery: (qb: Builder, query: Q) => Builder,
    /** Sin `limit` en la consulta, pide todas las filas por páginas (PostgREST corta en `PAGE`). */
    private readonly paged = false,
  ) {}

  private from() {
    return this.client.from(this.table)
  }

  async get(id: string) {
    const { data, error } = await this.from()
      .select('*')
      .eq('owner_id', this.ownerId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? fromRow<T>(data) : null
  }

  async list(query: Q) {
    const select = () =>
      this.applyQuery(this.from().select('*').eq('owner_id', this.ownerId), query)
    if (!this.paged || (query as { limit?: number }).limit) {
      const { data, error } = await select()
      if (error) throw error
      return (data as Row[]).map((r) => fromRow<T>(r))
    }
    const rows: Row[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await select().range(from, from + PAGE - 1)
      if (error) throw error
      rows.push(...(data as Row[]))
      if ((data as Row[]).length < PAGE) break
    }
    return rows.map((r) => fromRow<T>(r))
  }

  async insert(row: NewRow<T>) {
    const { data, error } = await this.from()
      .insert({ ...toRow(row), owner_id: this.ownerId })
      .select('*')
      .single()
    if (error) throw error
    return fromRow<T>(data)
  }

  async update(id: string, patch: Partial<NewRow<T>>) {
    const { data, error } = await this.from()
      .update(toRow(patch))
      .eq('owner_id', this.ownerId)
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundError(this.entity, id)
    return fromRow<T>(data)
  }

  async remove(id: string) {
    const { error } = await this.from().delete().eq('owner_id', this.ownerId).eq('id', id)
    if (error) throw error
  }
}

/**
 * Store sobre Supabase. Funciona igual con el cliente del usuario (RLS) que con la service key
 * (MCP/servidor): siempre filtra y escribe con `ownerId` explícito.
 */
export function createSupabaseStore(client: Client, ownerId: string): Store {
  const col = <T extends { id: string }, Q>(
    table: string,
    entity: string,
    apply: (qb: Builder, q: Q) => Builder,
    paged = false,
  ) => new SupabaseCollection<T, Q>(client, ownerId, table, entity, apply, paged)

  const activity: ActivityLog = {
    async insert(row) {
      const { data, error } = await client
        .from('activity')
        .insert({ ...toRow(row), owner_id: ownerId })
        .select('*')
        .single()
      if (error) throw error
      return fromRow<Activity>(data)
    },
    async list({ projectId, entityId, actions, since, limit = 50 }) {
      let qb = client.from('activity').select('*').eq('owner_id', ownerId)
      if (projectId) qb = qb.eq('project_id', projectId)
      if (entityId) qb = qb.eq('entity_id', entityId)
      if (actions) qb = qb.in('action', actions)
      if (since) qb = qb.gte('created_at', since)
      const { data, error } = await qb.order('id', { ascending: false }).limit(limit)
      if (error) throw error
      return (data as Row[]).map((r) => fromRow<Activity>(r))
    },
  }

  const settings: SettingsStore = {
    async get() {
      const { data, error } = await client
        .from('user_settings')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle()
      if (error) throw error
      return data ? fromRow<UserSettings>(data) : null
    },
    async upsert(patch) {
      // Solo las columnas presentes: en una fila nueva, las demás toman el default de la tabla.
      const { data, error } = await client
        .from('user_settings')
        .upsert({ ...toRow(patch), owner_id: ownerId }, { onConflict: 'owner_id' })
        .select('*')
        .single()
      if (error) throw error
      return fromRow<UserSettings>(data)
    },
  }

  // Tabla `github_outbox` (migraciones 20261020000000_github_outbox y 20261020133907_agent_column).
  // Solo la usan las tareas de GitHub.
  const githubOutbox: GithubOutbox = {
    async enqueue(taskId, kind) {
      const { error } = await client
        .from('github_outbox')
        .insert({ task_id: taskId, owner_id: ownerId, kind })
      if (error) throw error
    },
    async pending({ maxAttempts, limit = 100, taskId, kind }) {
      let qb = client
        .from('github_outbox')
        .select('id, task_id, kind, attempts, last_error, created_at')
        .eq('owner_id', ownerId)
        .is('processed_at', null)
        .lt('attempts', maxAttempts)
      if (taskId) qb = qb.eq('task_id', taskId)
      if (kind) qb = qb.eq('kind', kind)
      const { data, error } = await qb.order('id').limit(limit)
      if (error) throw error
      return (data as Row[]).map((r) => fromRow<OutboxEntry>(r))
    },
    async settle(entries, failure) {
      if (entries.length === 0) return
      const table = () => client.from('github_outbox')
      if (failure === undefined) {
        const { error } = await table()
          .update({ processed_at: new Date().toISOString() })
          .eq('owner_id', ownerId)
          .in(
            'id',
            entries.map((e) => e.id),
          )
        if (error) throw error
        return
      }
      // PostgREST no sabe sumar: cada entrada con su contador (son pocas).
      for (const e of entries) {
        const { error } = await table()
          .update({ attempts: e.attempts + 1, last_error: failure.slice(0, 1000) })
          .eq('owner_id', ownerId)
          .eq('id', e.id)
        if (error) throw error
      }
    },
  }

  // Los responde la Edge Function `github` (GET /github/repos), que es quien tiene el token (ADR-0035).
  // `invoke` manda la sesión del cliente: con la del usuario, la función comprueba que es el dueño.
  const githubRepos = {
    async list() {
      const { data, error } = await client.functions.invoke('github/repos', { method: 'GET' })
      if (error) throw error
      return (data as { repos: GithubRepoSummary[] }).repos
    },
    async canWrite(repo: string) {
      const { data, error } = await client.functions.invoke(
        `github/access?repo=${encodeURIComponent(repo)}`,
        { method: 'GET' },
      )
      if (error) throw error
      return (data as { writable: boolean }).writable
    },
    async sync(scope: GithubSyncScope) {
      const { data, error } = await client.functions.invoke('github/sync', {
        method: 'POST',
        body: { scope },
      })
      if (error) throw error
      return data as unknown
    },
  }

  // Noticias (ADR-0042, migración 20261022140000_news).
  const items = col<NewsItem, NewsItemStoreQuery>('news_items', 'Artículo', (qb, q) => {
    if (q.sourceIds) qb = qb.in('source_id', q.sourceIds)
    if (q.saved !== undefined)
      qb = q.saved ? qb.not('saved_at', 'is', null) : qb.is('saved_at', null)
    if (q.unread) qb = qb.is('read_at', null)
    // PostgREST no ordena por expresión: sin fecha de publicación cuenta la de descarga (casi la misma).
    if (q.since)
      qb = qb.or(`published_at.gte.${q.since},and(published_at.is.null,fetched_at.gte.${q.since})`)
    if (q.search) {
      const term = likeTerm(q.search)
      qb = qb.or(`title.ilike.${term},summary.ilike.${term}`)
    }
    qb = qb
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('fetched_at', { ascending: false })
    return qb.limit(q.limit ?? 200)
  })
  const newsItems: NewsItemStore = {
    get: (id) => items.get(id),
    list: (q) => items.list(q),
    update: (id, patch) => items.update(id, patch),
    remove: (id) => items.remove(id),
    async insertNew(rows) {
      if (!rows.length) return []
      // `ignoreDuplicates`: los que ya están (misma fuente y guid) no se tocan ni se devuelven.
      const { data, error } = await client
        .from('news_items')
        .upsert(
          rows.map((r) => ({ ...toRow(r), owner_id: ownerId })),
          { onConflict: 'source_id,guid', ignoreDuplicates: true },
        )
        .select('*')
      if (error) throw error
      return (data as Row[]).map((r) => fromRow<NewsItem>(r))
    },
  }
  const newsDigests: NewsDigestStore = {
    async get(date) {
      const { data, error } = await client
        .from('news_digests')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('date', date)
        .maybeSingle()
      if (error) throw error
      return data ? fromRow<NewsDigest>(data) : null
    },
    async latest() {
      const { data, error } = await client
        .from('news_digests')
        .select('*')
        .eq('owner_id', ownerId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data ? fromRow<NewsDigest>(data) : null
    },
    async upsert(row) {
      const { data, error } = await client
        .from('news_digests')
        .upsert({ ...toRow(row), owner_id: ownerId }, { onConflict: 'owner_id,date' })
        .select('*')
        .single()
      if (error) throw error
      return fromRow<NewsDigest>(data)
    },
  }
  // La descarga la hace la Edge Function `news` (POST /news/fetch con la sesión del usuario: solo sus fuentes).
  const newsFeeds = {
    async fetchNow() {
      const { data, error } = await client.functions.invoke('news/fetch', {
        method: 'POST',
        body: {},
      })
      if (error) throw error
      return data as NewsFetchSummary
    },
  }

  // Imágenes de proyecto (ADR-0055): bucket privado `project-images`; la primera carpeta es el dueño (la política RLS
  // de Storage lo exige). Se leen con URL firmadas de un día: la app las pide cuando las pinta, nunca las guarda.
  const projectImages = {
    async upload(projectId: string, image: Blob) {
      const path = `${ownerId}/${projectId}/${crypto.randomUUID()}.${imageExt(image.type)}`
      const { error } = await client.storage
        .from(PROJECT_IMAGES_BUCKET)
        .upload(path, image, { contentType: image.type, cacheControl: '31536000' })
      if (error) throw error
      return path
    },
    async url(path: string) {
      const { data, error } = await client.storage
        .from(PROJECT_IMAGES_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24)
      if (error) throw error
      return data.signedUrl
    },
  }

  return {
    activity,
    settings,
    githubOutbox,
    githubRepos,
    projectImages,
    newsSources: col<NewsSource, { includeArchived?: boolean }>(
      'news_sources',
      'Fuente',
      (qb, q) => {
        if (!q.includeArchived) qb = qb.is('archived_at', null)
        return qb.order('title')
      },
    ),
    newsItems,
    newsDigests,
    newsFeeds,
    // Finanzas (ADR-0037, migración 20261021120000_finance).
    async accountTotals() {
      const { data, error } = await client
        .from('finance_account_totals')
        .select('account_id, net')
        .eq('owner_id', ownerId)
      if (error) throw error
      return (data as Row[]).map((r) => ({ accountId: r.account_id as string, net: Number(r.net) }))
    },
    financeAccounts: col('finance_accounts', 'Cuenta', (qb, q: AccountStoreQuery) => {
      if (!q.includeArchived) qb = qb.is('archived_at', null)
      if (q.kinds) qb = qb.in('kind', q.kinds)
      return qb.order('position')
    }),
    financeCategories: col('finance_categories', 'Categoría', (qb, q: CategoryStoreQuery) => {
      if (!q.includeArchived) qb = qb.is('archived_at', null)
      if (q.kind) qb = qb.eq('kind', q.kind)
      return qb.order('position')
    }),
    financeSubscriptions: col(
      'finance_subscriptions',
      'Suscripción',
      (qb, q: { includeArchived?: boolean }) => {
        if (!q.includeArchived) qb = qb.is('archived_at', null)
        return qb.order('next_date').order('name')
      },
    ),
    transactions: col(
      'finance_transactions',
      'Movimiento',
      (qb, q: TransactionStoreQuery) => {
        if (!q.includeArchived) qb = qb.is('archived_at', null)
        // Ids ya validados (uuid) en el servicio: no rompen la sintaxis de `or()`.
        if (q.accountId) qb = qb.or(`account_id.eq.${q.accountId},to_account_id.eq.${q.accountId}`)
        if (q.categoryId) qb = qb.eq('category_id', q.categoryId)
        if (q.subscriptionId) qb = qb.eq('subscription_id', q.subscriptionId)
        if (q.kinds) qb = qb.in('kind', q.kinds)
        if (q.from) qb = qb.gte('date', q.from)
        if (q.to) qb = qb.lte('date', q.to)
        if (q.search) qb = qb.ilike('concept', likeTerm(q.search))
        // Orden total (con el id): las páginas no se solapan ni se saltan filas.
        qb = qb
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
        return q.limit ? qb.limit(q.limit) : qb
      },
      true,
    ),
    projects: col('projects', 'Proyecto', (qb, q: ProjectStoreQuery) => {
      if (q.statuses) qb = qb.in('status', q.statuses)
      if (q.githubRepo) qb = qb.ilike('github_repo', ilikeExact(q.githubRepo))
      return qb.order('position')
    }),
    columns: col('board_columns', 'Columna', (qb, q: { projectId: string }) =>
      qb.eq('project_id', q.projectId).order('position'),
    ),
    tasks: col('tasks', 'Tarea', (qb, q: TaskStoreQuery) => {
      if (!q.includeArchived) qb = qb.is('archived_at', null)
      if (q.projectId) qb = qb.eq('project_id', q.projectId)
      if (q.columnIds) qb = qb.in('column_id', q.columnIds)
      if (q.priority) qb = qb.in('priority', q.priority)
      if (q.source) qb = qb.eq('source', q.source)
      if (q.externalId) qb = qb.eq('external_id', q.externalId)
      if (q.dueBefore) qb = qb.lte('due_date', q.dueBefore)
      if (q.search) {
        const term = likeTerm(q.search)
        qb = qb.or(`title.ilike.${term},description.ilike.${term}`)
      }
      qb = qb.order('position')
      return q.limit ? qb.limit(q.limit) : qb
    }),
    checklist: col(
      'task_checklist_items',
      'Elemento de checklist',
      (qb, q: { taskIds: string[] }) => qb.in('task_id', q.taskIds).order('position'),
    ),
    notes: col('notes', 'Nota', (qb, q: NoteStoreQuery) => {
      if (!q.includeArchived) qb = qb.is('archived_at', null)
      if (q.projectId) qb = qb.eq('project_id', q.projectId)
      if (q.taskId) qb = qb.eq('task_id', q.taskId)
      if (q.search) {
        const term = likeTerm(q.search)
        qb = qb.or(`title.ilike.${term},content.ilike.${term}`)
      }
      qb = qb.order('pinned', { ascending: false }).order('updated_at', { ascending: false })
      return q.limit ? qb.limit(q.limit) : qb
    }),
  }
}

/**
 * Dueños con alguna fuente activa, para el cron de la Edge Function `news` (con la service role, ADR-0042): la descarga
 * se hace usuario a usuario, cada uno con su store.
 */
export async function listNewsOwners(client: Client): Promise<string[]> {
  const { data, error } = await client
    .from('news_sources')
    .select('owner_id')
    .eq('enabled', true)
    .is('archived_at', null)
  if (error) throw error
  return [...new Set((data as Row[]).map((r) => r.owner_id as string))]
}

/**
 * Limpieza del cron (service role, ADR-0042): artículos no guardados de hace más de `itemDays` y resúmenes de hace más
 * de `digestDays`. Es caché de lo que publican otros, no datos del usuario: lo guardado no se toca nunca.
 */
export async function pruneNews(client: Client, { itemDays = 30, digestDays = 120 } = {}) {
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
  const items = await client
    .from('news_items')
    .delete({ count: 'exact' })
    .is('saved_at', null)
    .lt('fetched_at', ago(itemDays))
  if (items.error) throw items.error
  const digests = await client
    .from('news_digests')
    .delete({ count: 'exact' })
    .lt('date', ago(digestDays).slice(0, 10))
  if (digests.error) throw digests.error
  return { items: items.count ?? 0, digests: digests.count ?? 0 }
}
