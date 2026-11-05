import {
  type CreateNoteInput,
  type Muninn,
  type Note,
  positionAt,
  type UpdateNoteInput,
} from '@muninn/core'
import { type IconName, notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { i18n, t } from '../i18n'
import { notifyUndo } from './feedback'
import { fail, serial } from './mutations'
import { noteTitle, putNote } from './notes'
import { invalidateNotes, noteKeys } from './notes-queries'
import { descendantIds, type MoveTarget, placeOf } from './notes-tree'
import { keys } from './queries'

/**
 * Acciones sobre notas, con feedback y «Deshacer» (ADR-0019). Como en el tablero, reflejan el cambio en
 * la caché al instante y escriben en el core, de una en una por nota (`serial`), para que dos cambios
 * seguidos lleguen en orden. El texto y el título van aparte: los guarda el editor con su autoguardado
 * (`useNoteDraft`) y no avisan en cada guardado.
 */

const noteKey = (id: string) => `note:${id}`

/** Pone una nota (la respuesta del servidor, o un cambio optimista) en la lista y en su propia entrada. */
export function cacheNote(qc: QueryClient, note: Note) {
  qc.setQueryData<Note[]>(noteKeys.list, (list) => (list ? putNote(list, note) : list))
  qc.setQueryData(noteKeys.one(note.id), note)
  if (note.taskId) void qc.invalidateQueries({ queryKey: keys.taskNotes(note.taskId) })
}

const cached = (qc: QueryClient, id: string) =>
  qc.getQueryData<Note>(noteKeys.one(id)) ??
  qc.getQueryData<Note[]>(noteKeys.list)?.find((n) => n.id === id)

/** Crea una nota. «Deshacer» la archiva (la UI no borra notas). Devuelve la nota o `null`. */
export async function createNote(
  m: Muninn,
  qc: QueryClient,
  input: CreateNoteInput = {},
  opts: { onUndo?: (note: Note) => void } = {},
): Promise<Note | null> {
  // Se crea también desde el buscador, una tarea o Noticias: sin la pantalla de Notas, el namespace aún no está.
  await i18n.loadNamespaces('notes')
  let note: Note
  try {
    note = await m.notes.create(input)
  } catch (err) {
    fail(t('toast.createFailed', { ns: 'notes' }), err)
    return null
  }
  cacheNote(qc, note)
  void invalidateNotes(qc)
  notifyUndo(t('toast.created', { ns: 'notes' }), {
    icon: 'plus',
    undo: async () => {
      if (!(await archiveNote(m, qc, note, { undoing: true }))) return false
      opts.onUndo?.(note)
    },
    undone: [t('toast.archived', { ns: 'notes' }), { icon: 'archive' }],
  })
  return note
}

export interface PatchToast {
  message: string
  icon?: IconName
}

/**
 * Cambia fijada, proyecto o tarea de una nota. «Deshacer» devuelve los valores que tenía. `undoing`
 * evita encadenar un «Deshacer» sobre otro.
 */
export async function patchNote(
  m: Muninn,
  qc: QueryClient,
  id: string,
  patch: Pick<UpdateNoteInput, 'pinned' | 'projectId' | 'taskId' | 'kind'>,
  toast: PatchToast,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const prev = cached(qc, id)
  if (!prev) return false
  const before = {
    pinned: prev.pinned,
    projectId: prev.projectId,
    taskId: prev.taskId,
    kind: prev.kind,
  } satisfies Pick<UpdateNoteInput, 'pinned' | 'projectId' | 'taskId' | 'kind'>
  // Cambiar de proyecto suelta la tarea: lo mismo que hace el core (reflejarlo ya evita un parpadeo).
  const otherSpace = patch.projectId !== undefined && patch.projectId !== prev.projectId
  // Otro espacio: sale de su madre a la raíz y se lleva sus hijas (ADR-0083), como hace el core.
  const optimisticPatch = {
    ...patch,
    ...(otherSpace && patch.taskId === undefined ? { taskId: null } : {}),
    ...(otherSpace ? { parentId: null } : {}),
  }
  cacheNote(qc, { ...prev, ...optimisticPatch })
  try {
    const saved = await serial(noteKey(id), () => m.notes.update(id, patch))
    // El servidor decide el proyecto cuando hay tarea; solo se toman de él los campos del cambio.
    const now = cached(qc, id) ?? saved
    cacheNote(qc, {
      ...now,
      pinned: saved.pinned,
      projectId: saved.projectId,
      taskId: saved.taskId,
      kind: saved.kind,
      parentId: saved.parentId,
      position: saved.position,
    })
    if (otherSpace) void invalidateNotes(qc)
  } catch (err) {
    cacheNote(qc, { ...(cached(qc, id) ?? prev), ...before })
    fail(t('toast.changeFailed', { ns: 'notes' }), err)
    return false
  }
  if (opts.undoing) return true
  notifyUndo(toast.message, {
    icon: toast.icon,
    id: `note-${id}`,
    undo: () => patchNote(m, qc, id, before, toast, { undoing: true }),
  })
  return true
}

/** Archiva (la quita de la lista). «Deshacer» la recupera. */
export async function archiveNote(
  m: Muninn,
  qc: QueryClient,
  note: Pick<Note, 'id' | 'title'>,
  opts: { undoing?: boolean; onUndo?: () => void } = {},
): Promise<boolean> {
  const list = qc.getQueryData<Note[]>(noteKeys.list)
  // Archivar una página archiva sus hijas (ADR-0083): fuera de la lista todas a la vez.
  const gone = new Set([note.id, ...(list ? descendantIds(list, note.id) : [])])
  qc.setQueryData<Note[]>(noteKeys.list, (l) => (l ? l.filter((n) => !gone.has(n.id)) : l))
  try {
    await serial(noteKey(note.id), () => m.notes.archive(note.id))
  } catch (err) {
    if (list) qc.setQueryData(noteKeys.list, list)
    fail(t('toast.archiveFailed', { ns: 'notes' }), err)
    return false
  }
  void invalidateNotes(qc)
  if (opts.undoing) return true
  notifyUndo(t('toast.archivedNamed', { ns: 'notes', title: noteTitle(note) }), {
    icon: 'archive',
    undo: async () => {
      await serial(noteKey(note.id), () => m.notes.restore(note.id))
      void invalidateNotes(qc)
      opts.onUndo?.()
    },
    undone: [t('toast.restored', { ns: 'notes' }), { icon: 'archive' }],
    failTitle: t('toast.restoreFailed', { ns: 'notes' }),
  })
  return true
}

/** Recupera una nota archivada (desde su enlace). */
export async function restoreNote(m: Muninn, qc: QueryClient, id: string): Promise<boolean> {
  try {
    await serial(noteKey(id), () => m.notes.restore(id))
  } catch (err) {
    fail(t('toast.restoreFailed', { ns: 'notes' }), err)
    return false
  }
  void invalidateNotes(qc)
  notify.success(t('toast.restored', { ns: 'notes' }), { icon: 'archive' })
  return true
}

/** Guarda el título y el texto (autoguardado del editor). Sin aviso: el editor muestra «Guardado». */
export async function saveNoteText(
  m: Muninn,
  qc: QueryClient,
  id: string,
  text: { title: string; content: string },
): Promise<Note> {
  const saved = await serial(noteKey(id), () => m.notes.update(id, text))
  // Lo que escribiste después de enviar esto sigue en el editor; en caché va lo confirmado.
  cacheNote(qc, saved)
  return saved
}

/**
 * Mueve una nota en el árbol (a otra madre, a la raíz de un espacio o entre sus hermanas) con todo su subárbol.
 * «Deshacer» la devuelve a donde estaba.
 */
export async function moveNote(
  m: Muninn,
  qc: QueryClient,
  id: string,
  target: MoveTarget,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const list = qc.getQueryData<Note[]>(noteKeys.list)
  const prev = list?.find((n) => n.id === id) ?? cached(qc, id)
  if (!prev) return false
  const from = list ? placeOf(list, prev) : { parentId: prev.parentId, projectId: prev.projectId }
  // Optimista: la nota en su sitio nuevo y sus hijas en el espacio nuevo; el servidor confirma la posición.
  if (list) {
    const siblings = list
      .filter(
        (n) => n.id !== id && n.parentId === target.parentId && n.projectId === target.projectId,
      )
      .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
    const { position } = positionAt(siblings, target.index)
    const inside = new Set(descendantIds(list, id))
    qc.setQueryData<Note[]>(noteKeys.list, (l) =>
      l?.map((n) =>
        n.id === id
          ? { ...n, parentId: target.parentId, projectId: target.projectId, position }
          : inside.has(n.id)
            ? { ...n, projectId: target.projectId }
            : n,
      ),
    )
  }
  try {
    const saved = await serial(noteKey(id), () => m.notes.move(id, target))
    cacheNote(qc, saved)
  } catch (err) {
    if (list) qc.setQueryData(noteKeys.list, list)
    fail(t('toast.moveFailed', { ns: 'notes' }), err)
    return false
  }
  void invalidateNotes(qc)
  if (opts.undoing) return true
  notifyUndo(t('toast.moved', { ns: 'notes', title: noteTitle(prev) }), {
    icon: 'move',
    id: `note-move-${id}`,
    undo: () => moveNote(m, qc, id, from, { undoing: true }),
  })
  return true
}
