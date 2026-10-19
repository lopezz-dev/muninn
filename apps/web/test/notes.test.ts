import type { Note } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import {
  byPinnedThenRecent,
  countByProject,
  filterNotes,
  isFiltering,
  NO_FILTER,
  noteTitle,
  putNote,
  removeNote,
} from '../src/lib/notes'

let n = 0
const note = (over: Partial<Note> = {}): Note => ({
  id: `n${++n}`,
  projectId: null,
  taskId: null,
  title: '',
  content: '',
  pinned: false,
  archivedAt: null,
  createdAt: '2026-10-19T10:00:00.000Z',
  updatedAt: '2026-10-19T10:00:00.000Z',
  ...over,
})

describe('orden', () => {
  it('fijadas primero y, dentro de cada grupo, la más reciente arriba', () => {
    const a = note({ updatedAt: '2026-10-19T09:00:00.000Z' })
    const b = note({ updatedAt: '2026-10-19T11:00:00.000Z' })
    const c = note({ pinned: true, updatedAt: '2026-10-19T08:00:00.000Z' })
    expect([a, b, c].sort(byPinnedThenRecent).map((x) => x.id)).toEqual([c.id, b.id, a.id])
  })

  it('putNote sustituye por id y recoloca; removeNote la quita', () => {
    const a = note({ updatedAt: '2026-10-19T09:00:00.000Z' })
    const b = note({ updatedAt: '2026-10-19T11:00:00.000Z' })
    const edited = { ...a, updatedAt: '2026-10-19T12:00:00.000Z' }
    expect(putNote([b, a], edited).map((x) => x.id)).toEqual([a.id, b.id])
    expect(putNote([b], a)).toHaveLength(2)
    expect(removeNote([a, b], a.id)).toEqual([b])
  })
})

describe('filtros', () => {
  const p1 = 'p1'
  const notes = [
    note({ title: 'Decisiones de diseño', content: 'Radios de 4px', projectId: p1, pinned: true }),
    note({ title: 'Ideas', content: 'Voz con Whisper', projectId: 'p2' }),
    note({ title: '', content: 'Teléfono del gestor' }),
  ]

  it('busca en título y texto, sin mayúsculas ni tildes, con todas las palabras', () => {
    const f = (query: string) => filterNotes(notes, { ...NO_FILTER, query }).map((x) => x.title)
    expect(f('DISEÑO')).toEqual(['Decisiones de diseño'])
    expect(f('disenos')).toEqual([])
    expect(f('diseno radios')).toEqual(['Decisiones de diseño'])
    expect(f('telefono')).toEqual([''])
    expect(f('whisper ideas')).toEqual(['Ideas'])
    expect(f('')).toHaveLength(3)
  })

  it('fijadas y proyecto se combinan', () => {
    expect(filterNotes(notes, { ...NO_FILTER, pinned: true })).toHaveLength(1)
    expect(filterNotes(notes, { ...NO_FILTER, projectId: 'p2' }).map((x) => x.title)).toEqual([
      'Ideas',
    ])
    expect(filterNotes(notes, { query: '', pinned: true, projectId: 'p2' })).toEqual([])
  })

  it('isFiltering ignora los espacios', () => {
    expect(isFiltering(NO_FILTER)).toBe(false)
    expect(isFiltering({ ...NO_FILTER, query: '   ' })).toBe(false)
    expect(isFiltering({ ...NO_FILTER, pinned: true })).toBe(true)
  })

  it('cuenta las notas por proyecto', () => {
    expect([...countByProject(notes)]).toEqual([
      ['p1', 1],
      ['p2', 1],
    ])
  })

  it('una nota sin título se llama «Sin título»', () => {
    expect(noteTitle({ title: '  ' })).toBe('Sin título')
    expect(noteTitle({ title: 'Hola' })).toBe('Hola')
  })
})
