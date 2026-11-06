import { describe, expect, it } from 'vitest'
import { legacyHref } from '../src/lib/legacy-routes'

describe('legacyHref', () => {
  it('traduce cada sección', () => {
    expect(legacyHref('/proyectos')).toBe('/projects')
    expect(legacyHref('/notas/abc')).toBe('/notes/abc')
    expect(legacyHref('/asistente', '?q=hola')).toBe('/assistant?q=hola')
    expect(legacyHref('/noticias')).toBe('/news')
    expect(legacyHref('/documentacion/tareas', '', '#fecha-limite')).toBe(
      '/docs/tareas#fecha-limite',
    )
    expect(legacyHref('/dev/fundamentos')).toBe('/dev/foundations')
  })

  it('lleva el detalle de tarea a /tasks', () => {
    expect(legacyHref('/proyectos/p1/tareas/t1')).toBe('/projects/p1/tasks/t1')
  })

  it('traduce la sección de Ajustes y conserva el ancla', () => {
    expect(legacyHref('/ajustes')).toBe('/settings')
    expect(legacyHref('/ajustes/cuenta', '', '#ajuste-sesiones')).toBe(
      '/settings/account#ajuste-sesiones',
    )
    expect(legacyHref('/ajustes/notificaciones')).toBe('/settings/notifications')
    expect(legacyHref('/ajustes/otra')).toBe('/settings/otra')
  })

  it('traduce la vista de Finanzas y deja lo demás', () => {
    expect(legacyHref('/finanzas', '?vista=suscripciones')).toBe('/finance?view=subscriptions')
    expect(legacyHref('/finanzas', '?vista=resumen&x=1')).toBe('/finance?x=1&view=overview')
    expect(legacyHref('/finanzas', '?vista=rara')).toBe('/finance')
  })

  it('no toca las rutas de ahora ni las que no conoce', () => {
    expect(legacyHref('/')).toBeNull()
    expect(legacyHref('/projects/p1')).toBeNull()
    expect(legacyHref('/login')).toBeNull()
    expect(legacyHref('/mas')).toBeNull()
    expect(legacyHref('/github')).toBeNull()
  })
})
