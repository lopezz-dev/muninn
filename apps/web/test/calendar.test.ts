import type { TaskWithColumn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import {
  cellSlots,
  dayLong,
  dayShort,
  dueToast,
  isOverdue,
  keyboardTarget,
  monthGrid,
  monthTitle,
  nextDueAfter,
  quickDates,
  shiftMonth,
  startOfWeek,
  tasksByDay,
  undatedTasks,
  visibleInCell,
  weekDays,
  weekTitle,
} from '../src/lib/calendar'

const task = (over: Partial<TaskWithColumn> & { id: string }): TaskWithColumn => ({
  projectId: 'p',
  columnId: 'todo',
  title: over.id,
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
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  column: { id: over.columnId ?? 'todo', name: '', kind: 'todo' },
  ...over,
})

describe('rejilla del calendario', () => {
  it('el mes son seis semanas que empiezan en lunes', () => {
    const grid = monthGrid('2026-10')
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-09-28')
    expect(grid[41]).toBe('2026-11-08')
    // Un mes que empieza en lunes no deja una semana vacía arriba.
    expect(monthGrid('2027-02')[0]).toBe('2027-02-01')
  })

  it('la semana va de lunes a domingo, también si hoy es domingo', () => {
    expect(weekDays('2026-10-30')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26')
  })

  it('cambia de mes cruzando el año', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('títulos en español', () => {
    expect(monthTitle('2026-10')).toBe('Octubre 2026')
    expect(weekTitle('2026-10-30')).toBe('26 oct – 1 nov 2026')
    expect(weekTitle('2026-11-04')).toBe('2 – 8 nov 2026')
    expect(dayShort('2026-11-04')).toBe('mié 4 nov')
    expect(dayLong('2026-11-04')).toBe('Miércoles 4 de noviembre')
  })
})

describe('fechas de las tareas', () => {
  const today = '2026-10-30'

  it('el aviso dice cuándo vence', () => {
    expect(dueToast(today, today)).toBe('Vence hoy')
    expect(dueToast('2026-10-31', today)).toBe('Vence mañana')
    expect(dueToast('2026-11-04', today)).toBe('Vence el mié 4 nov')
    expect(dueToast('2027-01-05', today)).toMatch(/2027$/)
    expect(dueToast(null, today)).toBe('Sin fecha')
  })

  it('atajos: hoy, mañana, el próximo lunes y en una semana', () => {
    expect(quickDates(today).map((q) => q.date)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-02',
      '2026-11-06',
    ])
    // Un lunes, «próximo lunes» es el de la semana que viene, no hoy.
    expect(quickDates('2026-11-02')[2]?.date).toBe('2026-11-09')
  })

  it('vencida: fecha pasada y sin hacer', () => {
    expect(isOverdue(task({ id: 'a', dueDate: '2026-10-29' }), today)).toBe(true)
    expect(isOverdue(task({ id: 'b', dueDate: today }), today)).toBe(false)
    const done = task({
      id: 'c',
      dueDate: '2026-10-01',
      column: { id: 'd', name: '', kind: 'done' },
    })
    expect(isOverdue(done, today)).toBe(false)
  })

  it('agrupa por día: pendientes primero, luego prioridad, columna y orden del tablero', () => {
    const columns = [{ id: 'backlog' }, { id: 'todo' }, { id: 'done' }]
    const tasks = [
      task({
        id: 'hecha',
        dueDate: today,
        columnId: 'done',
        priority: 'urgent',
        column: { id: 'done', name: '', kind: 'done' },
      }),
      task({ id: 'todo-1', dueDate: today }),
      task({ id: 'backlog', dueDate: today, columnId: 'backlog' }),
      task({ id: 'alta', dueDate: today, priority: 'high' }),
      task({ id: 'todo-2', dueDate: today }),
      task({ id: 'otro-dia', dueDate: '2026-11-04' }),
      task({ id: 'sin-fecha' }),
    ]
    const days = tasksByDay(tasks, columns)
    expect(days[today]?.map((t) => t.id)).toEqual(['alta', 'backlog', 'todo-1', 'todo-2', 'hecha'])
    expect(days['2026-11-04']?.map((t) => t.id)).toEqual(['otro-dia'])
    expect(Object.keys(days)).toHaveLength(2)
    expect(undatedTasks(tasks).map((t) => t.id)).toEqual(['sin-fecha'])
  })

  it('la siguiente fecha con tareas después de un mes vacío', () => {
    const tasks = [
      { dueDate: '2027-01-12' },
      { dueDate: null },
      { dueDate: '2026-10-01' },
      { dueDate: '2027-02-01' },
    ]
    expect(nextDueAfter(tasks, '2026-12-31')).toBe('2027-01-12')
    expect(nextDueAfter(tasks, '2027-03-01')).toBeNull()
  })
})

describe('celdas y teclado', () => {
  it('si no caben, la última plaza es «+N más»', () => {
    expect(visibleInCell([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 })
    expect(visibleInCell([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2], more: 3 })
    expect(visibleInCell([1, 2], 1)).toEqual({ shown: [], more: 2 })
  })

  it('las plazas de una celda salen de su alto (nunca menos de una)', () => {
    expect(cellSlots(100)).toBe(2)
    expect(cellSlots(101)).toBe(3)
    expect(cellSlots(60)).toBe(1)
    expect(cellSlots(20)).toBe(1)
    expect(cellSlots(400)).toBe(8)
  })

  it('las flechas mueven un día o una semana; desde la bandeja vuelven a la fecha de reserva', () => {
    expect(keyboardTarget('ArrowRight', '2026-10-31', 'x')).toBe('2026-11-01')
    expect(keyboardTarget('ArrowLeft', '2026-11-01', 'x')).toBe('2026-10-31')
    expect(keyboardTarget('ArrowDown', '2026-10-30', 'x')).toBe('2026-11-06')
    expect(keyboardTarget('ArrowUp', '2026-10-30', 'x')).toBe('2026-10-23')
    expect(keyboardTarget('ArrowUp', null, '2026-10-30')).toBe('2026-10-30')
    expect(keyboardTarget('KeyA', '2026-10-30', 'x')).toBeNull()
  })
})
