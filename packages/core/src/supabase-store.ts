import type { SupabaseClient } from '@supabase/supabase-js'
import type { Activity, GithubRepoSummary, GithubSyncScope, UserSettings } from './schemas'
import {
  type ActivityLog,
  type Collection,
  type GithubOutbox,
  type NewRow,
  type NoteStoreQuery,
  NotFoundError,
  type OutboxEntry,
  type ProjectStoreQuery,
  type SettingsStore,
  type Store,
  type TaskStoreQuery,
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

class SupabaseCollection<T extends { id: string }, Q> implements Collection<T, Q> {
  constructor(
    private readonly client: Client,
    private readonly ownerId: string,
    private readonly table: string,
    private readonly entity: string,
    private readonly applyQuery: (qb: Builder, query: Q) => Builder,
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
    const { data, error } = await this.applyQuery(
      this.from().select('*').eq('owner_id', this.ownerId),
      query,
    )
    if (error) throw error
    return (data as Row[]).map((r) => fromRow<T>(r))
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
  ) => new SupabaseCollection<T, Q>(client, ownerId, table, entity, apply)

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
    async list({ projectId, entityId, since, limit = 50 }) {
      let qb = client.from('activity').select('*').eq('owner_id', ownerId)
      if (projectId) qb = qb.eq('project_id', projectId)
      if (entityId) qb = qb.eq('entity_id', entityId)
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

  // Tabla `github_outbox` (migraciones 20261020000000_github_outbox y 20261021000000_agent_column).
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

  return {
    activity,
    settings,
    githubOutbox,
    githubRepos,
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
