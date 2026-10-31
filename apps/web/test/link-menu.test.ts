import { describe, expect, it } from 'vitest'
import { askLink, closeLinkMenu, registerLinkMenuHost } from '../src/lib/link-menu'

const ask = { url: 'https://example.com', rect: { left: 0, top: 0, width: 10, height: 10 } }

describe('menú de enlaces', () => {
  it('sin shell que lo pinte, no se pide (el enlace se abre directo)', () => {
    expect(askLink(ask)).toBe(false)
  })

  it('con el shell montado se pide, y al desmontarlo se cierra', () => {
    const unregister = registerLinkMenuHost()
    expect(askLink(ask)).toBe(true)
    closeLinkMenu()
    unregister()
    expect(askLink(ask)).toBe(false)
  })
})
