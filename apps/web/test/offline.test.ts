import 'fake-indexeddb/auto'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearOfflineCache, enableOfflineCache, shouldPersist } from '../src/lib/offline'

describe('qué se guarda', () => {
  it('solo lo que ya se leyó bien', () => {
    expect(shouldPersist({ state: { status: 'success' } })).toBe(true)
    expect(shouldPersist({ state: { status: 'pending' } })).toBe(false)
    expect(shouldPersist({ state: { status: 'error' } })).toBe(false)
  })
})

describe('caché sin conexión (IndexedDB)', () => {
  const board = ['projects', 'p1', 'board']

  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
  afterEach(async () => {
    vi.useRealTimers()
    await clearOfflineCache()
  })

  /** Guarda lo que haya en `qc` (la escritura espera 1,5 s para agrupar cambios). */
  async function save(qc: QueryClient, userId: string) {
    const stop = await enableOfflineCache(qc, userId)
    qc.setQueryData(board, { tasks: ['a', 'b'] })
    qc.setQueryData(['settings'], { enabledModules: ['tasks'] })
    await vi.advanceTimersByTimeAsync(2000)
    stop()
  }

  it('lo guardado vuelve en un cliente nuevo del mismo usuario, antes de pintar', async () => {
    await save(new QueryClient(), 'u1')
    const fresh = new QueryClient()
    const stop = await enableOfflineCache(fresh, 'u1')
    expect(fresh.getQueryData(board)).toEqual({ tasks: ['a', 'b'] })
    expect(fresh.getQueryData(['settings'])).toEqual({ enabledModules: ['tasks'] })
    stop()
  })

  it('otro usuario no ve nada', async () => {
    await save(new QueryClient(), 'u1')
    const other = new QueryClient()
    const stop = await enableOfflineCache(other, 'u2')
    expect(other.getQueryData(board)).toBeUndefined()
    stop()
  })

  it('al cerrar sesión se borra todo, y lo que estaba pendiente de escribir no reaparece', async () => {
    const qc = new QueryClient()
    const stop = await enableOfflineCache(qc, 'u1')
    qc.setQueryData(board, { tasks: ['a'] })
    stop() // cerrar sesión: se para antes de que toque escribir
    await clearOfflineCache()
    await vi.advanceTimersByTimeAsync(3000)
    const fresh = new QueryClient()
    const stop2 = await enableOfflineCache(fresh, 'u1')
    expect(fresh.getQueryData(board)).toBeUndefined()
    stop2()
  })

  it('las lecturas que fallaron no se guardan', async () => {
    const qc = new QueryClient()
    const stop = await enableOfflineCache(qc, 'u1')
    await qc
      .fetchQuery({
        queryKey: ['overview'],
        queryFn: () => Promise.reject(new Error('sin red')),
        retry: false,
      })
      .catch(() => {})
    qc.setQueryData(board, { tasks: ['a'] })
    await vi.advanceTimersByTimeAsync(2000)
    stop()
    const fresh = new QueryClient()
    const stop2 = await enableOfflineCache(fresh, 'u1')
    expect(fresh.getQueryData(['overview'])).toBeUndefined()
    expect(fresh.getQueryData(board)).toEqual({ tasks: ['a'] })
    stop2()
  })
})
