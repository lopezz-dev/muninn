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

// ─── Entidades (lo que devuelve el store) ────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string | null
  status: ProjectStatus
  githubRepo: string | null
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
  entityType: 'project' | 'column' | 'task' | 'note'
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
