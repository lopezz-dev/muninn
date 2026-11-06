// @vitest-environment jsdom
import type { AnyRouter } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../src/i18n'
import { warmUp } from '../src/lib/warm-up'
import { router } from '../src/router'

describe('pantallas con sus textos (ADR-0084)', () => {
  it('cargar el chunk de una pantalla trae también su namespace', async () => {
    // `test/setup.ts` ya los tiene todos: basta con ver que se piden junto con el chunk.
    const ns = vi.spyOn(i18n, 'loadNamespaces')
    await router.loadRouteChunk(router.routesById['/_app/projects/$projectId'])
    expect(ns).toHaveBeenCalledWith(['board', 'task'])
    vi.restoreAllMocks()
  })
})

describe('precalentado de la navegación (ADR-0084)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const fakeRouter = (paths: string[]) => {
    const loadRouteChunk = vi.fn(async (_route: { fullPath: string }) => {})
    const routesById = Object.fromEntries(paths.map((fullPath) => [fullPath, { fullPath }]))
    return { router: { routesById, loadRouteChunk } as unknown as AnyRouter, loadRouteChunk }
  }

  it('espera a que el navegador esté libre y carga solo las secciones activas y lo que cuelga de ellas', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const ns = vi.spyOn(i18n, 'loadNamespaces').mockResolvedValue(undefined)
    const { router: r, loadRouteChunk } = fakeRouter([
      '/',
      '/projects',
      '/projects/$projectId',
      '/finance',
      '/login',
    ])
    warmUp(r, ['/', '/projects'])
    expect(loadRouteChunk).not.toHaveBeenCalled()
    vi.runAllTimers()
    const loaded = loadRouteChunk.mock.calls.map(([route]) => route.fullPath)
    expect(loaded).toEqual(['/', '/projects', '/projects/$projectId'])
    expect(ns).toHaveBeenCalledWith(expect.not.arrayContaining(['auth']))
    vi.unstubAllGlobals()
  })

  it('se puede cancelar antes de empezar', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const { router: r, loadRouteChunk } = fakeRouter(['/'])
    warmUp(r, ['/'])()
    vi.runAllTimers()
    expect(loadRouteChunk).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
