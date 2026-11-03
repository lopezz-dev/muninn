// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

// La vuelta de GitHub: el canje PKCE guarda un usuario sin `factors`, así que el nivel que se lee de la sesión sale
// `aal1` → `aal1` aunque la cuenta tenga un factor verificado. Solo `listFactors()` (que hace `getUser()`) lo sabe.
const aal = vi.fn(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }))
const listFactors = vi.fn(async () => ({
  data: { all: [], totp: [{ id: 'f1', status: 'verified' }] },
  error: null as Error | null,
}))
const client = {
  auth: {
    getSession: async () => ({
      data: {
        session: {
          access_token: 'jwt',
          user: { id: 'u1', email: 'tu@correo.com', user_metadata: {}, app_metadata: {} },
        },
      },
    }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    mfa: { getAuthenticatorAssuranceLevel: aal, listFactors },
  },
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => client }))
vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x')

const { getAuth, resetAuth, secondFactorStep } = await import('../src/lib/auth')

afterEach(() => {
  resetAuth()
  vi.clearAllMocks()
})

describe('getAuth con segundo factor', () => {
  it('al volver de GitHub con un factor verificado, pide el código', async () => {
    history.replaceState(null, '', '/login?code=abc')
    const auth = await getAuth()
    expect(auth.kind).toBe('mfa')
    expect(listFactors).toHaveBeenCalledOnce()
  })

  it('sin factores, entra', async () => {
    listFactors.mockResolvedValueOnce({ data: { all: [], totp: [] }, error: null })
    expect((await getAuth()).kind).toBe('user')
  })

  it('sin red, se queda con lo que dice la sesión guardada', async () => {
    listFactors.mockResolvedValueOnce({ data: null as never, error: new Error('offline') })
    expect((await getAuth()).kind).toBe('user')
  })
})

describe('secondFactorStep', () => {
  const c = client as unknown as Parameters<typeof secondFactorStep>[0]

  it('con aal2 ya está pasado, sin preguntar al servidor', async () => {
    aal.mockResolvedValueOnce({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
    expect(await secondFactorStep(c)).toBe('passed')
    expect(listFactors).not.toHaveBeenCalled()
  })

  it('si la sesión guardada ya trae el factor, tampoco pregunta', async () => {
    aal.mockResolvedValueOnce({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    expect(await secondFactorStep(c)).toBe('pending')
    expect(listFactors).not.toHaveBeenCalled()
  })

  it('si el servidor falla, lanza', async () => {
    listFactors.mockResolvedValueOnce({ data: null as never, error: new Error('offline') })
    await expect(secondFactorStep(c)).rejects.toThrow('offline')
  })
})
