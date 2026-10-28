import { describe, expect, it, vi } from 'vitest'
import {
  DESKTOP_REDIRECT,
  OAuthAbortedError,
  oauthOptions,
  parseAuthCallback,
  waitForAuthCallback,
} from '../src/lib/oauth-callback'

describe('oauthOptions', () => {
  it('en el navegador vuelve a la web y deja que supabase-js navegue', () => {
    expect(oauthOptions(false, 'https://app/login?redirect=%2F')).toEqual({
      redirectTo: 'https://app/login?redirect=%2F',
    })
  })

  it('en escritorio vuelve por deep link y no navega el webview', () => {
    expect(oauthOptions(true, 'https://app/login')).toEqual({
      redirectTo: DESKTOP_REDIRECT,
      skipBrowserRedirect: true,
    })
  })
})

describe('parseAuthCallback', () => {
  it('saca el código PKCE', () => {
    expect(parseAuthCallback('muninn://auth/callback?code=abc')).toEqual({
      kind: 'code',
      code: 'abc',
    })
    expect(parseAuthCallback('muninn://auth/callback/?code=abc')).toEqual({
      kind: 'code',
      code: 'abc',
    })
  })

  it('saca los tokens del fragmento (flujo implícito)', () => {
    expect(
      parseAuthCallback(
        'muninn://auth/callback#access_token=at&refresh_token=rt&token_type=bearer',
      ),
    ).toEqual({ kind: 'tokens', accessToken: 'at', refreshToken: 'rt' })
  })

  it('reconoce que dijiste que no en GitHub', () => {
    expect(
      parseAuthCallback(
        'muninn://auth/callback?error=access_denied&error_code=access_denied&error_description=The+user+denied',
      ),
    ).toEqual({ kind: 'error', cancelled: true, message: 'The user denied' })
  })

  it('lee los errores también en el fragmento', () => {
    expect(
      parseAuthCallback('muninn://auth/callback#error=server_error&error_description=Algo+fue+mal'),
    ).toEqual({ kind: 'error', cancelled: false, message: 'Algo fue mal' })
  })

  it('una vuelta sin código ni tokens es un error', () => {
    expect(parseAuthCallback('muninn://auth/callback')).toMatchObject({
      kind: 'error',
      cancelled: false,
    })
  })

  it('ignora otros enlaces', () => {
    expect(parseAuthCallback('muninn://tareas/123')).toBeNull()
    expect(parseAuthCallback('https://auth/callback?code=abc')).toBeNull()
    expect(parseAuthCallback('no es una url')).toBeNull()
  })
})

/** Deep links falsos: `emit` simula que el sistema abre un enlace. */
function fakeLinks() {
  let handler: ((urls: string[]) => void) | undefined
  const unlisten = vi.fn()
  return {
    unlisten,
    emit: (...urls: string[]) => handler?.(urls),
    deps: {
      onOpenUrl: vi.fn(async (h: (urls: string[]) => void) => {
        handler = h
        return unlisten
      }),
    },
  }
}

describe('waitForAuthCallback', () => {
  it('escucha antes de abrir el navegador y resuelve con la vuelta', async () => {
    const links = fakeLinks()
    const wait = waitForAuthCallback(links.deps)
    await wait.ready
    expect(links.deps.onOpenUrl).toHaveBeenCalledOnce()
    links.emit('muninn://otra/cosa')
    links.emit('muninn://auth/callback?code=xyz')
    await expect(wait.result).resolves.toEqual({ kind: 'code', code: 'xyz' })
    expect(links.unlisten).toHaveBeenCalledOnce()
  })

  it('se puede cancelar', async () => {
    const links = fakeLinks()
    const ctrl = new AbortController()
    const wait = waitForAuthCallback(links.deps, ctrl.signal)
    await wait.ready
    ctrl.abort()
    await expect(wait.result).rejects.toEqual(new OAuthAbortedError('cancelled'))
    expect(links.unlisten).toHaveBeenCalledOnce()
  })

  it('se rinde si no vuelves', async () => {
    vi.useFakeTimers()
    try {
      const links = fakeLinks()
      const wait = waitForAuthCallback({ ...links.deps, timeoutMs: 1000 })
      await wait.ready
      const result = expect(wait.result).rejects.toMatchObject({ reason: 'timeout' })
      await vi.advanceTimersByTimeAsync(1000)
      await result
      expect(links.unlisten).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('si falla la escucha, falla también la espera', async () => {
    const err = new Error('sin plugin')
    const wait = waitForAuthCallback({ onOpenUrl: () => Promise.reject(err) })
    await expect(wait.ready).rejects.toBe(err)
    await expect(wait.result).rejects.toBe(err)
  })
})
