import type { Muninn, Note } from '@muninn/core'
import { z } from 'zod'
import { type AnyTool, defineTool, previousOf } from './define'
import { limit, projectRef } from './shapes'
import { resolveProject } from './tasks'

const optionalProjectId = async (app: Muninn, ref: string | undefined) =>
  ref ? (await resolveProject(app, ref)).id : undefined

/** El espacio de una herramienta (ADR-0083): un proyecto, «General» (`null`) o, sin decir nada, todos. */
const spaceOf = async (app: Muninn, project: string | undefined, general: boolean | undefined) =>
  general ? null : await optionalProjectId(app, project)

const kind = z
  .enum(['page', 'folder'])
  .describe('«folder» es una carpeta: una página que agrupa hijas. Por defecto, «page»')

/** Dónde está una nota ahora, para deshacer un movimiento devolviéndola ahí. */
async function placeOf(app: Muninn, note: Note) {
  const siblings = await app.notes.list({ projectId: note.projectId, parentId: note.parentId })
  return {
    parentId: note.parentId,
    projectId: note.projectId,
    index: Math.max(
      0,
      siblings.findIndex((n) => n.id === note.id),
    ),
  }
}

export const noteTools: AnyTool[] = [
  defineTool({
    name: 'list_notes',
    title: 'Buscar notas',
    description:
      'Lista o busca notas. Las notas forman un árbol con un espacio por proyecto (las sin proyecto, en «General»): ' +
      'con parentId devuelve un nivel (las hijas de esa nota, o la raíz con null) por orden.',
    input: {
      project: projectRef.optional(),
      general: z.boolean().optional().describe('Solo el espacio «General» (notas sin proyecto)'),
      parentId: z
        .uuid()
        .nullable()
        .optional()
        .describe('Hijas de esta nota; null = la raíz del espacio'),
      search: z.string().optional(),
      limit: limit(100),
    },
    access: 'read',
    module: 'notes',
    detail: (a) => a.search ?? a.project,
    run: async ({ app }, { project, general, parentId, search, limit: max }) =>
      app.notes.list({
        projectId: await spaceOf(app, project, general),
        parentId,
        search,
        limit: max ?? 50,
      }),
  }),
  defineTool({
    name: 'create_note',
    title: 'Crear nota',
    description:
      'Crea una nota en Markdown, opcionalmente vinculada a un proyecto o tarea, o como hija de otra nota (parentId: ' +
      'hereda su espacio). Sirve para repartir el contexto en una nota madre y sus hijas.',
    input: {
      title: z.string().optional(),
      content: z.string().describe('Markdown'),
      project: projectRef.optional(),
      taskId: z.uuid().optional(),
      parentId: z.uuid().optional().describe('Nota madre'),
      kind: kind.optional(),
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
    description:
      'Cambia el título, el contenido, el tipo (página o carpeta) o el fijado de una nota. Para cambiarla de sitio, move_note.',
    input: {
      noteId: z.uuid(),
      title: z.string().optional(),
      content: z.string().optional(),
      kind: kind.optional(),
      pinned: z.boolean().optional(),
    },
    access: 'write',
    module: 'notes',
    run: async ({ app, changed }, { noteId, ...patch }) => {
      const before = await app.notes.get(noteId)
      const note = await app.notes.update(noteId, patch)
      const previous = previousOf(before, patch, ['title', 'content', 'kind', 'pinned'] as const)
      changed({
        summary: `Nota «${note.title || 'Sin título'}» editada`,
        undo: (m) => m.notes.update(noteId, previous),
        target: { kind: 'note', id: note.id },
      })
      return note
    },
  }),
  defineTool({
    name: 'move_note',
    title: 'Mover nota',
    description:
      'Mueve una nota en el árbol, con todas sus hijas: bajo otra nota (parentId), a la raíz de un espacio ' +
      '(parentId null con project o general) o a otra posición entre sus hermanas (index, 0 = la primera).',
    input: {
      noteId: z.uuid(),
      parentId: z.uuid().nullable().optional().describe('Nueva madre; null = la raíz del espacio'),
      project: projectRef.optional().describe('Espacio de destino si va a la raíz'),
      general: z.boolean().optional().describe('A la raíz de «General» (sin proyecto)'),
      index: z.number().int().min(0).optional(),
    },
    access: 'write',
    module: 'notes',
    run: async ({ app, changed }, { noteId, parentId, project, general, index }) => {
      const before = await app.notes.get(noteId)
      const from = await placeOf(app, before)
      const note = await app.notes.move(noteId, {
        parentId,
        projectId: await spaceOf(app, project, general),
        index,
      })
      changed({
        summary: `Nota «${note.title || 'Sin título'}» movida`,
        undo: (m) => m.notes.move(noteId, from),
        target: { kind: 'note', id: note.id },
      })
      return note
    },
  }),
]
