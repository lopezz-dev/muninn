import type {
  AccountKind,
  Activity,
  BoardColumn,
  CategoryKind,
  ChecklistItem,
  FinanceAccount,
  FinanceCategory,
  GithubRepoSummary,
  GithubSyncScope,
  Note,
  OutboxKind,
  Project,
  ProjectStatus,
  Subscription,
  Task,
  TaskPriority,
  TaskSource,
  Transaction,
  TransactionKind,
  UserSettings,
} from './schemas'

/**
 * Capa de persistencia. La app, el MCP y los agentes nunca hablan con Supabase directamente:
 * pasan por el servicio (`createMuninn`), que usa un Store. Cambiar de backend (Supabase cloud,
 * Supabase self-hosted, fichero local…) es escribir otro Store.
 *
 * Un Store está ligado a un único usuario: las implementaciones multiusuario fijan el owner.
 */
export interface Store {
  projects: Collection<Project, ProjectStoreQuery>
  columns: Collection<BoardColumn, { projectId: string }>
  tasks: Collection<Task, TaskStoreQuery>
  checklist: Collection<ChecklistItem, { taskIds: string[] }>
  notes: Collection<Note, NoteStoreQuery>
  activity: ActivityLog
  settings: SettingsStore
  githubOutbox: GithubOutbox
  /** Finanzas (ADR-0037). */
  financeAccounts: Collection<FinanceAccount, AccountStoreQuery>
  financeCategories: Collection<FinanceCategory, CategoryStoreQuery>
  transactions: Collection<Transaction, TransactionStoreQuery>
  /** Por próximo cobro, el más cercano primero (ADR-0038). */
  financeSubscriptions: Collection<Subscription, { includeArchived?: boolean }>
  /**
   * Neto de los movimientos no archivados por cuenta (ingresos − gastos ± traspasos), en céntimos. Las cuentas sin
   * movimientos no salen. En Supabase lo suma la vista `finance_account_totals`.
   */
  accountTotals(): Promise<{ accountId: string; net: number }[]>
  /**
   * Repos a los que llega el token de la sincronización. Solo lo sabe el store de Supabase (se lo pregunta
   * a la Edge Function `github`, que es quien tiene el token); sin él, la UI pide el repo a mano.
   */
  githubRepos?: {
    list(): Promise<GithubRepoSummary[]>
    /** Si el token puede escribir issues en `repo` (los públicos salen en la lista aunque no pueda). */
    canWrite(repo: string): Promise<boolean>
    /** Lanza la sincronización ahora: solo la cola de salida o también la reconciliación de los repos. */
    sync(scope: GithubSyncScope): Promise<unknown>
  }
}

export interface OutboxEntry {
  id: number
  taskId: string
  kind: OutboxKind
  attempts: number
  lastError: string | null
  createdAt: string
}

/**
 * Cola de salida hacia GitHub: tareas con issue cuyo estado (abierta o cerrada, `state`) o cuya etiqueta
 * del agente (`agent`, ADR-0032) hay que llevar a GitHub. La llena el servicio; la vacía la
 * sincronización (`drainGithubOutbox`, en la Edge Function), que relee la tarea al procesarla.
 */
export interface GithubOutbox {
  enqueue(taskId: string, kind: OutboxKind): Promise<void>
  /** Sin procesar y con menos de `maxAttempts` intentos, de la más antigua a la más nueva. */
  pending(query: {
    maxAttempts: number
    limit?: number
    taskId?: string
    kind?: OutboxKind
  }): Promise<OutboxEntry[]>
  /** Sin `error`, quedan procesadas. Con `error`, siguen pendientes con un intento más. */
  settle(entries: OutboxEntry[], error?: string): Promise<void>
}

/** Fila única de ajustes del usuario del store. */
export interface SettingsStore {
  /** `null` si el usuario aún no ha guardado nada. */
  get(): Promise<UserSettings | null>
  /** Crea la fila si no existe; los campos que faltan conservan su valor (o el de por defecto). */
  upsert(patch: Partial<Omit<UserSettings, 'updatedAt'>>): Promise<UserSettings>
}

type Generated = 'id' | 'createdAt' | 'updatedAt'
export type NewRow<T> = Omit<T, Generated>

export interface Collection<T extends { id: string }, Q> {
  get(id: string): Promise<T | null>
  /** Devuelve filas ordenadas: por `position` si la entidad la tiene; las notas, fijadas primero y por recientes. */
  list(query: Q): Promise<T[]>
  insert(row: NewRow<T>): Promise<T>
  update(id: string, patch: Partial<NewRow<T>>): Promise<T>
  remove(id: string): Promise<void>
}

export interface ProjectStoreQuery {
  statuses?: ProjectStatus[]
  githubRepo?: string
}

export interface TaskStoreQuery {
  projectId?: string
  columnIds?: string[]
  priority?: TaskPriority[]
  source?: TaskSource
  externalId?: string
  dueBefore?: string
  search?: string
  includeArchived?: boolean
  limit?: number
}

export interface AccountStoreQuery {
  kinds?: AccountKind[]
  includeArchived?: boolean
}

export interface CategoryStoreQuery {
  kind?: CategoryKind
  includeArchived?: boolean
}

/** Movimientos de la fecha más reciente a la más antigua (y, en el mismo día, el último creado primero). */
export interface TransactionStoreQuery {
  /** Los de la cuenta y los traspasos que llegan a ella. */
  accountId?: string
  categoryId?: string
  kinds?: TransactionKind[]
  /** Fechas incluidas (`AAAA-MM-DD`). */
  from?: string
  to?: string
  search?: string
  includeArchived?: boolean
  limit?: number
  subscriptionId?: string
}

export interface NoteStoreQuery {
  projectId?: string
  taskId?: string
  search?: string
  includeArchived?: boolean
  limit?: number
}

export interface ActivityLog {
  insert(row: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity>
  list(query: {
    projectId?: string
    /** Solo los eventos de una entidad (una tarea, una columna…). */
    entityId?: string
    /** Solo estas acciones (`agent_pr_opened`…). */
    actions?: string[]
    since?: string
    limit?: number
  }): Promise<Activity[]>
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} no existe`)
    this.name = 'NotFoundError'
  }
}

/** Compara claves de fractional-indexing: orden binario, no el de la locale. */
export const byPosition = (a: { position: string }, b: { position: string }) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0
