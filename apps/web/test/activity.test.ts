import { describe, expect, it } from 'vitest'
import { actorName, describeActivity } from '../src/lib/activity'

describe('describeActivity', () => {
  it('habla de tú y de los demás en persona distinta', () => {
    expect(describeActivity({ action: 'created', actor: 'user', payload: {} })).toBe(
      'creaste la tarea',
    )
    expect(describeActivity({ action: 'completed', actor: 'mcp', payload: {} })).toBe(
      'completó la tarea',
    )
  })

  it('un movimiento dice de dónde a dónde', () => {
    expect(
      describeActivity({
        action: 'moved',
        actor: 'user',
        payload: { from: 'Pendiente', to: 'En curso' },
      }),
    ).toBe('moviste la tarea de Pendiente a En curso')
  })

  it('una edición nombra los campos que cambiaron', () => {
    expect(
      describeActivity({
        action: 'updated',
        actor: 'user',
        payload: { title: 'x', priority: 'high', labels: [] },
      }),
    ).toBe('cambiaste el título, la prioridad y las etiquetas')
    expect(describeActivity({ action: 'updated', actor: 'agent', payload: {} })).toBe(
      'cambió la tarea',
    )
  })

  it('una acción desconocida no rompe', () => {
    expect(describeActivity({ action: 'raro', actor: 'user', payload: {} })).toBe('raro')
  })

  it('nombres de actor', () => {
    expect(actorName('user')).toBe('Tú')
    expect(actorName('mcp')).toBe('Claude')
  })
})
