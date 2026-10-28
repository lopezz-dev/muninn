import { describe, expect, it } from 'vitest'
import { MODULE_ORDER, withModule } from '../src/lib/modules'

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
