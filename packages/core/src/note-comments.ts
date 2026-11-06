import type { z } from 'zod'
import { ValidationError } from './errors'
import { buildAnchor, locateQuote, noteText, reanchor } from './note-text'
import {
  type ActorKind,
  type CommentQuery,
  type CreateCommentInput,
  commentQuery,
  createCommentInput,
  type EditCommentInput,
  editCommentInput,
  type Note,
  type NoteComment,
  type ReplyCommentInput,
  replyCommentInput,
} from './schemas'
import { NotFoundError, type Store } from './store'

/** Un hilo: el comentario que lo abre (con el ancla) y sus respuestas, de la más antigua a la más nueva. */
export interface CommentThread {
  root: NoteComment
  replies: NoteComment[]
}

/** Agrupa comentarios en hilos, en el orden en que se abrieron. Las respuestas sin su raíz en la lista se descartan. */
export function threads(comments: NoteComment[]): CommentThread[] {
  const out: CommentThread[] = []
  const byRoot = new Map<string, CommentThread>()
  const sorted = [...comments].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  )
  for (const c of sorted) {
    if (c.parentId === null) {
      const t = { root: c, replies: [] }
      byRoot.set(c.id, t)
      out.push(t)
    }
  }
  for (const c of sorted) if (c.parentId !== null) byRoot.get(c.parentId)?.replies.push(c)
  return out
}

/** Ids por petición del filtro de hilos (van en la URL de PostgREST, como en `inChunks`). */
const THREAD_CHUNK = 100

interface Deps {
  store: Store
  actor: ActorKind
  nowIso: () => string
  parse: <S extends z.ZodType>(schema: S, value: unknown) => z.output<S>
  log: (
    entityType: 'note',
    entityId: string,
    action: string,
    projectId: string | null,
    payload?: Record<string, unknown>,
  ) => Promise<unknown>
  getNote: (id: string) => Promise<Note>
}

/**
 * Comentarios de las notas (ADR-0079): hilos anclados a una cita del texto visible. El ancla la escribe el core (al crear y
 * al cambiar el contenido de la nota, con `reanchorNote`), así vale igual para la app, el asistente y el MCP. Sin borrado
 * definitivo: «Deshacer» archiva.
 */
export function createNoteComments({ store, actor, nowIso, parse, log, getNote }: Deps) {
  const get = async (id: string) => {
    const c = await store.noteComments.get(id)
    if (!c) throw new NotFoundError('Comentario', id)
    return c
  }

  /** La raíz del hilo de un comentario (él mismo si abre hilo). */
  const rootOf = async (id: string) => {
    const c = await get(id)
    return c.parentId ? get(c.parentId) : c
  }

  /** Hilos que cumplen el filtro, con todas sus respuestas no archivadas, en una lista plana por fecha. */
  async function list(query: CommentQuery = {}): Promise<NoteComment[]> {
    const q = parse(commentQuery, query)
    const roots = await store.noteComments.list({
      noteId: q.noteId,
      roots: true,
      forAgent: q.forAgent,
      status: q.status,
      includeArchived: q.includeArchived,
      limit: q.limit,
    })
    if (roots.length === 0) return []
    const ids = roots.map((r) => r.id)
    const replies: NoteComment[] = []
    for (let i = 0; i < ids.length; i += THREAD_CHUNK) {
      const chunk = await store.noteComments.list({
        threadIds: ids.slice(i, i + THREAD_CHUNK),
        includeArchived: q.includeArchived,
      })
      replies.push(...chunk.filter((c) => c.parentId !== null))
    }
    return [...roots, ...replies].sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    )
  }

  async function create(input: CreateCommentInput): Promise<NoteComment> {
    const data = parse(createCommentInput, input)
    const note = await getNote(data.noteId)
    if (note.archivedAt) throw new ValidationError('La nota está archivada')
    const text = noteText(note.content)
    const range = locateQuote(text, {
      quote: data.quote,
      prefix: data.prefix,
      suffix: data.suffix,
      occurrence: data.occurrence,
    })
    if (!range) throw new ValidationError('Ese texto no está en la nota')
    const comment = await store.noteComments.insert({
      noteId: note.id,
      parentId: null,
      body: data.body,
      anchor: buildAnchor(text, range),
      orphaned: false,
      forAgent: data.forAgent ?? false,
      resolvedAt: null,
      resolvedBy: null,
      actor,
      archivedAt: null,
    })
    await log('note', note.id, 'commented', note.projectId, {
      title: note.title,
      commentId: comment.id,
      forAgent: comment.forAgent,
    })
    return comment
  }

  async function reply(input: ReplyCommentInput): Promise<NoteComment> {
    const data = parse(replyCommentInput, input)
    const root = await rootOf(data.threadId)
    if (root.archivedAt) throw new ValidationError('Ese hilo está archivado')
    const note = await getNote(root.noteId)
    const comment = await store.noteComments.insert({
      noteId: root.noteId,
      parentId: root.id,
      body: data.body,
      anchor: null,
      orphaned: false,
      forAgent: false,
      resolvedAt: null,
      resolvedBy: null,
      actor,
      archivedAt: null,
    })
    await log('note', note.id, 'comment_replied', note.projectId, {
      title: note.title,
      commentId: comment.id,
      threadId: root.id,
    })
    return comment
  }

  async function edit(id: string, input: EditCommentInput): Promise<NoteComment> {
    const data = parse(editCommentInput, input)
    const c = await get(id)
    if (c.body === data.body) return c
    return store.noteComments.update(id, { body: data.body })
  }

  async function setResolved(id: string, resolved: boolean): Promise<NoteComment> {
    const root = await get(id)
    if (root.parentId) throw new ValidationError('Solo se resuelve un hilo, no una respuesta')
    if ((root.resolvedAt !== null) === resolved) return root
    const updated = await store.noteComments.update(
      id,
      resolved
        ? { resolvedAt: nowIso(), resolvedBy: actor }
        : { resolvedAt: null, resolvedBy: null },
    )
    const note = await getNote(root.noteId)
    await log('note', note.id, resolved ? 'comment_resolved' : 'comment_reopened', note.projectId, {
      title: note.title,
      commentId: id,
    })
    return updated
  }

  /** Archiva un comentario; si abre hilo, el hilo entero (con la misma fecha, para que `restore` sepa cuáles volver). */
  async function archive(id: string): Promise<NoteComment> {
    const c = await get(id)
    if (c.archivedAt) return c
    const at = nowIso()
    const archived = await store.noteComments.update(id, { archivedAt: at })
    if (c.parentId === null) {
      const replies = await store.noteComments.list({ threadIds: [id] })
      for (const r of replies)
        if (r.id !== id) await store.noteComments.update(r.id, { archivedAt: at })
    }
    return archived
  }

  /** Deshace `archive`: vuelve con las respuestas que se archivaron con él. */
  async function restore(id: string): Promise<NoteComment> {
    const c = await get(id)
    if (!c.archivedAt) return c
    if (c.parentId) {
      const root = await get(c.parentId)
      if (root.archivedAt) throw new ValidationError('Su hilo está archivado: restaura el hilo')
    }
    const at = c.archivedAt
    const restored = await store.noteComments.update(id, { archivedAt: null })
    if (c.parentId === null) {
      const all = await store.noteComments.list({ threadIds: [id], includeArchived: true })
      for (const r of all) {
        if (r.id !== id && r.archivedAt === at)
          await store.noteComments.update(r.id, { archivedAt: null })
      }
    }
    return restored
  }

  /**
   * Tras cambiar el contenido de una nota: vuelve a anclar sus hilos (abiertos y resueltos, no archivados). Solo escribe
   * los que cambian. Un hilo «Sin sitio» conserva su ancla vieja: si su texto vuelve, se reancla con él.
   */
  async function reanchorNote(noteId: string, before: string, after: string) {
    if (before === after) return
    const roots = await store.noteComments.list({ noteId, roots: true, status: 'all' })
    const anchored = roots.filter((r) => r.anchor)
    if (anchored.length === 0) return
    const oldText = noteText(before)
    const newText = noteText(after)
    if (oldText === newText) return
    for (const r of anchored) {
      const anchor = r.anchor as NonNullable<NoteComment['anchor']>
      // Huérfano: su ancla no es del texto de antes; se busca en el nuevo desde donde estaba.
      const result = reanchor(r.orphaned ? newText : oldText, newText, anchor)
      if (result.orphaned) {
        if (!r.orphaned) await store.noteComments.update(r.id, { orphaned: true })
        continue
      }
      const same =
        !r.orphaned &&
        anchor.start === result.anchor.start &&
        anchor.end === result.anchor.end &&
        anchor.quote === result.anchor.quote &&
        anchor.prefix === result.anchor.prefix &&
        anchor.suffix === result.anchor.suffix
      if (!same) await store.noteComments.update(r.id, { anchor: result.anchor, orphaned: false })
    }
  }

  return {
    list,
    get,
    create,
    reply,
    edit,
    resolve: (id: string) => setResolved(id, true),
    reopen: (id: string) => setResolved(id, false),
    archive,
    restore,
    /** Uso interno del core (`notes.update`); no lo llames desde la UI. */
    reanchorNote,
  }
}
