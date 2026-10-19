import type { Muninn, Note } from '@muninn/core'
import { type QueryClient, queryOptions } from '@tanstack/react-query'

/**
 * Consultas de notas. Aparte de `queries.ts` porque solo las usan pantallas diferidas (Notas, el detalle
 * de tarea): así no engordan el JS del arranque.
 */
export const noteKeys = {
  list: ['notes'] as const,
  one: (id: string) => ['notes', id] as const,
  /** Tareas de un proyecto, para vincularles una nota. */
  projectTasks: (projectId: string) => ['projects', projectId, 'tasks'] as const,
}

/** Todas las notas (sin archivar): la lista filtra y busca en el navegador. */
export const notesQuery = (m: Muninn) =>
  queryOptions({ queryKey: noteKeys.list, queryFn: () => m.notes.list({ limit: 500 }) })

/** Una nota. Parte de la lista si ya está en caché, para abrirse al instante. */
export const noteQuery = (m: Muninn, qc: QueryClient, id: string) =>
  queryOptions({
    queryKey: noteKeys.one(id),
    queryFn: () => m.notes.get(id),
    initialData: () => qc.getQueryData<Note[]>(noteKeys.list)?.find((n) => n.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(noteKeys.list)?.dataUpdatedAt,
    retry: false,
  })

export const projectTasksQuery = (m: Muninn, projectId: string) =>
  queryOptions({
    queryKey: noteKeys.projectTasks(projectId),
    queryFn: () => m.tasks.list({ projectId }),
  })

/** Las notas aparecen en su lista, en la de cada tarea y en cada nota abierta: se invalidan juntas. */
export const invalidateNotes = (qc: QueryClient) =>
  qc.invalidateQueries({
    predicate: (q) =>
      q.queryKey[0] === 'notes' || (q.queryKey[0] === 'tasks' && q.queryKey[2] === 'notes'),
  })
