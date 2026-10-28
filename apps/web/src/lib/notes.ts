import type { Note } from '@muninn/core'
import { plainText } from '../markdown/plain'
import { normalize } from './text'

/** Fijadas primero; dentro de cada grupo, la editada más recientemente arriba (como el core). */
export const byPinnedThenRecent = (a: Note, b: Note) =>
  Number(b.pinned) - Number(a.pinned) ||
  (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)

/** La lista con esta nota añadida o sustituida, en su sitio. */
export const putNote = (list: Note[], note: Note) =>
  [...list.filter((n) => n.id !== note.id), note].sort(byPinnedThenRecent)

export const removeNote = (list: Note[], id: string) => list.filter((n) => n.id !== id)

export interface NoteFilter {
  /** Búsqueda en el título y en el texto, sin distinguir mayúsculas ni tildes. */
  query: string
  pinned: boolean
  projectId: string | null
}

export const NO_FILTER: NoteFilter = { query: '', pinned: false, projectId: null }

export const isFiltering = (f: NoteFilter) => Boolean(f.query.trim() || f.pinned || f.projectId)

export function filterNotes(notes: Note[], f: NoteFilter): Note[] {
  const words = normalize(f.query).split(/\s+/).filter(Boolean)
  return notes.filter((n) => {
    if (f.pinned && !n.pinned) return false
    if (f.projectId && n.projectId !== f.projectId) return false
    if (words.length === 0) return true
    const hay = normalize(`${n.title}\n${n.content}`)
    return words.every((w) => hay.includes(w))
  })
}

/** Cuántas notas hay por proyecto (para los chips de filtro). */
export function countByProject(notes: Note[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const n of notes) if (n.projectId) out.set(n.projectId, (out.get(n.projectId) ?? 0) + 1)
  return out
}

/** Lo que se ve en la lista: el título, o «Sin título», y dos líneas de texto sin las marcas. */
export const noteTitle = (n: Pick<Note, 'title'>) => n.title.trim() || 'Sin título'
export const notePreview = (n: Pick<Note, 'content'>) => plainText(n.content, 180)
