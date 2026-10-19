import type { CreateProjectInput, Muninn } from '@muninn/core'
import { notify } from '@muninn/ui'
import { type QueryClient, queryOptions } from '@tanstack/react-query'

/** Claves de react-query en un solo sitio: invalidar es predecible. */
export const keys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  columns: (projectId: string) => ['projects', projectId, 'columns'] as const,
  tasks: (projectId: string) => ['projects', projectId, 'tasks'] as const,
  overview: ['overview'] as const,
}

export const projectsQuery = (m: Muninn) =>
  queryOptions({ queryKey: keys.projects, queryFn: () => m.projects.list() })

export const projectQuery = (m: Muninn, id: string) =>
  queryOptions({ queryKey: keys.project(id), queryFn: () => m.projects.get(id), retry: false })

export const columnsQuery = (m: Muninn, projectId: string) =>
  queryOptions({ queryKey: keys.columns(projectId), queryFn: () => m.columns.list(projectId) })

export const tasksQuery = (m: Muninn, projectId: string) =>
  queryOptions({ queryKey: keys.tasks(projectId), queryFn: () => m.tasks.list({ projectId }) })

export const overviewQuery = (m: Muninn) =>
  queryOptions({ queryKey: keys.overview, queryFn: () => m.overview() })

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
