import { describe, expect, it } from 'vitest'
import { activityLink, actorName, describeActivity } from '../src/lib/activity'

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

  it('cuenta lo que hace el agente con su PR', () => {
    expect(
      describeActivity({ action: 'agent_pr_opened', actor: 'agent', payload: { number: 40 } }),
    ).toBe('abrió el PR #40 y pasó la tarea a revisión')
    expect(describeActivity({ action: 'agent_pr_merged', actor: 'agent', payload: {} })).toBe(
      'completó la tarea al fusionarse el PR',
    )
    expect(
      describeActivity({ action: 'agent_pr_closed', actor: 'agent', payload: { number: 3 } }),
    ).toBe('devolvió la tarea: el PR #3 se cerró sin fusionar')
    expect(describeActivity({ action: 'agent_stopped', actor: 'github', payload: {} })).toBe(
      'sacó la tarea del agente: terminó sin abrir un PR',
    )
  })

  it('solo enlaza URLs de GitHub', () => {
    expect(activityLink({ payload: { url: 'https://github.com/o/r/pull/4' } })).toBe(
      'https://github.com/o/r/pull/4',
    )
    expect(activityLink({ payload: { url: 'javascript:alert(1)' } })).toBeNull()
    expect(activityLink({ payload: {} })).toBeNull()
  })

  it('una acción desconocida no rompe', () => {
    expect(describeActivity({ action: 'raro', actor: 'user', payload: {} })).toBe('raro')
  })

  it('nombres de actor', () => {
    expect(actorName('user')).toBe('Tú')
    expect(actorName('mcp')).toBe('Claude')
  })
})
