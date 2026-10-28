import type { Session } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { safeRedirect, toAccount } from '../src/lib/auth'
import { authErrorMessage } from '../src/lib/login-actions'

describe('safeRedirect', () => {
  it('solo acepta rutas internas', () => {
    expect(safeRedirect('/proyectos/abc?x=1')).toBe('/proyectos/abc?x=1')
    expect(safeRedirect('https://evil.example')).toBe('/')
    expect(safeRedirect('//evil.example')).toBe('/')
    expect(safeRedirect(undefined)).toBe('/')
  })
})

const session = (user: Record<string, unknown>) => ({ user }) as unknown as Session

describe('toAccount', () => {
  it('usa el nombre y la foto de GitHub', () => {
    const a = toAccount(
      session({
        id: 'u1',
        email: 'alex@example.com',
        user_metadata: { full_name: 'Alex López', avatar_url: 'https://x/a.png' },
        app_metadata: { provider: 'github' },
      }),
    )
    expect(a).toEqual({
      id: 'u1',
      email: 'alex@example.com',
      name: 'Alex López',
      avatarUrl: 'https://x/a.png',
      provider: 'github',
    })
  })

  it('con código por correo, el nombre es el correo', () => {
    const a = toAccount(
      session({ id: 'u2', email: 'tu@correo.com', user_metadata: {}, app_metadata: {} }),
    )
    expect(a.name).toBe('tu@correo.com')
    expect(a.avatarUrl).toBeNull()
    expect(a.provider).toBe('email')
  })
})

describe('authErrorMessage', () => {
  it('traduce los errores conocidos', () => {
    expect(authErrorMessage({ code: 'otp_expired', message: 'Token has expired' })).toMatch(
      /caducado/,
    )
    expect(authErrorMessage({ status: 429, message: 'x' })).toMatch(/Espera un minuto/)
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toMatch(/conexión/)
  })
})
