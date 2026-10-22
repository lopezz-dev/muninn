import { z } from 'zod'

// ─── Enumeraciones ───────────────────────────────────────────────────────────

export const projectStatus = z.enum(['active', 'paused', 'archived'])
export const columnKind = z.enum(['backlog', 'todo', 'in_progress', 'review', 'done'])
export const taskPriority = z.enum(['none', 'low', 'medium', 'high', 'urgent'])
export const taskSource = z.enum(['manual', 'github', 'mcp', 'agent'])
export const actorKind = z.enum(['user', 'mcp', 'github', 'agent', 'system'])
/** Módulos activables (`user_settings.enabled_modules`). */
export const moduleName = z.enum(['tasks', 'notes', 'github', 'finance', 'news', 'focus'])

export type ProjectStatus = z.infer<typeof projectStatus>
export type ColumnKind = z.infer<typeof columnKind>
export type TaskPriority = z.infer<typeof taskPriority>
export type TaskSource = z.infer<typeof taskSource>
export type ActorKind = z.infer<typeof actorKind>
export type ModuleName = z.infer<typeof moduleName>

const id = z.uuid()
const isoDate = z.iso.date()
export const githubRepo = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Formato esperado: owner/repo')

/**
 * Lo que usa la sincronización de una issue de GitHub: el subconjunto común a la API REST y a los
 * webhooks (`issues`). Lo demás se descarta. Si trae `pull_request`, es un PR y no se importa.
 */
export const githubIssue = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable().optional(),
  state: z.enum(['open', 'closed']),
  html_url: z.url(),
  labels: z
    .array(z.union([z.string(), z.object({ name: z.string().nullable().optional() })]))
    .optional(),
  pull_request: z.unknown().optional(),
})
export type GithubIssue = z.input<typeof githubIssue>
export type GithubIssueState = 'open' | 'closed'

/** Etiqueta que lanza al agente en el repo (ADR-0032): la pone y la quita la sincronización. */
export const AGENT_LABEL = 'muninn:agent'

/** Lo que apunta en la actividad el flujo del agente: un PR abierto, fusionado o cerrado, o que terminó sin PR. */
export const AGENT_ACTIONS = [
  'agent_pr_opened',
  'agent_pr_merged',
  'agent_pr_closed',
  'agent_stopped',
] as const
export type AgentAction = (typeof AGENT_ACTIONS)[number]

/** Lo que usa la columna del agente de un PR (evento `pull_request` del webhook). */
export const githubPullRequest = z.object({
  number: z.number().int().positive(),
  html_url: z.url(),
  body: z.string().nullable().optional(),
  state: z.enum(['open', 'closed']),
  merged: z.boolean().nullable().optional(),
  draft: z.boolean().nullable().optional(),
  head: z.object({ ref: z.string() }),
})
export type GithubPullRequest = z.input<typeof githubPullRequest>

/** Qué lleva una entrada de la cola de salida: el estado de la issue o la etiqueta del agente. */
export const outboxKind = z.enum(['state', 'agent'])
export type OutboxKind = z.infer<typeof outboxKind>

/** `outbox`: solo vaciar la cola (tras un cambio en la app); `all`: también repasar los repos. */
export const githubSyncScope = z.enum(['outbox', 'all'])
export type GithubSyncScope = z.infer<typeof githubSyncScope>

/** Un repo al que llega el token de la sincronización: lo que ofrece el selector de Ajustes › Integraciones. */
export const githubRepoSummary = z.object({
  fullName: githubRepo,
  private: z.boolean(),
  description: z.string().nullable(),
})
export type GithubRepoSummary = z.infer<typeof githubRepoSummary>
export const githubRepoList = z.array(githubRepoSummary)

// ─── Entidades (lo que devuelve el store) ────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string | null
  status: ProjectStatus
  githubRepo: string | null
  /** Columna «Para el agente» (ADR-0032): mover ahí una tarea de GitHub etiqueta su issue. */
  agentColumnId: string | null
  position: string
  createdAt: string
  updatedAt: string
}

export interface BoardColumn {
  id: string
  projectId: string
  name: string
  kind: ColumnKind
  color: string | null
  wipLimit: number | null
  position: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  projectId: string
  columnId: string
  title: string
  description: string
  priority: TaskPriority
  labels: string[]
  dueDate: string | null
  position: string
  source: TaskSource
  externalId: string | null
  externalUrl: string | null
  completedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ChecklistItem {
  id: string
  taskId: string
  title: string
  done: boolean
  position: string
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  projectId: string | null
  taskId: string | null
  title: string
  content: string
  pinned: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: number
  projectId: string | null
  entityType: 'project' | 'column' | 'task' | 'note' | 'account' | 'category' | 'transaction'
  entityId: string
  action: string
  actor: ActorKind
  payload: Record<string, unknown>
  createdAt: string
}

/**
 * Ajustes del usuario: una fila por usuario. `preferences` es JSON libre por clave
 * (`appearance`, …): cada cliente valida su parte al leerla.
 */
export interface UserSettings {
  enabledModules: ModuleName[]
  preferences: Record<string, unknown>
  updatedAt: string
}

// ─── Entradas (validadas en el servicio; el MCP reutiliza estas formas) ─────

export const createProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(5000).optional(),
  color: z.string().max(32).optional(),
  icon: z.string().max(64).nullable().optional(),
  githubRepo: githubRepo.nullable().optional(),
})

export const updateProjectInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(5000).optional(),
  color: z.string().max(32).optional(),
  icon: z.string().max(64).nullable().optional(),
  status: projectStatus.optional(),
  githubRepo: githubRepo.nullable().optional(),
  /** La columna del agente; `null` la quita. Debe ser del proyecto y no de tipo «hecho». */
  agentColumnId: id.nullable().optional(),
})

export const createColumnInput = z.object({
  projectId: id,
  name: z.string().trim().min(1).max(60),
  kind: columnKind,
  color: z.string().max(32).nullable().optional(),
  wipLimit: z.number().int().positive().nullable().optional(),
  /** Índice destino entre las columnas existentes; por defecto, al final. */
  index: z.number().int().min(0).optional(),
})

export const updateColumnInput = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  kind: columnKind.optional(),
  color: z.string().max(32).nullable().optional(),
  wipLimit: z.number().int().positive().nullable().optional(),
})

export const createTaskInput = z.object({
  projectId: id,
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20000).optional(),
  /** Columna destino; si falta, la primera columna de tipo "todo". */
  columnId: id.optional(),
  priority: taskPriority.optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  dueDate: isoDate.nullable().optional(),
  source: taskSource.optional(),
  externalId: z.string().max(200).nullable().optional(),
  externalUrl: z.url().nullable().optional(),
})

export const updateTaskInput = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(20000).optional(),
  priority: taskPriority.optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  dueDate: isoDate.nullable().optional(),
})

export const moveTaskInput = z.object({
  columnId: id,
  /** Posición destino dentro de la columna (0 = arriba). Por defecto, al final. */
  index: z.number().int().min(0).optional(),
})

export const taskQuery = z.object({
  projectId: id.optional(),
  columnId: id.optional(),
  kinds: z.array(columnKind).optional(),
  priority: z.array(taskPriority).optional(),
  source: taskSource.optional(),
  dueBefore: isoDate.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
})

export const createNoteInput = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(200000).optional(),
  projectId: id.nullable().optional(),
  taskId: id.nullable().optional(),
  pinned: z.boolean().optional(),
})

export const updateNoteInput = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(200000).optional(),
  projectId: id.nullable().optional(),
  taskId: id.nullable().optional(),
  pinned: z.boolean().optional(),
})

export const noteQuery = z.object({
  projectId: id.optional(),
  taskId: id.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
})

export const updateSettingsInput = z.object({
  enabledModules: z.array(moduleName).max(20).optional(),
  /** Se fusiona por clave con lo guardado: `{ appearance }` no borra el resto de preferencias. */
  preferences: z.record(z.string().min(1).max(64), z.json()).optional(),
})

// ─── Finanzas (ADR-0037) ─────────────────────────────────────────────────────

/** Tipos de cuenta: corriente, ahorro, inversión, efectivo u otra. */
export const accountKind = z.enum(['checking', 'savings', 'investment', 'cash', 'other'])
/** Gasto, ingreso o traspaso entre cuentas. «Ahorro» e «Inversión» son traspasos a esas cuentas. */
export const transactionKind = z.enum(['expense', 'income', 'transfer'])
/** Una categoría es de gastos o de ingresos; los traspasos no llevan. */
export const categoryKind = z.enum(['expense', 'income'])
/** Colores de cuenta y categoría: la paleta de proyectos (`palette` en `@muninn/ui`). */
export const financeColor = z.enum(['blue', 'violet', 'teal', 'pink', 'green', 'amber', 'gray'])

export type AccountKind = z.infer<typeof accountKind>
export type TransactionKind = z.infer<typeof transactionKind>
export type CategoryKind = z.infer<typeof categoryKind>
export type FinanceColor = z.infer<typeof financeColor>

/** Céntimos de un importe: entero positivo y como mucho 999.999.999,99 € (lo que admite `AmountField`). */
export const MAX_CENTS = 99_999_999_999
const cents = z.number().int().positive().max(MAX_CENTS)
/** El saldo inicial sí puede ser negativo (una cuenta que empieza en descubierto). */
const signedCents = z.number().int().min(-MAX_CENTS).max(MAX_CENTS)

export interface FinanceAccount {
  id: string
  name: string
  kind: AccountKind
  color: string
  /** Céntimos; puede ser negativo. */
  initialBalance: number
  /** Objetivo de una hucha, en céntimos. */
  goal: number | null
  currency: 'EUR'
  position: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Cuenta con su saldo derivado de los movimientos (ADR-0037). */
export type AccountWithBalance = FinanceAccount & { balance: number }

export interface FinanceCategory {
  id: string
  name: string
  kind: CategoryKind
  color: string
  /** Las de serie llevan su clave (`housing`…); las propias, `null`. */
  key: string | null
  position: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  kind: TransactionKind
  /** Céntimos, siempre positivo (ADR-0018). */
  amount: number
  /** Fecha local `AAAA-MM-DD`. */
  date: string
  accountId: string
  /** Destino de un traspaso; `null` en gastos e ingresos. */
  toAccountId: string | null
  categoryId: string | null
  concept: string
  note: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export const createAccountInput = z.object({
  name: z.string().trim().min(1).max(80),
  kind: accountKind,
  color: financeColor.optional(),
  initialBalance: signedCents.optional(),
  goal: cents.nullable().optional(),
})

export const updateAccountInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  kind: accountKind.optional(),
  color: financeColor.optional(),
  initialBalance: signedCents.optional(),
  goal: cents.nullable().optional(),
})

export const createCategoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  kind: categoryKind,
  color: financeColor.optional(),
})

export const updateCategoryInput = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: financeColor.optional(),
})

export const createTransactionInput = z.object({
  kind: transactionKind,
  amount: cents,
  /** Por defecto, hoy (en la zona horaria del core). */
  date: isoDate.optional(),
  accountId: id,
  /** Solo en traspasos, y distinta de `accountId`. */
  toAccountId: id.nullable().optional(),
  /** Solo en gastos e ingresos, y de su mismo tipo. */
  categoryId: id.nullable().optional(),
  concept: z.string().trim().max(200).optional(),
  note: z.string().max(2000).optional(),
})

export const updateTransactionInput = z.object({
  kind: transactionKind.optional(),
  amount: cents.optional(),
  date: isoDate.optional(),
  accountId: id.optional(),
  toAccountId: id.nullable().optional(),
  categoryId: id.nullable().optional(),
  concept: z.string().trim().max(200).optional(),
  note: z.string().max(2000).optional(),
})

export const transactionQuery = z.object({
  /** Movimientos de una cuenta: los suyos y los traspasos que llegan a ella. */
  accountId: id.optional(),
  categoryId: id.optional(),
  kinds: z.array(transactionKind).optional(),
  /** Mes `AAAA-MM`; atajo de `from`/`to`. */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato esperado: AAAA-MM')
    .optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(5000).optional(),
})

export type CreateAccountInput = z.input<typeof createAccountInput>
export type UpdateAccountInput = z.input<typeof updateAccountInput>
export type CreateCategoryInput = z.input<typeof createCategoryInput>
export type UpdateCategoryInput = z.input<typeof updateCategoryInput>
export type CreateTransactionInput = z.input<typeof createTransactionInput>
export type UpdateTransactionInput = z.input<typeof updateTransactionInput>
export type TransactionQuery = z.input<typeof transactionQuery>

export type CreateProjectInput = z.input<typeof createProjectInput>
export type UpdateProjectInput = z.input<typeof updateProjectInput>
export type CreateColumnInput = z.input<typeof createColumnInput>
export type UpdateColumnInput = z.input<typeof updateColumnInput>
export type CreateTaskInput = z.input<typeof createTaskInput>
export type UpdateTaskInput = z.input<typeof updateTaskInput>
export type MoveTaskInput = z.input<typeof moveTaskInput>
export type TaskQuery = z.infer<typeof taskQuery>
export type CreateNoteInput = z.input<typeof createNoteInput>
export type UpdateNoteInput = z.input<typeof updateNoteInput>
export type NoteQuery = z.infer<typeof noteQuery>
export type UpdateSettingsInput = z.input<typeof updateSettingsInput>
