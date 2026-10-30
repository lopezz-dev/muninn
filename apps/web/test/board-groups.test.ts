import type { BoardColumn, TaskWithColumn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import type { BoardData } from '../src/lib/board'
import { NO_FILTER } from '../src/lib/board-filter'
import { boardGroups } from '../src/lib/board-groups'

const col = (id: string, kind: BoardColumn['kind']): BoardColumn => ({
  id,
  projectId: 'p',
  name: id.toUpperCase(),
  kind,
  color: null,
  wipLimit: null,
  position: id,
  createdAt: '',
  updatedAt: '',
})

const task = (
  id: string,
  columnId: string,
  kind: BoardColumn['kind'],
  extra: Partial<TaskWithColumn> = {},
): TaskWithColumn => ({
  id,
  projectId: 'p',
  columnId,
  title: id,
  description: '',
  priority: 'none',
  labels: [],
  dueDate: null,
  position: id,
  source: 'manual',
  externalId: null,
  externalUrl: null,
  completedAt: null,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
  column: { id: columnId, name: columnId.toUpperCase(), kind },
  ...extra,
})

const board: BoardData = {
  columns: [col('a', 'todo'), col('b', 'in_progress'), col('c', 'done')],
  tasks: [
    task('a1', 'a', 'todo', { priority: 'high' }),
    task('a2', 'a', 'todo'),
    task('b1', 'b', 'in_progress', { priority: 'high' }),
    task('b2', 'b', 'in_progress'),
  ],
  counts: {},
}

const TODAY = '2026-10-30'

const ids = (groups: Record<string, { id: string }[]>) =>
  Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((t) => t.id)]))

describe('boardGroups', () => {
  it('sin filtro, todas las tareas por columna (y sin agrupar dos veces)', () => {
    const g = boardGroups(board, NO_FILTER, TODAY)
    expect(g.filtering).toBe(false)
    expect(g.visible).toBe(board.tasks)
    expect(ids(g.groups)).toEqual({ a: ['a1', 'a2'], b: ['b1', 'b2'], c: [] })
    expect(g.groups).toBe(g.totals)
  })

  it('con filtro, `groups` solo lo que lo cumple y `totals` la columna entera', () => {
    const g = boardGroups(board, { ...NO_FILTER, priorities: ['high'] }, TODAY)
    expect(g.filtering).toBe(true)
    expect(g.visible.map((t) => t.id)).toEqual(['a1', 'b1'])
    expect(ids(g.groups)).toEqual({ a: ['a1'], b: ['b1'], c: [] })
    expect(ids(g.totals)).toEqual({ a: ['a1', 'a2'], b: ['b1', 'b2'], c: [] })
  })

  it('cada columna tiene su grupo aunque nada cumpla el filtro, y se respeta el orden', () => {
    const g = boardGroups(
      { columns: board.columns, tasks: [...board.tasks].reverse() },
      { ...NO_FILTER, query: 'zzz' },
      TODAY,
    )
    expect(g.visible).toEqual([])
    expect(ids(g.groups)).toEqual({ a: [], b: [], c: [] })
    expect(ids(g.totals).a).toEqual(['a2', 'a1'])
  })

  it('las tareas de una columna que no está en el tablero no se cuentan', () => {
    const g = boardGroups(
      { columns: board.columns, tasks: [...board.tasks, task('x1', 'x', 'todo')] },
      NO_FILTER,
      TODAY,
    )
    expect(Object.keys(g.totals)).toEqual(['a', 'b', 'c'])
    expect(g.visible).toHaveLength(5)
  })
})
