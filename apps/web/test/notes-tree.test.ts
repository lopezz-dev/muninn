import type { Note } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import {
  ancestorsOf,
  buildSpaces,
  descendantIds,
  dropTarget,
  placeOf,
  spaceOf,
  treeNeighbours,
  zoneAt,
} from '../src/lib/notes-tree'

let n = 0
const note = (over: Partial<Note> = {}): Note => ({
  id: `n${++n}`,
  projectId: null,
  taskId: null,
  parentId: null,
  position: 'a0',
  kind: 'page',
  title: '',
  content: '',
  pinned: false,
  archivedAt: null,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
  ...over,
})

// General: a (a0) > [a1 (a0), a2 (a1) > [a21]], b (a1). Proyecto P: p (a0).
const a = note({ title: 'a', position: 'a0' })
const a2 = note({ title: 'a2', parentId: a.id, position: 'a1' })
const a1 = note({ title: 'a1', parentId: a.id, position: 'a0' })
const a21 = note({ title: 'a21', parentId: a2.id, position: 'a0' })
const b = note({ title: 'b', position: 'a1' })
const p = note({ title: 'p', projectId: 'P', position: 'a0' })
const all = [b, a21, a2, p, a1, a]

describe('árbol de notas', () => {
  it('reparte por espacios y ordena por posición', () => {
    const spaces = buildSpaces(all)
    const general = spaceOf(spaces, null)
    expect(general.roots.map((r) => r.note.title)).toEqual(['a', 'b'])
    expect(general.roots[0]?.children.map((c) => c.note.title)).toEqual(['a1', 'a2'])
    expect(spaceOf(spaces, 'P').roots.map((r) => r.note.title)).toEqual(['p'])
    expect(spaceOf(spaces, 'Q').roots).toEqual([])
  })

  it('una hija sin su madre en la lista sale en la raíz', () => {
    const orphan = note({ title: 'huérfana', parentId: 'no-está', position: 'a5' })
    expect(spaceOf(buildSpaces([a, orphan]), null).roots.map((r) => r.note.title)).toEqual([
      'a',
      'huérfana',
    ])
  })

  it('migas y descendientes', () => {
    expect(ancestorsOf(all, a21).map((x) => x.title)).toEqual(['a', 'a2'])
    expect(descendantIds(all, a.id).sort()).toEqual([a1.id, a2.id, a21.id].sort())
  })

  it('soltar antes, después o dentro', () => {
    expect(dropTarget(all, b, a1, 'before')).toEqual({ parentId: a.id, projectId: null, index: 0 })
    expect(dropTarget(all, b, a1, 'after')).toEqual({ parentId: a.id, projectId: null, index: 1 })
    expect(dropTarget(all, b, p, 'inside')).toEqual({ parentId: p.id, projectId: 'P' })
    // Reordenar entre hermanas: el índice no cuenta la que se mueve.
    expect(dropTarget(all, a1, a2, 'after')).toEqual({ parentId: a.id, projectId: null, index: 1 })
  })

  it('no deja soltar una nota dentro de sí misma ni de sus hijas', () => {
    expect(dropTarget(all, a, a, 'inside')).toBeNull()
    expect(dropTarget(all, a, a21, 'before')).toBeNull()
  })

  it('la zona sale del tercio de la fila', () => {
    const rect = { top: 100, height: 30 }
    expect(zoneAt(102, rect)).toBe('before')
    expect(zoneAt(115, rect)).toBe('inside')
    expect(zoneAt(128, rect)).toBe('after')
  })

  it('el sitio de una nota para deshacer', () => {
    expect(placeOf(all, a2)).toEqual({ parentId: a.id, projectId: null, index: 1 })
  })
})

describe('anterior y siguiente', () => {
  it('sigue el árbol de arriba abajo dentro del espacio', () => {
    expect(treeNeighbours(all, a2.id)).toEqual({ prev: a1, next: a21 })
    expect(treeNeighbours(all, a21.id)).toEqual({ prev: a2, next: b })
    expect(treeNeighbours(all, a.id)).toEqual({ prev: undefined, next: a1 })
    expect(treeNeighbours(all, p.id)).toEqual({ prev: undefined, next: undefined })
  })
})
