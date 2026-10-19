// @vitest-environment jsdom
import { DEFAULT_APPEARANCE } from '@muninn/ui'
import { describe, expect, it, vi } from 'vitest'
import {
  APPEARANCE_KEY,
  type AppearanceStorage,
  createAppearanceStore,
  parseAppearance,
} from '../src/lib/appearance'

const memoryStorage = (initial: Record<string, string> = {}): AppearanceStorage => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v)
    },
  }
}

describe('parseAppearance', () => {
  const fallback = { glass: true, accent: 'amber' } as const

  it('lee lo guardado', () => {
    expect(parseAppearance('{"glass":false,"accent":"teal"}', fallback)).toEqual({
      glass: false,
      accent: 'teal',
    })
  })

  it('descarta campo a campo lo que no es válido', () => {
    expect(parseAppearance('{"glass":"sí","accent":"teal"}', fallback)).toEqual({
      glass: true,
      accent: 'teal',
    })
    expect(parseAppearance('{"glass":false,"accent":"verde"}', fallback)).toEqual({
      glass: false,
      accent: 'amber',
    })
  })

  it('sobrevive a JSON roto o vacío', () => {
    expect(parseAppearance('{roto', fallback)).toEqual(fallback)
    expect(parseAppearance(null, fallback)).toEqual(fallback)
  })
})

describe('appearanceStore', () => {
  it('arranca con lo guardado y lo aplica al documento al cambiar', () => {
    const storage = memoryStorage({ [APPEARANCE_KEY]: '{"glass":false,"accent":"blue"}' })
    const store = createAppearanceStore(storage)
    expect(store.get()).toEqual({ glass: false, accent: 'blue' })

    const listener = vi.fn()
    store.subscribe(listener)
    const prev = store.set((a) => ({ ...a, glass: true }))

    expect(prev).toEqual({ glass: false, accent: 'blue' })
    expect(document.documentElement.dataset.glass).toBe('on')
    expect(JSON.parse(storage.getItem(APPEARANCE_KEY) ?? '')).toEqual({
      glass: true,
      accent: 'blue',
    })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('sin almacenamiento usa los valores por defecto y no falla al guardar', () => {
    const store = createAppearanceStore(null)
    expect(store.get()).toEqual(DEFAULT_APPEARANCE)
    expect(() => store.set({ glass: false, accent: 'pink' })).not.toThrow()
  })

  it('si el almacenamiento lanza (modo privado), sigue funcionando', () => {
    const broken: AppearanceStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const store = createAppearanceStore(broken)
    expect(store.get()).toEqual(DEFAULT_APPEARANCE)
    expect(() => store.set({ glass: false, accent: 'violet' })).not.toThrow()
    expect(store.get().accent).toBe('violet')
  })
})
