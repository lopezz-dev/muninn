import type { ActorKind, CreateCommentInput, Muninn, NoteComment } from '@muninn/core'
import type { QueryClient } from '@tanstack/react-query'
import { queryOptions } from '@tanstack/react-query'
import { t } from '../i18n'
import { notifyUndo } from './feedback'
import { fail, serial } from './mutations'

/**
 * Comentarios de las notas (ADR-0079): consultas y acciones con feedback y «Deshacer» (ADR-0019). Las escrituras de una
 * nota van en su cola (`comments:<noteId>`), la misma que mira el tiempo real para no refrescar a medias.
 */

export const commentKeys = {
  /** Los hilos de una nota, abiertos, resueltos y sin sitio (sin los archivados). */
  note: (noteId: string) => ['notes', noteId, 'comments'] as const,
}

export const noteCommentsQuery = (m: Muninn, noteId: string) =>
  queryOptions({
    queryKey: commentKeys.note(noteId),
    queryFn: () => m.comments.list({ noteId, status: 'all', limit: 500 }),
  })

const queue = (noteId: string) => `comments:${noteId}`

/** Pone o quita un comentario en la caché de su nota al instante. */
function put(qc: QueryClient, c: NoteComment) {
  qc.setQueryData<NoteComment[]>(commentKeys.note(c.noteId), (list) => {
    if (!list) return list
    const rest = list.filter((x) => x.id !== c.id)
    // Archivar un hilo se lleva sus respuestas.
    if (c.archivedAt) return rest.filter((x) => x.parentId !== c.id)
    return [...rest, c]
  })
}
const refresh = (qc: QueryClient, noteId: string) =>
  qc.invalidateQueries({ queryKey: commentKeys.note(noteId) })

/** Quién escribe un comentario, para pintarlo: «Tú», «Claude» (el MCP o un agente) o el asistente de la app. */
export function authorOf(actor: ActorKind): 'you' | 'claude' | 'assistant' | 'muninn' {
  if (actor === 'user') return 'you'
  if (actor === 'mcp' || actor === 'agent') return 'claude'
  if (actor === 'assistant') return 'assistant'
  return 'muninn'
}

/** Abre un hilo sobre una cita. «Deshacer» lo archiva. Devuelve el comentario o `null`. */
export async function createComment(
  m: Muninn,
  qc: QueryClient,
  input: CreateCommentInput,
): Promise<NoteComment | null> {
  let c: NoteComment
  try {
    c = await serial(queue(input.noteId), () => m.comments.create(input))
  } catch (err) {
    fail(t('comments.toast.createFailed', { ns: 'notes' }), err)
    return null
  }
  put(qc, c)
  void refresh(qc, c.noteId)
  notifyUndo(
    input.forAgent
      ? t('comments.toast.createdForClaude', { ns: 'notes' })
      : t('comments.toast.created', { ns: 'notes' }),
    {
      icon: 'check',
      undo: async () => {
        const archived = await serial(queue(c.noteId), () => m.comments.archive(c.id))
        put(qc, archived)
        void refresh(qc, c.noteId)
      },
      undone: t('comments.toast.removed', { ns: 'notes' }),
    },
  )
  return c
}

/** Responde en un hilo. «Deshacer» archiva la respuesta. */
export async function replyComment(
  m: Muninn,
  qc: QueryClient,
  thread: NoteComment,
  body: string,
): Promise<boolean> {
  let c: NoteComment
  try {
    c = await serial(queue(thread.noteId), () => m.comments.reply({ threadId: thread.id, body }))
  } catch (err) {
    fail(t('comments.toast.replyFailed', { ns: 'notes' }), err)
    return false
  }
  put(qc, c)
  void refresh(qc, c.noteId)
  notifyUndo(t('comments.toast.replied', { ns: 'notes' }), {
    icon: 'send',
    undo: async () => {
      put(qc, await serial(queue(c.noteId), () => m.comments.archive(c.id)))
      void refresh(qc, c.noteId)
    },
    undone: t('comments.toast.removed', { ns: 'notes' }),
  })
  return true
}

/** Resuelve un hilo o lo reabre; «Deshacer» hace lo contrario. */
export async function setResolved(
  m: Muninn,
  qc: QueryClient,
  thread: NoteComment,
  resolved: boolean,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const run = () => (resolved ? m.comments.resolve(thread.id) : m.comments.reopen(thread.id))
  // Al instante en pantalla: resolver lo saca del texto sin esperar a la red.
  const prev = qc.getQueryData<NoteComment[]>(commentKeys.note(thread.noteId))
  put(qc, {
    ...thread,
    resolvedAt: resolved ? new Date().toISOString() : null,
    resolvedBy: resolved ? 'user' : null,
  })
  let c: NoteComment
  try {
    c = await serial(queue(thread.noteId), run)
  } catch (err) {
    qc.setQueryData(commentKeys.note(thread.noteId), prev)
    fail(
      resolved
        ? t('comments.toast.resolveFailed', { ns: 'notes' })
        : t('comments.toast.reopenFailed', { ns: 'notes' }),
      err,
    )
    return false
  }
  put(qc, c)
  void refresh(qc, c.noteId)
  if (opts.undoing) return true
  notifyUndo(
    resolved
      ? t('comments.toast.resolved', { ns: 'notes' })
      : t('comments.toast.reopened', { ns: 'notes' }),
    {
      icon: 'check',
      undo: () => setResolved(m, qc, c, !resolved, { undoing: true }),
      undone: resolved
        ? t('comments.toast.reopened', { ns: 'notes' })
        : t('comments.toast.resolved', { ns: 'notes' }),
    },
  )
  return true
}

/** Quita un hilo entero (lo archiva: no se borra). «Deshacer» lo recupera. */
export async function archiveThread(
  m: Muninn,
  qc: QueryClient,
  thread: NoteComment,
): Promise<boolean> {
  const prev = qc.getQueryData<NoteComment[]>(commentKeys.note(thread.noteId))
  put(qc, { ...thread, archivedAt: new Date().toISOString() })
  try {
    await serial(queue(thread.noteId), () => m.comments.archive(thread.id))
  } catch (err) {
    qc.setQueryData(commentKeys.note(thread.noteId), prev)
    fail(t('comments.toast.archiveFailed', { ns: 'notes' }), err)
    return false
  }
  void refresh(qc, thread.noteId)
  notifyUndo(t('comments.toast.archived', { ns: 'notes' }), {
    icon: 'archive',
    undo: async () => {
      await serial(queue(thread.noteId), () => m.comments.restore(thread.id))
      void refresh(qc, thread.noteId)
    },
    undone: t('comments.toast.restored', { ns: 'notes' }),
  })
  return true
}
