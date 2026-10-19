import type { TaskWithColumn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import {
  activeGroups,
  dueBucket,
  filterTasks,
  fullIndex,
  labelsOf,
  NO_FILTER,
  toggle,
} from '../src/lib/board-filter'

const TODAY = '2026-10-19'
let n = 0
const task = (over: Partial<TaskWithColumn> = {}): TaskWithColumn => ({
  id: `t${++n}`,
  projectId: 'p',
  columnId: 'c',
  title: 'Tarea',
  description: '',
  priority: 'none',
  labels: [],
  dueDate: null,
  position: 'a0',
  source: 'manual',
  externalId: null,
  externalUrl: null,
  completedAt: null,
  archivedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  column: { id: 'c', name: 'Pendiente', kind: 'todo' },
  ...over,
})

describe('vencimiento', () => {
  it('cae en un cajón; una tarea hecha nunca está vencida', () => {
    const open = (dueDate: string | null) => dueBucket(task({ dueDate }), TODAY)
    expect(open(null)).toBe('none')
    expect(open('2026-10-18')).toBe('overdue')
    expect(open(TODAY)).toBe('today')
    expect(open('2026-10-26')).toBe('week')
    expect(open('2026-10-27')).toBe('later')
    const done = task({ dueDate: '2026-10-01', column: { id: 'd', name: 'Hecho', kind: 'done' } })
    expect(dueBucket(done, TODAY)).toBe('later')
  })
})

describe('filtrar', () => {
  const tasks = [
    task({ title: 'Login con Supabase', labels: ['auth'], priority: 'high', dueDate: TODAY }),
    task({ title: 'Diseño del dock', description: 'menisco y cristal', labels: ['UI', 'diseño'] }),
    task({ title: 'Sync de issues', labels: ['github'], source: 'github', dueDate: '2026-10-10' }),
    task({ title: 'Idea', source: 'mcp', priority: 'low' }),
  ]
  const f = (over: Partial<typeof NO_FILTER>) =>
    filterTasks(tasks, { ...NO_FILTER, ...over }, TODAY).map((t) => t.title)

  it('sin filtro devuelve las mismas tareas', () => {
    expect(filterTasks(tasks, NO_FILTER, TODAY)).toBe(tasks)
    expect(activeGroups(NO_FILTER)).toBe(0)
  })

  it('texto: título, descripción y etiquetas, sin tildes ni mayúsculas, con todas las palabras', () => {
    expect(f({ query: 'DISENO' })).toEqual(['Diseño del dock'])
    expect(f({ query: 'menisco cristal' })).toEqual(['Diseño del dock'])
    expect(f({ query: 'auth supabase' })).toEqual(['Login con Supabase'])
    expect(f({ query: 'xyz' })).toEqual([])
  })

  it('dentro de un grupo vale cualquiera; entre grupos, todos', () => {
    expect(f({ priorities: ['high', 'low'] })).toEqual(['Login con Supabase', 'Idea'])
    expect(f({ priorities: ['high', 'low'], sources: ['mcp'] })).toEqual(['Idea'])
    expect(f({ labels: ['ui'] })).toEqual(['Diseño del dock'])
    expect(f({ labels: ['auth', 'github'] })).toEqual(['Login con Supabase', 'Sync de issues'])
    expect(f({ due: ['overdue', 'today'] })).toEqual(['Login con Supabase', 'Sync de issues'])
    expect(f({ due: ['none'] })).toEqual(['Diseño del dock', 'Idea'])
  })

  it('cuenta los grupos activos', () => {
    expect(activeGroups({ ...NO_FILTER, query: ' x ', labels: ['a', 'b'], due: ['today'] })).toBe(3)
    expect(activeGroups({ ...NO_FILTER, query: '   ' })).toBe(0)
  })

  it('etiquetas únicas sin distinguir mayúsculas, ordenadas', () => {
    expect(labelsOf([{ labels: ['UI', 'auth'] }, { labels: ['ui', 'Zeta'] }])).toEqual([
      'auth',
      'UI',
      'Zeta',
    ])
  })

  it('toggle añade y quita', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggle(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('arrastrar con un filtro puesto: de la lista visible a la columna entera', () => {
  // Columna entera: a b c d e. Con el filtro solo se ven b, d y e.
  const full = ['a', 'b', 'c', 'd', 'e']

  it('sin filtro es el índice de siempre', () => {
    expect(fullIndex(full, ['x', 'a', 'b', 'c', 'd', 'e'], 'x')).toBe(0)
    expect(fullIndex(full, ['a', 'x', 'b', 'c', 'd', 'e'], 'x')).toBe(1)
    expect(fullIndex(full, ['a', 'b', 'c', 'd', 'e', 'x'], 'x')).toBe(5)
  })

  it('arriba del todo: delante de la primera visible, las ocultas de arriba se quedan arriba', () => {
    // `x` viene de otra columna y se suelta encima de b (la primera visible).
    expect(fullIndex(full, ['x', 'b', 'd', 'e'], 'x')).toBe(1)
  })

  it('en medio: justo debajo de la visible que queda encima', () => {
    expect(fullIndex(full, ['b', 'x', 'd', 'e'], 'x')).toBe(2) // detrás de b, delante de c (oculta)
    expect(fullIndex(full, ['b', 'd', 'x', 'e'], 'x')).toBe(4) // detrás de d
  })

  it('al final de lo visible', () => {
    expect(fullIndex(full, ['b', 'd', 'e', 'x'], 'x')).toBe(5)
  })

  it('reordenar dentro de la misma columna cuenta sin la propia tarjeta', () => {
    // Se ven b, d, e. Subo e debajo de b: columna a b e c d.
    expect(fullIndex(full, ['b', 'e', 'd'], 'e')).toBe(2)
    // Subo e arriba del todo (delante de b): a e b c d.
    expect(fullIndex(full, ['e', 'b', 'd'], 'e')).toBe(1)
    // Bajo b debajo de d: a c d b e.
    expect(fullIndex(full, ['d', 'b', 'e'], 'b')).toBe(3)
  })

  it('sin otras tareas visibles, al final de la columna', () => {
    expect(fullIndex(full, ['x'], 'x')).toBe(5)
    expect(fullIndex([], ['x'], 'x')).toBe(0)
  })
})
