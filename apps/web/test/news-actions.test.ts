import type { Muninn, NewsDigest, NewsItem, NewsSource } from '@muninn/core'
import { notify } from '@muninn/ui'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addSource, archiveSource, setSaved, setSourceEnabled } from '../src/lib/news'
import { generateDigestNow } from '../src/lib/news-digest'
import { clickUndo, infos, lastSuccess } from './undo'

vi.mock('@muninn/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@muninn/ui')>()),
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'cargando'),
    dismiss: vi.fn(),
  },
}))

// El modelo local, siempre listo y con algo que resumir.
vi.mock('@muninn/assistant', () => ({
  createOllamaProvider: () => ({ status: async () => ({ state: 'ready' }) }),
  generateDigest: async () => ({ content: 'Hoy, lo nuevo', itemIds: [] }),
}))

const source = { id: 's1', title: 'Blog', enabled: true } as NewsSource
const item = { id: 'i1', savedAt: null } as NewsItem
const oldDigest = {
  date: '2026-10-30',
  content: 'El de antes',
  model: 'qwen3:8b',
  itemIds: ['i0'],
} as NewsDigest

/** El servicio de mentira: solo lo que tocan las acciones de Noticias. */
function fake() {
  return {
    today: () => '2026-10-30',
    projects: { list: vi.fn(async () => []) },
    news: {
      sources: {
        list: vi.fn(async () => [source]),
        create: vi.fn(async () => source),
        update: vi.fn(async () => source),
        archive: vi.fn(async () => source),
        restore: vi.fn(async () => source),
      },
      items: {
        list: vi.fn(async () => []),
        setSaved: vi.fn(async () => item),
      },
      digests: {
        get: vi.fn(async (): Promise<NewsDigest | null> => oldDigest),
        save: vi.fn(async (d: NewsDigest) => d),
      },
    },
  }
}
const asMuninn = (f: ReturnType<typeof fake>) => f as unknown as Muninn
const sinRed = () => Promise.reject(new Error('sin red'))

beforeEach(() => vi.clearAllMocks())

describe('fuentes', () => {
  it('añadir: «Deshacer» la archiva', async () => {
    const f = fake()
    await addSource(asMuninn(f), new QueryClient(), { url: 'https://blog.example' })
    expect(notify.success).toHaveBeenCalledWith(
      'Fuente «Blog» añadida',
      expect.objectContaining({ icon: 'news' }),
    )
    await clickUndo()
    expect(f.news.sources.archive).toHaveBeenCalledWith('s1')
    expect(infos()).toEqual(['Fuente quitada'])
    expect(notify.success).toHaveBeenCalledOnce()
  })

  it('añadir: si archivarla falla al deshacer, solo avisa del fallo', async () => {
    const f = fake()
    await addSource(asMuninn(f), new QueryClient(), { url: 'https://blog.example' })
    f.news.sources.archive.mockImplementationOnce(sinRed)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo quitar la fuente', {
      description: 'sin red',
    })
  })

  it('pausar: «Deshacer» la vuelve a activar', async () => {
    const f = fake()
    await setSourceEnabled(asMuninn(f), new QueryClient(), source, false)
    expect(notify.success).toHaveBeenCalledWith(
      '«Blog» en pausa',
      expect.objectContaining({ icon: 'news' }),
    )
    await clickUndo()
    expect(f.news.sources.update).toHaveBeenLastCalledWith('s1', { enabled: true })
    // Antes, deshacer sacaba otro aviso con su propio «Deshacer».
    expect(notify.success).toHaveBeenCalledOnce()
    expect(infos()).toEqual(['«Blog» activada'])
  })

  it('pausar: si deshacer falla, solo avisa del fallo', async () => {
    const f = fake()
    await setSourceEnabled(asMuninn(f), new QueryClient(), source, false)
    f.news.sources.update.mockImplementationOnce(sinRed)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo cambiar la fuente', {
      description: 'sin red',
    })
  })

  it('quitar: «Deshacer» la recupera', async () => {
    const f = fake()
    await archiveSource(asMuninn(f), new QueryClient(), source)
    expect(lastSuccess()?.description).toBe('Sus artículos guardados se conservan')
    await clickUndo()
    expect(f.news.sources.restore).toHaveBeenCalledWith('s1')
    expect(infos()).toEqual(['Fuente recuperada'])
  })

  it('quitar: si recuperarla falla, lo dice', async () => {
    const f = fake()
    await archiveSource(asMuninn(f), new QueryClient(), source)
    f.news.sources.restore.mockImplementationOnce(sinRed)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo recuperar', { description: 'sin red' })
  })
})

describe('guardar para luego', () => {
  it('«Deshacer» la vuelve a dejar como estaba', async () => {
    const f = fake()
    await setSaved(asMuninn(f), new QueryClient(), item, true)
    expect(notify.success).toHaveBeenCalledWith(
      'Guardada para leer luego',
      expect.objectContaining({ icon: 'pin' }),
    )
    await clickUndo()
    expect(f.news.items.setSaved).toHaveBeenLastCalledWith('i1', false)
    expect(notify.success).toHaveBeenCalledOnce()
    expect(infos()).toEqual(['Cambio deshecho'])
  })

  it('si deshacer falla, no dice «deshecho»', async () => {
    const f = fake()
    await setSaved(asMuninn(f), new QueryClient(), item, true)
    f.news.items.setSaved.mockImplementationOnce(sinRed)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo guardar', { description: 'sin red' })
  })
})

describe('resumen del día', () => {
  const prefs = { ollamaUrl: 'http://localhost:11434', model: 'qwen3:8b' }

  it('si había uno, «Deshacer» lo devuelve', async () => {
    const f = fake()
    await generateDigestNow(asMuninn(f), new QueryClient(), prefs)
    expect(notify.success).toHaveBeenCalledWith(
      'Resumen del día listo',
      expect.objectContaining({ icon: 'assistant' }),
    )
    await clickUndo()
    expect(f.news.digests.save).toHaveBeenLastCalledWith(oldDigest)
    expect(infos()).toEqual(['Vuelve el resumen anterior'])
  })

  it('si devolverlo falla, lo dice (antes se perdía en silencio)', async () => {
    const f = fake()
    await generateDigestNow(asMuninn(f), new QueryClient(), prefs)
    f.news.digests.save.mockImplementationOnce(sinRed)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo recuperar el resumen anterior', {
      description: 'sin red',
    })
  })

  it('si no había ninguno, no hay nada que deshacer', async () => {
    const f = fake()
    f.news.digests.get.mockResolvedValueOnce(null)
    await generateDigestNow(asMuninn(f), new QueryClient(), prefs)
    expect(lastSuccess()?.action).toBeUndefined()
  })
})
