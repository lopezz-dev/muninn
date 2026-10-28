import type { CreateProjectInput, Muninn, Project, UpdateProjectInput } from '@muninn/core'
import { notify } from '@muninn/ui'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import type { BoardData } from './board'

/** Claves de react-query en un solo sitio: invalidar es predecible. */
export const keys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  archivedProjects: ['projects', 'archived'] as const,
  /** URL firmada de la imagen de un proyecto: fuera de `projects` para no pedirla otra vez a cada cambio. */
  projectImage: (path: string) => ['project-image', path] as const,
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

export const archivedProjectsQuery = (m: Muninn) =>
  queryOptions({
    queryKey: keys.archivedProjects,
    queryFn: async () =>
      (await m.projects.list({ includeArchived: true })).filter((p) => p.status === 'archived'),
  })

/** URL de la imagen de un proyecto (ADR-0055). En Supabase es firmada por un día: se renueva antes de caducar. */
export const projectImageQuery = (m: Muninn, path: string | null) =>
  queryOptions({
    queryKey: keys.projectImage(path ?? ''),
    queryFn: () => m.projects.imageUrl(path as string),
    enabled: Boolean(path),
    staleTime: 12 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  })

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

/**
 * Repos a los que llega el token de la sincronización (los pregunta a la Edge Function). `null`: este modo
 * no puede preguntarlo (demo) y el repo se escribe a mano.
 */
export const githubReposQuery = (m: Muninn, enabled: boolean) =>
  queryOptions({
    queryKey: keys.githubRepos,
    queryFn: () => m.github.repos(),
    staleTime: 5 * 60_000,
    retry: false,
    enabled,
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

const errorText = (err: unknown) => (err instanceof Error ? err.message : undefined)

type ProjectFields = Pick<UpdateProjectInput, 'name' | 'description' | 'color'>

/** Guarda nombre, descripción o color con «Deshacer» (vuelve a lo de antes). */
export async function updateProjectWithUndo(
  m: Muninn,
  qc: QueryClient,
  before: Project,
  patch: ProjectFields,
) {
  try {
    const project = await m.projects.update(before.id, patch)
    await invalidateProjects(qc)
    notify.success(`«${project.name}» guardado`, {
      icon: 'check',
      action: {
        label: 'Deshacer',
        onClick: async () => {
          await m.projects.update(before.id, {
            name: before.name,
            description: before.description,
            color: before.color,
          })
          await invalidateProjects(qc)
          notify.info('Cambios deshechos')
        },
      },
    })
    return project
  } catch (err) {
    notify.error('No se pudo guardar el proyecto', { description: errorText(err) })
    return null
  }
}

/** Pone una imagen (ya reducida) o la quita (`null`), con «Deshacer» que vuelve a la anterior. */
export async function setProjectImageWithUndo(
  m: Muninn,
  qc: QueryClient,
  project: Project,
  image: Blob | null,
) {
  const previous = project.imagePath ?? null
  try {
    if (image) await m.projects.setImage(project.id, image)
    else await m.projects.restoreImage(project.id, null)
    await invalidateProjects(qc)
    notify.success(image ? 'Imagen del proyecto actualizada' : 'Imagen quitada', {
      icon: 'image',
      description: project.name,
      action: {
        label: 'Deshacer',
        onClick: async () => {
          await m.projects.restoreImage(project.id, previous)
          await invalidateProjects(qc)
          notify.info('Imagen como estaba')
        },
      },
    })
    return true
  } catch (err) {
    notify.error(image ? 'No se pudo subir la imagen' : 'No se pudo quitar la imagen', {
      description: errorText(err),
    })
    return false
  }
}

/** Saca un proyecto de «Archivados», con «Deshacer» (lo vuelve a archivar). */
export async function unarchiveProjectWithUndo(m: Muninn, qc: QueryClient, project: Project) {
  try {
    await m.projects.update(project.id, { status: 'active' })
    await invalidateProjects(qc)
    notify.success(`«${project.name}» recuperado`, {
      icon: 'archive',
      action: {
        label: 'Deshacer',
        onClick: async () => {
          await m.projects.archive(project.id)
          await invalidateProjects(qc)
        },
      },
    })
  } catch (err) {
    notify.error('No se pudo recuperar el proyecto', { description: errorText(err) })
  }
}
