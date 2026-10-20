import type { CreateProjectInput, Muninn } from '@muninn/core'
import { notify } from '@muninn/ui'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import type { BoardData } from './board'

/** Claves de react-query en un solo sitio: invalidar es predecible. */
export const keys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  /** Columnas, tareas y subtareas hechas de un proyecto, en una sola entrada (ver `BoardData`). */
  board: (projectId: string) => ['projects', projectId, 'board'] as const,
  overview: ['overview'] as const,
  settings: ['settings'] as const,
  /** Repos a los que llega el token de la sincronización (Ajustes › Integraciones). */
  githubRepos: ['github-repos'] as const,
  checklist: (taskId: string) => ['tasks', taskId, 'checklist'] as const,
  taskActivity: (taskId: string) => ['tasks', taskId, 'activity'] as const,
  taskNotes: (taskId: string) => ['tasks', taskId, 'notes'] as const,
  checklistCounts: (ids: string[]) => ['checklist-counts', ids] as const,
}

export const projectsQuery = (m: Muninn) =>
  queryOptions({ queryKey: keys.projects, queryFn: () => m.projects.list() })

export const projectQuery = (m: Muninn, id: string) =>
  queryOptions({ queryKey: keys.project(id), queryFn: () => m.projects.get(id), retry: false })

/** Todo lo que pinta el tablero. Las acciones lo actualizan en la caché antes de confirmar (optimista). */
export const boardQuery = (m: Muninn, projectId: string) =>
  queryOptions({
    queryKey: keys.board(projectId),
    queryFn: async (): Promise<BoardData> => {
      const [columns, tasks] = await Promise.all([
        m.columns.list(projectId),
        m.tasks.list({ projectId }),
      ])
      return { columns, tasks, counts: await m.checklist.counts(tasks.map((t) => t.id)) }
    },
  })

/** Ajustes del usuario (módulos activos, preferencias). El loader de `_app` la rellena antes del primer pintado. */
export const settingsQuery = (m: Muninn) =>
  queryOptions({ queryKey: keys.settings, queryFn: () => m.settings.get() })

export const overviewQuery = (m: Muninn) =>
  queryOptions({ queryKey: keys.overview, queryFn: () => m.overview() })

export const checklistQuery = (m: Muninn, taskId: string) =>
  queryOptions({ queryKey: keys.checklist(taskId), queryFn: () => m.checklist.list(taskId) })

export const taskActivityQuery = (m: Muninn, taskId: string) =>
  queryOptions({
    queryKey: keys.taskActivity(taskId),
    queryFn: () => m.recentActivity({ entityId: taskId, limit: 20 }),
  })

export const taskNotesQuery = (m: Muninn, taskId: string) =>
  queryOptions({ queryKey: keys.taskNotes(taskId), queryFn: () => m.notes.list({ taskId }) })

/** Subtareas hechas/total de unas tareas (Inicio las muestra junto a cada fila). */
export const checklistCountsQuery = (m: Muninn, ids: string[]) =>
  queryOptions({
    queryKey: keys.checklistCounts(ids),
    queryFn: () => m.checklist.counts(ids),
    enabled: ids.length > 0,
  })

/** Los proyectos afectan a la barra lateral, a Inicio y a Proyectos: se invalidan juntos. */
export const invalidateProjects = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: keys.projects }),
    qc.invalidateQueries({ queryKey: keys.overview }),
  ])

/** Crea un proyecto con feedback y «Deshacer» (archivarlo). Devuelve el proyecto o `null`. */
export async function createProjectWithUndo(m: Muninn, qc: QueryClient, input: CreateProjectInput) {
  try {
    const project = await m.projects.create(input)
    await invalidateProjects(qc)
    notify.success(`Proyecto «${project.name}» creado`, {
      icon: 'plus',
      description: 'con el tablero por defecto',
      action: {
        label: 'Deshacer',
        onClick: async () => {
          await m.projects.archive(project.id)
          await invalidateProjects(qc)
          notify.info(`«${project.name}» archivado`, { icon: 'archive' })
        },
      },
    })
    return project
  } catch (err) {
    notify.error('No se pudo crear el proyecto', {
      description: err instanceof Error ? err.message : undefined,
    })
    return null
  }
}

/** Archiva con «Deshacer» (vuelve a activo). Archivar nunca borra: ver ADR-0019. */
export async function archiveProjectWithUndo(m: Muninn, qc: QueryClient, id: string, name: string) {
  try {
    await m.projects.archive(id)
    await invalidateProjects(qc)
    notify.success(`«${name}» archivado`, {
      icon: 'archive',
      action: {
        label: 'Deshacer',
        onClick: async () => {
          await m.projects.update(id, { status: 'active' })
          await invalidateProjects(qc)
          notify.info(`«${name}» recuperado`)
        },
      },
    })
    return true
  } catch (err) {
    notify.error('No se pudo archivar el proyecto', {
      description: err instanceof Error ? err.message : undefined,
    })
    return false
  }
}
