import type {
  Activity,
  BoardColumn,
  ChecklistItem,
  Note,
  Project,
  Task,
  UserSettings,
} from './schemas'
import {
  type ActivityLog,
  byPosition,
  type Collection,
  type NewRow,
  type NoteStoreQuery,
  NotFoundError,
  type OutboxEntry,
  type ProjectStoreQuery,
  type Store,
  type TaskStoreQuery,
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
  options: { onChange?: (snapshot: MemorySnapshot) => void; now?: () => string } = {},
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
    })
  const changed = () => options.onChange?.(snapshot())

  const activityLog: ActivityLog = {
    async insert(row) {
      const full: Activity = { ...row, id: nextActivityId++, createdAt: now() }
      activity.push(full)
      changed()
      return structuredClone(full)
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
  }

  return {
    snapshot,
    activity: activityLog,
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
    projects: new MemoryCollection<Project, ProjectStoreQuery>(
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
    columns: new MemoryCollection<BoardColumn, { projectId: string }>(
      'Columna',
      columns,
      (rows, q) => rows.filter((c) => c.projectId === q.projectId).sort(byPosition),
      changed,
      now,
    ),
    tasks: new MemoryCollection<Task, TaskStoreQuery>(
      'Tarea',
      tasks,
      (rows, q) =>
        rows
          .filter((t) => q.includeArchived || !t.archivedAt)
          .filter((t) => !q.projectId || t.projectId === q.projectId)
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
