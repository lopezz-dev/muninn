import type { CreateNoteInput, Muninn, Note, UpdateNoteInput } from '@muninn/core'
import { type IconName, notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { notifyUndo } from './feedback'
import { fail, serial } from './mutations'
import { putNote, removeNote } from './notes'
import { invalidateNotes, noteKeys } from './notes-queries'
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
  let note: Note
  try {
    note = await m.notes.create(input)
  } catch (err) {
    fail('No se pudo crear la nota', err)
    return null
  }
  cacheNote(qc, note)
  void invalidateNotes(qc)
  notifyUndo('Nota creada', {
    icon: 'plus',
    undo: async () => {
      if (!(await archiveNote(m, qc, note, { undoing: true }))) return false
      opts.onUndo?.(note)
    },
    undone: ['Nota archivada', { icon: 'archive' }],
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
  patch: Pick<UpdateNoteInput, 'pinned' | 'projectId' | 'taskId'>,
  toast: PatchToast,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const prev = cached(qc, id)
  if (!prev) return false
  const before = {
    pinned: prev.pinned,
    projectId: prev.projectId,
    taskId: prev.taskId,
  } satisfies Pick<UpdateNoteInput, 'pinned' | 'projectId' | 'taskId'>
  // Cambiar de proyecto suelta la tarea: lo mismo que hace el core (reflejarlo ya evita un parpadeo).
  const optimisticPatch = {
    ...patch,
    ...(patch.projectId !== undefined &&
    patch.projectId !== prev.projectId &&
    patch.taskId === undefined
      ? { taskId: null }
      : {}),
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
    })
  } catch (err) {
    cacheNote(qc, { ...(cached(qc, id) ?? prev), ...before })
    fail('No se pudo guardar el cambio', err)
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
  qc.setQueryData<Note[]>(noteKeys.list, (l) => (l ? removeNote(l, note.id) : l))
  try {
    await serial(noteKey(note.id), () => m.notes.archive(note.id))
  } catch (err) {
    if (list) qc.setQueryData(noteKeys.list, list)
    fail('No se pudo archivar la nota', err)
    return false
  }
  void invalidateNotes(qc)
  if (opts.undoing) return true
  notifyUndo(`«${note.title.trim() || 'Sin título'}» archivada`, {
    icon: 'archive',
    undo: async () => {
      await serial(noteKey(note.id), () => m.notes.restore(note.id))
      void invalidateNotes(qc)
      opts.onUndo?.()
    },
    undone: ['Nota recuperada', { icon: 'archive' }],
    failTitle: 'No se pudo recuperar la nota',
  })
  return true
}

/** Recupera una nota archivada (desde su enlace). */
export async function restoreNote(m: Muninn, qc: QueryClient, id: string): Promise<boolean> {
  try {
    await serial(noteKey(id), () => m.notes.restore(id))
  } catch (err) {
    fail('No se pudo recuperar la nota', err)
    return false
  }
  void invalidateNotes(qc)
  notify.success('Nota recuperada', { icon: 'archive' })
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
