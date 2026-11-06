import { type Muninn, type NoteComment, threads } from '@muninn/core'
import { z } from 'zod'
import { type AnyTool, defineTool } from './define'

// Comentarios de las notas (ADR-0079). Un hilo marcado «Para Claude» (forAgent) es un encargo para un agente.

const FLOW =
  'Encargos «Para Claude»: list_note_comments con forAgent: true; lee la nota (list_notes / su id), haz el cambio con ' +
  'update_note (los comentarios se vuelven a anclar solos), contesta en el hilo con reply_to_comment qué has hecho y ' +
  'ciérralo con resolve_comment. Si no está claro o no puedes, pregunta en el hilo y déjalo abierto.'

/** Un hilo como lo ve el modelo: la cita, su estado y los comentarios en orden. */
async function threadsOut(app: Muninn, comments: NoteComment[]) {
  const titles = new Map<string, string>()
  for (const id of new Set(comments.map((c) => c.noteId))) {
    const note = await app.notes.get(id).catch(() => null)
    titles.set(id, note ? note.title || 'Sin título' : '(nota no encontrada)')
  }
  return threads(comments).map(({ root, replies }) => ({
    id: root.id,
    noteId: root.noteId,
    noteTitle: titles.get(root.noteId),
    quote: root.anchor?.quote ?? null,
    orphaned: root.orphaned,
    forAgent: root.forAgent,
    resolvedAt: root.resolvedAt,
    resolvedBy: root.resolvedBy,
    comments: [root, ...replies].map((c) => ({
      id: c.id,
      actor: c.actor,
      body: c.body,
      createdAt: c.createdAt,
    })),
  }))
}

const snippet = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s)

export const commentTools: AnyTool[] = [
  defineTool({
    name: 'list_note_comments',
    title: 'Ver comentarios de notas',
    description:
      'Hilos de comentarios de una nota (noteId) o de todas: cada uno con la cita comentada (quote), si se quedó sin sitio ' +
      'porque la cita ya no está (orphaned), si es un encargo «Para Claude» (forAgent) y sus comentarios en orden. Por ' +
      `defecto, los abiertos. ${FLOW}`,
    input: {
      noteId: z.uuid().optional(),
      status: z
        .enum(['open', 'resolved', 'all'])
        .optional()
        .describe('open (por defecto), resolved o all'),
      forAgent: z.boolean().optional().describe('true: solo los encargos «Para Claude»'),
    },
    access: 'read',
    module: 'notes',
    run: async ({ app }, { noteId, status, forAgent }) =>
      threadsOut(app, await app.comments.list({ noteId, status, forAgent, limit: 200 })),
  }),
  defineTool({
    name: 'comment_on_note',
    title: 'Comentar una nota',
    description:
      'Abre un hilo sobre un trozo de una nota. quote es el texto tal como se lee (sin marcas de Markdown: «negrita», no ' +
      '«**negrita**»); si aparece varias veces, occurrence dice cuál (1 = la primera). No cambia la nota.',
    input: {
      noteId: z.uuid(),
      quote: z.string().min(1).describe('Texto comentado, tal como se lee'),
      occurrence: z.number().int().min(1).optional(),
      body: z.string().min(1).describe('El comentario (Markdown en línea)'),
      forAgent: z.boolean().optional().describe('Marcarlo como encargo «Para Claude»'),
    },
    access: 'write',
    module: 'notes',
    detail: (a) => snippet(a.quote),
    run: async ({ app, changed }, args) => {
      const comment = await app.comments.create(args)
      changed({
        summary: `Comentario en «${snippet(args.quote)}»`,
        undo: (m) => m.comments.archive(comment.id),
        target: { kind: 'note', id: comment.noteId },
      })
      return comment
    },
  }),
  defineTool({
    name: 'reply_to_comment',
    title: 'Responder un comentario',
    description:
      'Responde en un hilo de comentarios (threadId: el id del hilo de list_note_comments). Úsalo para contar qué has ' +
      'hecho con un encargo o para preguntar si algo no está claro.',
    input: {
      threadId: z.uuid(),
      body: z.string().min(1).describe('La respuesta (Markdown en línea)'),
    },
    access: 'write',
    module: 'notes',
    run: async ({ app, changed }, args) => {
      const reply = await app.comments.reply(args)
      changed({
        summary: 'Respuesta en un hilo de comentarios',
        undo: (m) => m.comments.archive(reply.id),
        target: { kind: 'note', id: reply.noteId },
      })
      return reply
    },
  }),
  defineTool({
    name: 'resolve_comment',
    title: 'Resolver un comentario',
    description:
      'Da por resuelto un hilo de comentarios (resolved: true, por defecto) o lo reabre (resolved: false). Resuelve un ' +
      'encargo solo cuando esté hecho; si queda algo pendiente, contesta en el hilo y déjalo abierto.',
    input: {
      threadId: z.uuid(),
      resolved: z.boolean().optional().describe('false para reabrirlo'),
    },
    access: 'write',
    module: 'notes',
    idempotent: true,
    run: async ({ app, changed }, { threadId, resolved }) => {
      const close = resolved ?? true
      const thread = close
        ? await app.comments.resolve(threadId)
        : await app.comments.reopen(threadId)
      changed({
        summary: close ? 'Hilo de comentarios resuelto' : 'Hilo de comentarios reabierto',
        undo: (m) => (close ? m.comments.reopen(threadId) : m.comments.resolve(threadId)),
        target: { kind: 'note', id: thread.noteId },
      })
      return thread
    },
  }),
]
