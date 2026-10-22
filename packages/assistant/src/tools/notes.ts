import { z } from 'zod'
import { type AnyTool, defineTool } from './define'
import { resolveProject } from './tasks'

const projectRef = z
  .string()
  .min(1)
  .describe('Id del proyecto o su nombre (no distingue mayúsculas)')

export const noteTools: AnyTool[] = [
  defineTool({
    name: 'list_notes',
    title: 'Buscar notas',
    description: 'Lista o busca notas, opcionalmente de un proyecto.',
    input: {
      project: projectRef.optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    access: 'read',
    module: 'notes',
    detail: (a) => a.search ?? a.project,
    run: async ({ app }, { project, search, limit }) =>
      app.notes.list({
        projectId: project ? (await resolveProject(app, project)).id : undefined,
        search,
        limit: limit ?? 50,
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
        projectId: project ? (await resolveProject(app, project)).id : undefined,
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
      const previous = Object.fromEntries(
        (['title', 'content', 'pinned'] as const)
          .filter((k) => patch[k] !== undefined)
          .map((k) => [k, before[k]]),
      )
      changed({
        summary: `Nota «${note.title || 'Sin título'}» editada`,
        undo: (m) => m.notes.update(noteId, previous),
        target: { kind: 'note', id: note.id },
      })
      return note
    },
  }),
]
