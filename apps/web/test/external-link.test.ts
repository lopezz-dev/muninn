import { notify } from '@muninn/ui'
import type { MouseEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dataUrlToBlob,
  externalLink,
  type OpenerDeps,
  openExternal,
  openImage,
} from '../src/lib/external-link'

vi.mock('@muninn/ui', () => ({ notify: { error: vi.fn() } }))

const URL_NEWS = 'https://example.com/noticia'

const fakeDeps = (over: Partial<OpenerDeps> = {}): OpenerDeps => ({
  tauri: false,
  openUrl: vi.fn(async () => {}),
  open: vi.fn(),
  ...over,
})

const click = (mods: Partial<MouseEvent<HTMLElement>> = {}) =>
  ({
    preventDefault: vi.fn(),
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...mods,
  }) as unknown as MouseEvent<HTMLElement>

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('openExternal', () => {
  it('en escritorio usa el plugin opener y no window.open', async () => {
    const deps = fakeDeps({ tauri: true })
    expect(await openExternal(URL_NEWS, deps)).toBe(true)
    expect(deps.openUrl).toHaveBeenCalledWith(URL_NEWS)
    expect(deps.open).not.toHaveBeenCalled()
  })

  it('en el navegador y la PWA usa window.open', async () => {
    const deps = fakeDeps()
    expect(await openExternal(URL_NEWS, deps)).toBe(true)
    expect(deps.open).toHaveBeenCalledWith(URL_NEWS)
    expect(deps.openUrl).not.toHaveBeenCalled()
  })

  it('si el sistema no lo abre, avisa', async () => {
    const deps = fakeDeps({
      tauri: true,
      openUrl: vi.fn(async () => {
        throw new Error('Not allowed to open url')
      }),
    })
    expect(await openExternal(URL_NEWS, deps)).toBe(false)
    expect(notify.error).toHaveBeenCalledWith('No se ha podido abrir el enlace', {
      description: URL_NEWS,
    })
  })

  it('en el navegador, window.open se llama en el mismo clic (Safari bloquea lo que llega tarde)', () => {
    const deps = fakeDeps()
    void openExternal(URL_NEWS, deps)
    expect(deps.open).toHaveBeenCalledOnce()
  })
})

describe('externalLink', () => {
  it('conserva href y rel, y el clic pasa por openExternal tras onOpen', () => {
    const deps = fakeDeps({ tauri: true })
    const onOpen = vi.fn()
    const props = externalLink(URL_NEWS, onOpen, deps)
    expect(props).toMatchObject({ href: URL_NEWS, target: '_blank', rel: 'noopener noreferrer' })
    const e = click()
    props.onClick(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledOnce()
    expect(deps.openUrl).toHaveBeenCalledWith(URL_NEWS)
  })

  it('en el navegador, Ctrl/⌘-clic se lo deja al navegador', () => {
    const deps = fakeDeps()
    const onOpen = vi.fn()
    const e = click({ ctrlKey: true })
    externalLink(URL_NEWS, onOpen, deps).onClick(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledOnce()
    expect(deps.open).not.toHaveBeenCalled()
  })

  it('en escritorio, Ctrl-clic también va al navegador del sistema', () => {
    const deps = fakeDeps({ tauri: true })
    const e = click({ ctrlKey: true })
    externalLink(URL_NEWS, undefined, deps).onClick(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(deps.openUrl).toHaveBeenCalledWith(URL_NEWS)
  })
})

describe('openImage', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo='

  it('pasa el data: a blob: con su tipo', async () => {
    const blob = dataUrlToBlob(PNG)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(8)
  })

  it('abre un blob: en el mismo clic', () => {
    const open = vi.fn()
    openImage(PNG, open)
    expect(open).toHaveBeenCalledOnce()
    expect(open.mock.calls[0]?.[0]).toMatch(/^blob:/)
  })

  it('si la imagen está rota, avisa', () => {
    const open = vi.fn()
    openImage('data:image/png;base64,%%%', open)
    expect(open).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se ha podido abrir la imagen')
  })
})
