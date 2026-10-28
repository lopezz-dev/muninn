import { describe, expect, it } from 'vitest'
import { dueLabel, dueTone, timeAgo } from '../src/lib/dates'

describe('dueLabel', () => {
  const today = '2026-10-19'
  it('hoy, mañana y ayer en palabras', () => {
    expect(dueLabel('2026-10-19', today)).toBe('Hoy')
    expect(dueLabel('2026-10-20', today)).toBe('Mañana')
    expect(dueLabel('2026-10-18', today)).toBe('Ayer')
  })

  it('el resto, día y mes; con año si no es el actual', () => {
    expect(dueLabel('2026-10-23', today)).toMatch(/^23 oct/)
    expect(dueLabel('2027-01-05', today)).toMatch(/2027/)
  })

  it('cruza el fin de mes y de año sin pasar por UTC', () => {
    expect(dueLabel('2027-01-01', '2026-12-31')).toBe('Mañana')
    expect(dueLabel('2026-12-31', '2027-01-01')).toBe('Ayer')
  })
})

describe('dueTone', () => {
  const today = '2026-10-19'
  it('clasifica por cercanía', () => {
    expect(dueTone('2026-10-17', today)).toBe('overdue')
    expect(dueTone('2026-10-19', today)).toBe('today')
    expect(dueTone('2026-10-22', today)).toBe('soon')
    expect(dueTone('2026-10-23', today)).toBe('later')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-19T10:00:00Z')
  it('minutos, horas y días', () => {
    expect(timeAgo('2026-10-19T09:40:00Z', now)).toBe('hace 20 minutos')
    expect(timeAgo('2026-10-19T07:00:00Z', now)).toBe('hace 3 horas')
    expect(timeAgo('2026-10-18T10:00:00Z', now)).toBe('ayer')
    expect(timeAgo('2026-10-19T09:59:50Z', now)).toBe('ahora mismo')
  })
})
