import type { BoardColumn, TaskWithColumn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import {
  applyColumnMove,
  applyTaskMove,
  type BoardData,
  colId,
  colKey,
  findColumn,
  groupByColumn,
  idsByColumn,
  indexInColumn,
  isColKey,
  isTabKey,
  moveAcross,
  tabId,
  tabKey,
} from '../src/lib/board'

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

const task = (id: string, columnId: string, kind: BoardColumn['kind']): TaskWithColumn => ({
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
  completedAt: kind === 'done' ? '2026-10-01T00:00:00Z' : null,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
  column: { id: columnId, name: columnId.toUpperCase(), kind },
})

const data = (): BoardData => ({
  columns: [col('a', 'todo'), col('b', 'in_progress'), col('c', 'done')],
  tasks: [
    task('a1', 'a', 'todo'),
    task('a2', 'a', 'todo'),
    task('b1', 'b', 'in_progress'),
    task('c1', 'c', 'done'),
  ],
  counts: {},
})

const order = (d: BoardData, columnId: string) =>
  d.tasks.filter((t) => t.columnId === columnId).map((t) => t.id)

describe('applyTaskMove', () => {
  it('coloca la tarea en el índice indicado de otra columna', () => {
    const d = applyTaskMove(data(), 'a1', 'b', 0)
    expect(order(d, 'a')).toEqual(['a2'])
    expect(order(d, 'b')).toEqual(['a1', 'b1'])
    expect(d.tasks.find((t) => t.id === 'a1')?.column.name).toBe('B')
  })

  it('sin índice, al final; en una columna vacía, la primera', () => {
    expect(order(applyTaskMove(data(), 'a1', 'b'), 'b')).toEqual(['b1', 'a1'])
    const empty = { ...data(), columns: [...data().columns, col('d', 'review')] }
    expect(order(applyTaskMove(empty, 'a1', 'd'), 'd')).toEqual(['a1'])
  })

  it('reordena dentro de la misma columna (el índice cuenta sin la propia tarea)', () => {
    const d = applyTaskMove(data(), 'a1', 'a', 1)
    expect(order(d, 'a')).toEqual(['a2', 'a1'])
  })

  it('entrar y salir de «hecho» fija y limpia completedAt', () => {
    const now = '2026-10-19T10:00:00Z'
    const done = applyTaskMove(data(), 'a1', 'c', 0, now)
    expect(done.tasks.find((t) => t.id === 'a1')?.completedAt).toBe(now)
    const back = applyTaskMove(done, 'c1', 'a')
    expect(back.tasks.find((t) => t.id === 'c1')?.completedAt).toBeNull()
  })

  it('un índice fuera de rango se acota y una tarea desconocida no cambia nada', () => {
    expect(order(applyTaskMove(data(), 'a1', 'b', 99), 'b')).toEqual(['b1', 'a1'])
    const d = data()
    expect(applyTaskMove(d, 'nada', 'b', 0)).toBe(d)
  })

  it('no muta la entrada', () => {
    const d = data()
    applyTaskMove(d, 'a1', 'b', 0)
    expect(order(d, 'a')).toEqual(['a1', 'a2'])
  })
})

describe('applyColumnMove', () => {
  it('mueve una columna (el índice cuenta las demás)', () => {
    expect(applyColumnMove(data(), 'c', 0).columns.map((c) => c.id)).toEqual(['c', 'a', 'b'])
    expect(applyColumnMove(data(), 'a', 2).columns.map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('agrupar', () => {
  it('agrupa por columna y conserva el orden', () => {
    const g = groupByColumn(data().columns, data().tasks)
    expect(Object.keys(g)).toEqual(['a', 'b', 'c'])
    expect(g.a?.map((t) => t.id)).toEqual(['a1', 'a2'])
  })

  it('indexInColumn', () => {
    expect(indexInColumn(data(), 'a2')).toBe(1)
    expect(indexInColumn(data(), 'x')).toBe(-1)
  })
})

describe('moveAcross (arrastre en vivo)', () => {
  const items = () => idsByColumn(groupByColumn(data().columns, data().tasks))

  it('pasa a otra columna encima de la tarjeta sobre la que está', () => {
    const r = moveAcross(items(), 'a1', 'b', 'b1', false)
    expect(r.a).toEqual(['a2'])
    expect(r.b).toEqual(['a1', 'b1'])
  })

  it('debajo de la tarjeta, si se pasa de su mitad', () => {
    expect(moveAcross(items(), 'a1', 'b', 'b1', true).b).toEqual(['b1', 'a1'])
  })

  it('sin tarjeta debajo (columna vacía o su pie), al final', () => {
    expect(moveAcross(items(), 'a1', 'c', null, false).c).toEqual(['c1', 'a1'])
  })

  it('findColumn localiza la columna', () => {
    expect(findColumn(items(), 'b1')).toBe('b')
    expect(findColumn(items(), 'x')).toBeUndefined()
  })

  it('una columna que no existe no cambia nada', () => {
    const i = items()
    expect(moveAcross(i, 'a1', 'zzz', null, false)).toBe(i)
  })
})

describe('ids de dnd-kit', () => {
  it('las columnas y las pestañas llevan prefijo y se distinguen de las tarjetas', () => {
    expect(isColKey(colKey('x'))).toBe(true)
    expect(colId(colKey('x'))).toBe('x')
    expect(isColKey('x')).toBe(false)
    expect(isTabKey(tabKey('x'))).toBe(true)
    expect(isTabKey(colKey('x'))).toBe(false)
    expect(tabId(tabKey('x'))).toBe('x')
  })
})
