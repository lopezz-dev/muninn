import { describe, expect, it } from 'vitest'
import { MODULE_ORDER, withModule } from '../src/lib/modules'
import { slotCenter, slotWidth } from '../src/shell/dock-geometry'

describe('módulos', () => {
  it('activar y desactivar conserva el orden y no repite', () => {
    expect(withModule(['tasks', 'notes'], 'finance', true)).toEqual(['tasks', 'notes', 'finance'])
    expect(withModule(['notes', 'tasks'], 'tasks', true)).toEqual(['tasks', 'notes'])
    expect(withModule(['tasks', 'notes'], 'tasks', false)).toEqual(['notes'])
    expect(withModule([], 'news', false)).toEqual([])
    expect(withModule(['news', 'tasks'], 'github', true)).toEqual(['tasks', 'github', 'news'])
  })

  it('MODULE_ORDER tiene los seis módulos del core', () => {
    expect([...MODULE_ORDER].sort()).toEqual([
      'finance',
      'focus',
      'github',
      'news',
      'notes',
      'tasks',
    ])
  })
})

describe('geometría del dock con menos pestañas', () => {
  it('las pestañas se reparten el ancho', () => {
    expect(slotWidth(366, 5)).toBe(66.8)
    expect(slotWidth(366, 4)).toBe(83.5)
    // Simétrico: la primera y la última pestaña quedan a la misma distancia de los bordes.
    expect(slotCenter(366, 0, 4)).toBeCloseTo(366 - slotCenter(366, 3, 4), 5)
  })
})
