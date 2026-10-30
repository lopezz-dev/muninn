import type { Muninn } from '@muninn/core'
import { z } from 'zod'
import { type AnyTool, defineTool, previousOf } from './define'
import { limit, projectRef } from './shapes'
import { resolveProject } from './tasks'

const optionalProjectId = async (app: Muninn, ref: string | undefined) =>
  ref ? (await resolveProject(app, ref)).id : undefined

export const noteTools: AnyTool[] = [
  defineTool({
    name: 'list_notes',
    title: 'Buscar notas',
    description: 'Lista o busca notas, opcionalmente de un proyecto.',
    input: {
      project: projectRef.optional(),
      search: z.string().optional(),
      limit: limit(100),
    },
    access: 'read',
    module: 'notes',
    detail: (a) => a.search ?? a.project,
    run: async ({ app }, { project, search, limit: max }) =>
      app.notes.list({
        projectId: await optionalProjectId(app, project),
        search,
        limit: max ?? 50,
      }),
  }),
  defineTool({
    name: 'create_note',
    title: 'Crear nota',
    description: 'Crea una nota en Markdown, opcionalmente vinculada a un proyecto o tarea.',
    input: {
      title: z.string().optional(),
      content: z.string().describe('Markdown'),
      project: projectRef.optional(),
      taskId: z.uuid().optional(),
      pinned: z.boolean().optional(),
    },
    access: 'write',
    module: 'notes',
    detail: (a) => a.title,
    run: async ({ app, changed }, { project, ...rest }) => {
      const note = await app.notes.create({
        ...rest,
        projectId: await optionalProjectId(app, project),
      })
      changed({
        summary: `Nota «${note.title || 'Sin título'}» creada`,
        undo: (m) => m.notes.archive(note.id),
        target: { kind: 'note', id: note.id },
      })
      return note
    },
  }),
  defineTool({
    name: 'update_note',
    title: 'Editar nota',
    description: 'Cambia el título, el contenido o el fijado de una nota.',
    input: {
      noteId: z.uuid(),
      title: z.string().optional(),
      content: z.string().optional(),
      pinned: z.boolean().optional(),
    },
    access: 'write',
    module: 'notes',
    run: async ({ app, changed }, { noteId, ...patch }) => {
      const before = await app.notes.get(noteId)
      const note = await app.notes.update(noteId, patch)
      const previous = previousOf(before, patch, ['title', 'content', 'pinned'] as const)
      changed({
        summary: `Nota «${note.title || 'Sin título'}» editada`,
        undo: (m) => m.notes.update(noteId, previous),
        target: { kind: 'note', id: note.id },
      })
      return note
    },
  }),
]
