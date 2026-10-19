import type {
  Activity,
  BoardColumn,
  ChecklistItem,
  Note,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskSource,
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

export interface NoteStoreQuery {
  projectId?: string
  taskId?: string
  search?: string
  includeArchived?: boolean
  limit?: number
}

export interface ActivityLog {
  insert(row: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity>
  list(query: { projectId?: string; since?: string; limit?: number }): Promise<Activity[]>
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
