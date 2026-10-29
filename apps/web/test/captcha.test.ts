// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const signInWithOtp = vi.fn(async (_args: unknown) => ({ error: null }))
vi.mock('../src/lib/auth', () => ({
  loadSupabase: async () => ({ auth: { signInWithOtp } }),
  resetAuth: () => {},
  safeRedirect: (s: string) => s,
  toAccount: () => null,
  isTauri: false,
}))

const { captchaOptions, loadTurnstile } = await import('../src/lib/captcha')
const { authErrorMessage, sendEmailCode } = await import('../src/lib/login-actions')

afterEach(() => {
  signInWithOtp.mockClear()
  window.turnstile = undefined
  for (const el of document.head.querySelectorAll('script')) el.remove()
})

describe('captchaOptions', () => {
  it('solo añade el token si lo hay', () => {
    expect(captchaOptions('tok')).toEqual({ captchaToken: 'tok' })
    expect(captchaOptions(null)).toEqual({})
    expect(captchaOptions(undefined)).toEqual({})
    expect(captchaOptions('')).toEqual({})
  })
})

describe('sendEmailCode', () => {
  it('pasa el token de Turnstile a Supabase como options.captchaToken', async () => {
    await sendEmailCode('tu@correo.com', 'tok-123')
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'tu@correo.com',
      options: { shouldCreateUser: true, captchaToken: 'tok-123' },
    })
  })

  it('sin clave de CAPTCHA no manda token: la petición es la de siempre', async () => {
    await sendEmailCode('tu@correo.com')
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'tu@correo.com',
      options: { shouldCreateUser: true },
    })
  })
})

describe('authErrorMessage', () => {
  it('traduce el rechazo del CAPTCHA', () => {
    expect(authErrorMessage({ code: 'captcha_failed', message: 'captcha protection' })).toMatch(
      /robot/,
    )
  })
})

describe('loadTurnstile', () => {
  it('reutiliza window.turnstile si ya está', async () => {
    const t = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() }
    window.turnstile = t
    await expect(loadTurnstile()).resolves.toBe(t)
    expect(document.head.querySelector('script')).toBeNull()
  })

  it('si el script falla, el siguiente intento lo vuelve a pedir', async () => {
    const first = loadTurnstile()
    const el = document.head.querySelector('script')
    expect(el?.src).toContain('challenges.cloudflare.com/turnstile/v0/api.js')
    el?.dispatchEvent(new Event('error'))
    await expect(first).rejects.toThrow()
    expect(document.head.querySelector('script')).toBeNull()

    const second = loadTurnstile()
    const again = document.head.querySelector('script')
    expect(again).not.toBeNull()
    window.turnstile = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() }
    again?.dispatchEvent(new Event('load'))
    await expect(second).resolves.toBe(window.turnstile)
  })
})
