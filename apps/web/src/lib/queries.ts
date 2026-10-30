import type {
  CreateProjectInput,
  Muninn,
  Project,
  ProjectImageKind,
  UpdateProjectInput,
} from '@muninn/core'
import { notify } from '@muninn/ui'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import type { BoardData } from './board'
import { fail, notifyUndo } from './feedback'

/** Claves de react-query en un solo sitio: invalidar es predecible. */
export const keys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  archivedProjects: ['projects', 'archived'] as const,
  /** URL firmada de la imagen de un proyecto: fuera de `projects` para no pedirla otra vez a cada cambio. */
  projectImage: (path: string) => ['project-image', path] as const,
  /** Columnas, tareas y subtareas hechas de un proyecto, en una sola entrada (ver `BoardData`). */
  board: (projectId: string) => ['projects', projectId, 'board'] as const,
  /** Tareas archivadas de un proyecto (ADR-0067). Cuelga del proyecto: el tiempo real la refresca con él. */
  archivedTasks: (projectId: string) => ['projects', projectId, 'archived-tasks'] as const,
  overview: ['overview'] as const,
  settings: ['settings'] as const,
  /** Repos a los que llega el token de la sincronización (Ajustes › Integraciones). */
  githubRepos: ['github-repos'] as const,
  checklist: (taskId: string) => ['tasks', taskId, 'checklist'] as const,
  taskActivity: (taskId: string) => ['tasks', taskId, 'activity'] as const,
  taskNotes: (taskId: string) => ['tasks', taskId, 'notes'] as const,
  checklistCounts: (ids: string[]) => ['checklist-counts', ids] as const,
  /** Ajustes › Cuenta (ADR-0061): sesiones, segundo factor y apps. Es Auth, no datos: no se guarda sin conexión. */
  accountSessions: ['account', 'sessions'] as const,
  accountMfa: ['account', 'mfa'] as const,
  accountApps: ['account', 'apps'] as const,
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
    queryFn: (): Promise<BoardData> => m.projects.board(projectId),
  })

/** Las archivadas de un proyecto, la última archivada primero. Solo se pide al abrir la lista. */
export const archivedTasksQuery = (m: Muninn, projectId: string) =>
  queryOptions({
    queryKey: keys.archivedTasks(projectId),
    queryFn: async () =>
      (await m.tasks.list({ projectId, includeArchived: true }))
        .filter((t) => t.archivedAt)
        .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
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
    notifyUndo(`Proyecto «${project.name}» creado`, {
      icon: 'plus',
      description: 'con el tablero por defecto',
      undo: async () => {
        await m.projects.archive(project.id)
        await invalidateProjects(qc)
      },
      undone: [`«${project.name}» archivado`, { icon: 'archive' }],
    })
    return project
  } catch (err) {
    fail('No se pudo crear el proyecto', err)
    return null
  }
}

/**
 * Archiva con «Deshacer» (vuelve a activo). Archivar nunca borra: ver ADR-0019. Si tenía repo de GitHub, el core lo
 * suelta (ADR-0065) y el aviso lo dice; «Deshacer» intenta volver a vincularlo.
 */
export async function archiveProjectWithUndo(
  m: Muninn,
  qc: QueryClient,
  project: Pick<Project, 'id' | 'name' | 'githubRepo'>,
) {
  const { id, name } = project
  const repo = project.githubRepo ?? null
  try {
    await m.projects.archive(id)
    await invalidateProjects(qc)
    notifyUndo(`«${name}» archivado`, {
      icon: 'archive',
      description: repo ? `Ya no está vinculado a ${repo}.` : undefined,
      undo: async () => {
        await m.projects.update(id, { status: 'active' })
        let relinked = true
        if (repo) await m.projects.update(id, { githubRepo: repo }).catch(() => (relinked = false))
        await invalidateProjects(qc)
        if (relinked) return
        // Recuperado, pero sin el repo: el aviso lo dice aquí y no se repite el genérico.
        notify.info(`«${name}» recuperado, sin ${repo}`, {
          description: 'Vuelve a vincularlo en GitHub: puede pedir el segundo factor.',
        })
        return false
      },
      undone: `«${name}» recuperado`,
      failTitle: 'No se pudo recuperar el proyecto',
    })
    return true
  } catch (err) {
    fail('No se pudo archivar el proyecto', err)
    return false
  }
}

/**
 * Elimina para siempre proyectos archivados (ADR-0065). No pregunta: los quita de la vista y espera lo que dura el
 * aviso; «Deshacer» los devuelve sin haber borrado nada. Si se cierra la app antes, no se borran.
 */
export function deleteArchivedWithUndo(
  m: Muninn,
  qc: QueryClient,
  projects: Pick<Project, 'id' | 'name'>[],
  view: { hide: (ids: string[]) => void; show: (ids: string[]) => void },
) {
  const ids = projects.map((p) => p.id)
  const title =
    projects.length === 1
      ? `«${projects[0]?.name}» eliminado`
      : `${projects.length} proyectos eliminados`
  const wait = 6000
  view.hide(ids)
  const timer = setTimeout(async () => {
    const failed: string[] = []
    for (const id of ids) await m.projects.delete(id).catch(() => failed.push(id))
    await invalidateProjects(qc)
    view.show(failed)
    if (failed.length)
      notify.error('No se pudo eliminar todo', {
        description: `Quedan ${failed.length} en Archivados.`,
      })
  }, wait)
  notify.success(title, {
    icon: 'trash',
    description: 'Con sus tareas. Las notas se quedan sin proyecto.',
    duration: wait,
    action: {
      label: 'Deshacer',
      onClick: () => {
        clearTimeout(timer)
        view.show(ids)
        notify.info(
          projects.length === 1
            ? 'Proyecto devuelto a Archivados'
            : 'Proyectos devueltos a Archivados',
        )
      },
    },
  })
}

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
    notifyUndo(`«${project.name}» guardado`, {
      icon: 'check',
      undo: async () => {
        await m.projects.update(before.id, {
          name: before.name,
          description: before.description,
          color: before.color,
        })
        await invalidateProjects(qc)
      },
      undone: 'Cambios deshechos',
    })
    return project
  } catch (err) {
    fail('No se pudo guardar el proyecto', err)
    return null
  }
}

/** Pone el logo o la portada (ya reducidos) o los quita (`null`), con «Deshacer» que vuelve al anterior. */
export async function setProjectImageWithUndo(
  m: Muninn,
  qc: QueryClient,
  project: Project,
  image: Blob | null,
  kind: ProjectImageKind,
) {
  const previous = (kind === 'cover' ? project.coverPath : project.imagePath) ?? null
  const what = kind === 'cover' ? 'Portada' : 'Logo'
  try {
    if (image) await m.projects.setImage(project.id, image, kind)
    else await m.projects.restoreImage(project.id, null, kind)
    await invalidateProjects(qc)
    notifyUndo(image ? `${what} actualizado` : `${what} quitado`, {
      icon: 'image',
      description: project.name,
      undo: async () => {
        await m.projects.restoreImage(project.id, previous, kind)
        await invalidateProjects(qc)
      },
      undone: `${what} como estaba`,
    })
    return true
  } catch (err) {
    fail(
      image
        ? `No se pudo subir: ${what.toLowerCase()}`
        : `No se pudo quitar: ${what.toLowerCase()}`,
      err,
    )
    return false
  }
}

/** Saca un proyecto de «Archivados», con «Deshacer» (lo vuelve a archivar). */
export async function unarchiveProjectWithUndo(m: Muninn, qc: QueryClient, project: Project) {
  try {
    await m.projects.update(project.id, { status: 'active' })
    await invalidateProjects(qc)
    notifyUndo(`«${project.name}» recuperado`, {
      icon: 'archive',
      undo: async () => {
        await m.projects.archive(project.id)
        await invalidateProjects(qc)
      },
      undone: [`«${project.name}» archivado`, { icon: 'archive' }],
      failTitle: 'No se pudo archivar el proyecto',
    })
  } catch (err) {
    fail('No se pudo recuperar el proyecto', err)
  }
}
