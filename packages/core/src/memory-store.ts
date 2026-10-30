import { createMemoryAccount, type MemoryAccountSeed } from './memory-account'
import type {
  Activity,
  BoardColumn,
  ChecklistItem,
  FinanceAccount,
  FinanceCategory,
  NewsDigest,
  NewsItem,
  NewsSource,
  Note,
  Project,
  PushDevice,
  Subscription,
  Task,
  Transaction,
  UserSettings,
} from './schemas'
import { imageExt } from './schemas'
import {
  type AccountStoreQuery,
  type ActivityLog,
  byPosition,
  type CategoryStoreQuery,
  type Collection,
  type ColumnStoreQuery,
  type NewRow,
  type NewsItemStoreQuery,
  type NoteStoreQuery,
  NotFoundError,
  type OutboxEntry,
  type ProjectStoreQuery,
  type Store,
  type TaskStoreQuery,
  type TransactionStoreQuery,
} from './store'

export interface MemorySnapshot {
  projects: Project[]
  columns: BoardColumn[]
  tasks: Task[]
  checklist: ChecklistItem[]
  notes: Note[]
  activity: Activity[]
  settings: UserSettings | null
  githubOutbox: (OutboxEntry & { processedAt: string | null })[]
  financeAccounts: FinanceAccount[]
  financeCategories: FinanceCategory[]
  transactions: Transaction[]
  financeSubscriptions: Subscription[]
  newsSources: NewsSource[]
  newsItems: NewsItem[]
  newsDigests: NewsDigest[]
  pushDevices?: PushDevice[]
  /** Claves de los avisos ya enviados. */
  pushLog?: string[]
}

export const emptySnapshot = (): MemorySnapshot => ({
  projects: [],
  columns: [],
  tasks: [],
  checklist: [],
  notes: [],
  activity: [],
  settings: null,
  githubOutbox: [],
  financeAccounts: [],
  financeCategories: [],
  transactions: [],
  financeSubscriptions: [],
  newsSources: [],
  newsItems: [],
  newsDigests: [],
})

/** Lo que tiene un usuario sin fila en `user_settings` (los defaults de la tabla). */
export const DEFAULT_SETTINGS: Omit<UserSettings, 'updatedAt'> = {
  enabledModules: ['tasks', 'notes'],
  preferences: {},
}

const includesText = (haystack: string[], needle: string) => {
  const n = needle.toLowerCase()
  return haystack.some((h) => h.toLowerCase().includes(n))
}

class MemoryCollection<T extends { id: string; createdAt: string; updatedAt: string }, Q>
  implements Collection<T, Q>
{
  constructor(
    private readonly name: string,
    readonly rows: Map<string, T>,
    private readonly filter: (rows: T[], query: Q) => T[],
    private readonly onChange: () => void,
    private readonly now: () => string,
  ) {}

  async get(id: string) {
    const row = this.rows.get(id)
    return row ? structuredClone(row) : null
  }

  async list(query: Q) {
    return this.filter([...this.rows.values()], query).map((r) => structuredClone(r))
  }

  async insert(row: NewRow<T>) {
    const ts = this.now()
    const full = { ...row, id: crypto.randomUUID(), createdAt: ts, updatedAt: ts } as unknown as T
    this.rows.set(full.id, full)
    this.onChange()
    return structuredClone(full)
  }

  async insertMany(rows: NewRow<T>[]) {
    const ts = this.now()
    const full = rows.map(
      (row) => ({ ...row, id: crypto.randomUUID(), createdAt: ts, updatedAt: ts }) as unknown as T,
    )
    for (const r of full) this.rows.set(r.id, r)
    if (full.length > 0) this.onChange()
    return structuredClone(full)
  }

  async update(id: string, patch: Partial<NewRow<T>>) {
    const current = this.rows.get(id)
    if (!current) throw new NotFoundError(this.name, id)
    const next = { ...current, ...stripUndefined(patch), updatedAt: this.now() } as T
    this.rows.set(id, next)
    this.onChange()
    return structuredClone(next)
  }

  async remove(id: string) {
    this.rows.delete(id)
    this.onChange()
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

/**
 * Store en memoria. Sirve para tests, para la demo sin cuenta y como base del FileStore.
 * `onChange` se llama tras cada escritura (el FileStore lo usa para persistir).
 */
export function createMemoryStore(
  initial: MemorySnapshot = emptySnapshot(),
  options: {
    onChange?: (snapshot: MemorySnapshot) => void
    now?: () => string
    /** Sesiones de partida de la seguridad simulada (tests y demo). */
    account?: MemoryAccountSeed
  } = {},
): Store & { snapshot(): MemorySnapshot } {
  const now = options.now ?? (() => new Date().toISOString())
  const toMap = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]))

  const projects = toMap(initial.projects)
  const columns = toMap(initial.columns)
  const tasks = toMap(initial.tasks)
  const checklist = toMap(initial.checklist)
  const notes = toMap(initial.notes)
  const activity = [...initial.activity]
  let nextActivityId = activity.reduce((max, a) => Math.max(max, a.id), 0) + 1
  let settings = initial.settings ?? null
  // Un FileStore de antes de la cola no trae `githubOutbox`.
  const outbox = [...(initial.githubOutbox ?? [])]
  let nextOutboxId = outbox.reduce((max, e) => Math.max(max, e.id), 0) + 1
  // Ni los FileStore de antes de Finanzas.
  const accounts = toMap(initial.financeAccounts ?? [])
  const categories = toMap(initial.financeCategories ?? [])
  const transactions = toMap(initial.transactions ?? [])
  const subscriptions = toMap(initial.financeSubscriptions ?? [])
  // Ni los de antes de Noticias.
  const newsSources = toMap(initial.newsSources ?? [])
  const newsItems = toMap(initial.newsItems ?? [])
  const newsDigests = toMap(initial.newsDigests ?? [])
  // Ni los de antes de los avisos push.
  const pushDevices = toMap(initial.pushDevices ?? [])
  const pushLog = new Set(initial.pushLog ?? [])

  // Lo que en Supabase hacen las claves ajenas al borrar una tarea: sus subtareas y su cola de GitHub se van con ella;
  // sus notas se quedan sin tarea. La actividad se queda: es el historial.
  const dropTask = (id: string) => {
    for (const c of [...checklist.values()].filter((c) => c.taskId === id)) checklist.delete(c.id)
    for (let i = outbox.length - 1; i >= 0; i--) if (outbox[i]?.taskId === id) outbox.splice(i, 1)
    for (const n of notes.values()) if (n.taskId === id) notes.set(n.id, { ...n, taskId: null })
    tasks.delete(id)
  }

  const snapshot = (): MemorySnapshot =>
    structuredClone({
      projects: [...projects.values()],
      columns: [...columns.values()],
      tasks: [...tasks.values()],
      checklist: [...checklist.values()],
      notes: [...notes.values()],
      activity,
      settings,
      githubOutbox: outbox,
      financeAccounts: [...accounts.values()],
      financeCategories: [...categories.values()],
      transactions: [...transactions.values()],
      financeSubscriptions: [...subscriptions.values()],
      newsSources: [...newsSources.values()],
      newsItems: [...newsItems.values()],
      newsDigests: [...newsDigests.values()],
      pushDevices: [...pushDevices.values()],
      pushLog: [...pushLog],
    })
  const changed = () => options.onChange?.(snapshot())

  const activityLog: ActivityLog = {
    async insert(row) {
      const full: Activity = { ...row, id: nextActivityId++, createdAt: now() }
      activity.push(full)
      changed()
      return structuredClone(full)
    },
    async insertMany(rows) {
      const ts = now()
      for (const row of rows) activity.push({ ...row, id: nextActivityId++, createdAt: ts })
      if (rows.length > 0) changed()
    },
    async list({ projectId, entityId, actions, since, limit = 50 }) {
      return activity
        .filter(
          (a) =>
            (!projectId || a.projectId === projectId) &&
            (!entityId || a.entityId === entityId) &&
            (!actions || actions.includes(a.action)) &&
            (!since || a.createdAt >= since),
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
        .map((a) => structuredClone(a))
    },
    async latestByProject(projectIds) {
      const wanted = new Set(projectIds)
      const latest = new Map<string, string>()
      for (const a of activity) {
        if (!a.projectId || !wanted.has(a.projectId)) continue
        const prev = latest.get(a.projectId)
        if (!prev || a.createdAt > prev) latest.set(a.projectId, a.createdAt)
      }
      return [...latest].map(([projectId, createdAt]) => ({ projectId, createdAt }))
    },
  }

  /** Fecha por la que se ordena un artículo: la de publicación o, sin ella, la de descarga. */
  const when = (i: NewsItem) => i.publishedAt ?? i.fetchedAt
  const itemCollection = new MemoryCollection<NewsItem, NewsItemStoreQuery>(
    'Artículo',
    newsItems,
    (rows, q) =>
      rows
        .filter((i) => !q.sourceIds || q.sourceIds.includes(i.sourceId))
        .filter((i) => q.saved === undefined || Boolean(i.savedAt) === q.saved)
        .filter((i) => !q.unread || !i.readAt)
        .filter((i) => !q.since || when(i) >= q.since)
        .filter((i) => !q.search || includesText([i.title, i.summary], q.search))
        .sort((a, b) => (when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : 0))
        .slice(0, q.limit ?? Number.POSITIVE_INFINITY),
    changed,
    now,
  )
  const digestOrder = (a: NewsDigest, b: NewsDigest) => (a.date < b.date ? 1 : -1)

  // Imágenes de proyecto: solo en memoria (en el modo demo se pierden al recargar, como lo demás).
  const images = new Map<string, { blob: Blob; url?: string }>()
  const projectImages = {
    async upload(projectId: string, image: Blob) {
      const path = `${projectId}/${crypto.randomUUID()}.${imageExt(image.type)}`
      images.set(path, { blob: image })
      return path
    },
    async url(path: string) {
      const entry = images.get(path)
      if (!entry) throw new NotFoundError('Imagen', path)
      entry.url ??= URL.createObjectURL(entry.blob)
      return entry.url
    },
  }

  // Seguridad de la cuenta (ADR-0061), simulada: no es parte de la instantánea (es Auth, no datos). Sin sesiones de
  // partida, solo está la de este dispositivo.
  const accountState = createMemoryAccount(options.account, now)

  return {
    snapshot,
    projectImages,
    account: accountState,
    activity: activityLog,
    newsSources: new MemoryCollection<NewsSource, { includeArchived?: boolean }>(
      'Fuente',
      newsSources,
      (rows, q) =>
        rows
          .filter((x) => q.includeArchived || !x.archivedAt)
          .sort((a, b) => a.title.localeCompare(b.title, 'es')),
      changed,
      now,
    ),
    newsItems: {
      get: (id) => itemCollection.get(id),
      list: (q) => itemCollection.list(q),
      update: (id, patch) => itemCollection.update(id, patch),
      remove: (id) => itemCollection.remove(id),
      async insertNew(rows) {
        const seen = new Set([...newsItems.values()].map((i) => `${i.sourceId}|${i.guid}`))
        const added: NewsItem[] = []
        for (const row of rows) {
          const key = `${row.sourceId}|${row.guid}`
          if (seen.has(key)) continue
          seen.add(key)
          added.push(await itemCollection.insert(row))
        }
        return added
      },
    },
    newsDigests: {
      async get(date) {
        const d = [...newsDigests.values()].find((x) => x.date === date)
        return d ? structuredClone(d) : null
      },
      async latest() {
        const d = [...newsDigests.values()].sort(digestOrder)[0]
        return d ? structuredClone(d) : null
      },
      async upsert(row) {
        const current = [...newsDigests.values()].find((x) => x.date === row.date)
        const ts = now()
        const full: NewsDigest = current
          ? { ...current, ...row, updatedAt: ts }
          : { ...row, id: crypto.randomUUID(), createdAt: ts, updatedAt: ts }
        newsDigests.set(full.id, full)
        changed()
        return structuredClone(full)
      },
    },
    pushDevices: {
      async list() {
        return [...pushDevices.values()]
          .sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : a.lastSeenAt > b.lastSeenAt ? -1 : 0))
          .map((d) => structuredClone(d))
      },
      async upsert(row) {
        const current = [...pushDevices.values()].find((d) => d.endpoint === row.endpoint)
        const ts = now()
        const full: PushDevice = current
          ? { ...current, ...row, updatedAt: ts }
          : { ...row, id: crypto.randomUUID(), createdAt: ts, updatedAt: ts }
        pushDevices.set(full.id, full)
        changed()
        return structuredClone(full)
      },
      async remove(id) {
        pushDevices.delete(id)
        changed()
      },
      async removeEndpoint(endpoint) {
        for (const d of pushDevices.values()) if (d.endpoint === endpoint) pushDevices.delete(d.id)
        changed()
      },
    },
    pushLog: {
      async sent(keys) {
        return keys.filter((k) => pushLog.has(k))
      },
      async record(keys) {
        for (const k of keys) pushLog.add(k)
        changed()
      },
    },
    async accountTotals() {
      const net = new Map<string, number>()
      const add = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta)
      for (const t of transactions.values()) {
        if (t.archivedAt) continue
        add(t.accountId, t.kind === 'income' ? t.amount : -t.amount)
        if (t.kind === 'transfer' && t.toAccountId) add(t.toAccountId, t.amount)
      }
      return [...net].map(([accountId, n]) => ({ accountId, net: n }))
    },
    financeAccounts: new MemoryCollection<FinanceAccount, AccountStoreQuery>(
      'Cuenta',
      accounts,
      (rows, q) =>
        rows
          .filter((a) => q.includeArchived || !a.archivedAt)
          .filter((a) => !q.kinds || q.kinds.includes(a.kind))
          .sort(byPosition),
      changed,
      now,
    ),
    financeCategories: new MemoryCollection<FinanceCategory, CategoryStoreQuery>(
      'Categoría',
      categories,
      (rows, q) =>
        rows
          .filter((c) => q.includeArchived || !c.archivedAt)
          .filter((c) => !q.kind || c.kind === q.kind)
          .sort(byPosition),
      changed,
      now,
    ),
    financeSubscriptions: new MemoryCollection<Subscription, { includeArchived?: boolean }>(
      'Suscripción',
      subscriptions,
      (rows, q) =>
        rows
          .filter((x) => q.includeArchived || !x.archivedAt)
          .sort((a, b) => (a.nextDate < b.nextDate ? -1 : a.nextDate > b.nextDate ? 1 : 0)),
      changed,
      now,
    ),
    transactions: new MemoryCollection<Transaction, TransactionStoreQuery>(
      'Movimiento',
      transactions,
      (rows, q) =>
        rows
          .filter((t) => q.includeArchived || !t.archivedAt)
          .filter(
            (t) => !q.accountId || t.accountId === q.accountId || t.toAccountId === q.accountId,
          )
          .filter((t) => !q.categoryId || t.categoryId === q.categoryId)
          .filter((t) => !q.subscriptionId || t.subscriptionId === q.subscriptionId)
          .filter((t) => !q.kinds || q.kinds.includes(t.kind))
          .filter((t) => !q.from || t.date >= q.from)
          .filter((t) => !q.to || t.date <= q.to)
          .filter((t) => !q.search || includesText([t.concept], q.search))
          .sort((a, b) =>
            a.date !== b.date
              ? a.date < b.date
                ? 1
                : -1
              : a.createdAt < b.createdAt
                ? 1
                : a.createdAt > b.createdAt
                  ? -1
                  : 0,
          )
          .slice(0, q.limit ?? Number.POSITIVE_INFINITY),
      changed,
      now,
    ),
    githubOutbox: {
      async enqueue(taskId, kind) {
        outbox.push({
          id: nextOutboxId++,
          taskId,
          kind,
          attempts: 0,
          lastError: null,
          createdAt: now(),
          processedAt: null,
        })
        changed()
      },
      async pending({ maxAttempts, limit = 100, taskId, kind }) {
        return outbox
          .filter(
            (e) =>
              !e.processedAt &&
              e.attempts < maxAttempts &&
              (!taskId || e.taskId === taskId) &&
              // Las de antes de ADR-0032 no tienen tipo: eran todas de estado.
              (!kind || (e.kind ?? 'state') === kind),
          )
          .slice(0, limit)
          .map(({ processedAt: _, ...e }) => structuredClone(e))
      },
      async settle(entries, error) {
        const ids = new Set(entries.map((e) => e.id))
        for (const e of outbox) {
          if (!ids.has(e.id)) continue
          if (error === undefined) e.processedAt = now()
          else {
            e.attempts += 1
            e.lastError = error
          }
        }
        changed()
      },
    },
    settings: {
      async get() {
        return settings ? structuredClone(settings) : null
      },
      async upsert(patch) {
        settings = { ...DEFAULT_SETTINGS, ...settings, ...stripUndefined(patch), updatedAt: now() }
        changed()
        return structuredClone(settings)
      },
    },
    projects: Object.assign(
      new MemoryCollection<Project, ProjectStoreQuery>(
        'Proyecto',
        projects,
        (rows, q) =>
          rows
            .filter((p) => !q.statuses || q.statuses.includes(p.status))
            .filter(
              (p) => !q.githubRepo || p.githubRepo?.toLowerCase() === q.githubRepo.toLowerCase(),
            )
            .sort(byPosition),
        changed,
        now,
      ),
      {
        // Lo que en Supabase hacen las claves ajenas: columnas, tareas (con sus subtareas) y actividad se van con el
        // proyecto; las notas se quedan sin él.
        async remove(id: string) {
          for (const t of [...tasks.values()].filter((t) => t.projectId === id)) dropTask(t.id)
          for (const c of [...columns.values()].filter((c) => c.projectId === id))
            columns.delete(c.id)
          for (const n of notes.values())
            if (n.projectId === id) notes.set(n.id, { ...n, projectId: null, taskId: null })
          for (let i = activity.length - 1; i >= 0; i--)
            if (activity[i]?.projectId === id) activity.splice(i, 1)
          projects.delete(id)
          changed()
        },
      },
    ),
    columns: new MemoryCollection<BoardColumn, ColumnStoreQuery>(
      'Columna',
      columns,
      (rows, q) => rows.filter((c) => q.projectIds.includes(c.projectId)).sort(byPosition),
      changed,
      now,
    ),
    tasks: Object.assign(
      new MemoryCollection<Task, TaskStoreQuery>(
        'Tarea',
        tasks,
        (rows, q) =>
          rows
            .filter((t) => q.includeArchived || !t.archivedAt)
            .filter((t) => !q.projectId || t.projectId === q.projectId)
            .filter((t) => !q.projectIds || q.projectIds.includes(t.projectId))
            .filter((t) => !q.columnIds || q.columnIds.includes(t.columnId))
            .filter((t) => !q.priority || q.priority.includes(t.priority))
            .filter((t) => !q.source || t.source === q.source)
            .filter((t) => !q.externalId || t.externalId === q.externalId)
            .filter((t) => !q.dueBefore || (t.dueDate !== null && t.dueDate <= q.dueBefore))
            .filter((t) => !q.search || includesText([t.title, t.description], q.search))
            .sort(byPosition)
            .slice(0, q.limit ?? Number.POSITIVE_INFINITY),
        changed,
        now,
      ),
      {
        async remove(id: string) {
          dropTask(id)
          changed()
        },
      },
    ),
    checklist: new MemoryCollection<ChecklistItem, { taskIds: string[] }>(
      'Elemento de checklist',
      checklist,
      (rows, q) => rows.filter((i) => q.taskIds.includes(i.taskId)).sort(byPosition),
      changed,
      now,
    ),
    notes: new MemoryCollection<Note, NoteStoreQuery>(
      'Nota',
      notes,
      (rows, q) =>
        rows
          .filter((n) => q.includeArchived || !n.archivedAt)
          .filter((n) => !q.projectId || n.projectId === q.projectId)
          .filter((n) => !q.taskId || n.taskId === q.taskId)
          .filter((n) => !q.search || includesText([n.title, n.content], q.search))
          .sort(
            (a, b) => Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : -1),
          )
          .slice(0, q.limit ?? Number.POSITIVE_INFINITY),
      changed,
      now,
    ),
  }
}
