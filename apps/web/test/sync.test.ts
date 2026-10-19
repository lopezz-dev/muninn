import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { type Change, createSync, scopesOf } from '../src/lib/sync'

const P = '11111111-1111-1111-1111-111111111111'

describe('qué refresca cada cambio', () => {
  const c = (table: Change['table'], row: Change['row'], old?: Change['old']): Change => ({
    table,
    row,
    old,
  })

  it('una tarea refresca el tablero de su proyecto y su propio detalle', () => {
    expect(scopesOf(c('tasks', { id: 't1', project_id: P }))).toEqual([`project:${P}`, 'task:t1'])
  })

  it('un borrado solo trae la clave: sin proyecto, se refrescan todos los tableros', () => {
    expect(scopesOf(c('board_columns', {}, { id: 'c1' }))).toEqual(['boards'])
    expect(scopesOf(c('tasks', {}, { id: 't1' }))).toEqual(['boards', 'task:t1'])
    expect(scopesOf(c('board_columns', {}, { id: 'c1', project_id: P }))).toEqual([`project:${P}`])
  })

  it('las subtareas mueven el progreso de los tableros y el detalle de su tarea', () => {
    expect(scopesOf(c('task_checklist_items', { id: 'i', task_id: 't9' }))).toEqual([
      'boards',
      'task:t9',
    ])
  })

  it('proyectos, notas y ajustes', () => {
    expect(scopesOf(c('projects', { id: P }))).toEqual(['projects', `project:${P}`])
    expect(scopesOf(c('notes', { id: 'n1' }))).toEqual(['notes', 'note:n1'])
    expect(scopesOf(c('user_settings', { owner_id: 'u' }))).toEqual(['settings'])
  })
})

describe('aplicar los cambios sobre la caché', () => {
  let qc: QueryClient
  let invalidate: MockInstance<QueryClient['invalidateQueries']>
  const keys = () => invalidate.mock.calls.map(([f]) => f?.queryKey as unknown[] | undefined)

  beforeEach(() => {
    vi.useFakeTimers()
    qc = new QueryClient()
    invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue()
  })
  afterEach(() => vi.useRealTimers())

  it('agrupa los cambios seguidos en un solo refresco', () => {
    const s = createSync(qc, { busy: () => false })
    s.handle({ table: 'tasks', row: { id: 't1', project_id: P } })
    s.handle({ table: 'tasks', row: { id: 't2', project_id: P } })
    vi.advanceTimersByTime(399)
    expect(invalidate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    const board = keys().filter((k) => k?.[1] === P)
    expect(board).toHaveLength(1)
    expect(keys()).toContainEqual(['tasks', 't1'])
    expect(keys()).toContainEqual(['tasks', 't2'])
  })

  it('no refresca un proyecto con escrituras propias en cola: espera a que se vacíe', () => {
    let busy = true
    const s = createSync(qc, { busy: (k) => busy && k === P })
    s.handle({ table: 'tasks', row: { id: 't1', project_id: P } })
    vi.advanceTimersByTime(400)
    // Lo de la tarea no depende de la cola del proyecto y ya se ha refrescado; el tablero, no.
    expect(keys().some((k) => k?.[1] === P)).toBe(false)
    vi.advanceTimersByTime(1200)
    expect(keys().some((k) => k?.[1] === P)).toBe(false)
    busy = false
    vi.advanceTimersByTime(400)
    expect(keys().some((k) => k?.[1] === P)).toBe(true)
    // Y no se repite.
    const n = invalidate.mock.calls.length
    vi.advanceTimersByTime(5000)
    expect(invalidate.mock.calls.length).toBe(n)
  })

  it('una nota con un guardado en cola espera; los ajustes también', () => {
    let busy = new Set(['note:n1', 'settings'])
    const s = createSync(qc, { busy: (k) => !!k && busy.has(k) })
    s.handle({ table: 'notes', row: { id: 'n1' } })
    s.handle({ table: 'user_settings', row: {} })
    vi.advanceTimersByTime(400)
    // `notes` (la lista) no tiene cola propia, `note:n1` y `settings` sí.
    expect(keys().some((k) => k?.[0] === 'settings')).toBe(false)
    busy = new Set()
    vi.advanceTimersByTime(400)
    expect(keys().some((k) => k?.[0] === 'settings')).toBe(true)
  })

  it('al reconectar se repone todo, cuando no hay escrituras en vuelo', () => {
    let busy = true
    const s = createSync(qc, { busy: () => busy })
    s.all()
    vi.advanceTimersByTime(400)
    expect(invalidate).not.toHaveBeenCalled()
    busy = false
    vi.advanceTimersByTime(400)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith()
  })

  it('tras `dispose` no hace nada', () => {
    const s = createSync(qc, { busy: () => false })
    s.handle({ table: 'notes', row: { id: 'n1' } })
    s.dispose()
    vi.advanceTimersByTime(2000)
    expect(invalidate).not.toHaveBeenCalled()
  })
})
