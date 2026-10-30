import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryClient, STALE_TIME } from '../src/lib/query-client'

describe('caché de la UI (ADR-0070)', () => {
  const key = ['projects']
  afterEach(() => queryClient.clear())

  it('no repite la petición si lo leído tiene menos de 30 s', async () => {
    const fn = vi.fn(async () => 1)
    await queryClient.fetchQuery({ queryKey: key, queryFn: fn })
    await queryClient.fetchQuery({ queryKey: key, queryFn: fn })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryCache().find({ queryKey: key })?.isStale()).toBe(false)
  })

  it('invalidar (tiempo real, fin de una escritura) no espera al staleTime', async () => {
    const fn = vi.fn(async () => 1)
    await queryClient.fetchQuery({ queryKey: key, queryFn: fn })
    await queryClient.invalidateQueries({ queryKey: key })
    expect(queryClient.getQueryCache().find({ queryKey: key })?.isStale()).toBe(true)
  })

  it('volver a la pestaña refresca lo que ya caducó', () => {
    expect(STALE_TIME).toBe(30_000)
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).not.toBe(false)
  })
})
