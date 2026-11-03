// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

// Entrar con un código de recuperación (ADR-0075): pasa por la API experimental de supabase-js, que solo existe si el
// cliente se crea con `auth.experimental.recoveryCodes`.
const verify = vi.fn(async (_: { code: string }) => ({ data: {}, error: null as unknown }))
const createClient = vi.fn((_url: string, _key: string, _options: unknown) => ({
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    mfa: { recoveryCodes: { verify } },
  },
}))
vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x')

const { recoveryCodeErrorMessage, verifyRecoveryCode } = await import('../src/lib/second-factor')

afterEach(() => vi.clearAllMocks())

describe('códigos de recuperación al entrar', () => {
  it('el cliente se crea con la API experimental activada', async () => {
    await verifyRecoveryCode('  abcde-12345 ')
    const options = createClient.mock.calls[0]?.[2] as {
      auth: { experimental?: { recoveryCodes?: boolean } }
    }
    expect(options.auth.experimental?.recoveryCodes).toBe(true)
    expect(verify).toHaveBeenCalledWith({ code: 'abcde-12345' })
  })

  it('un código que no vale lanza, y el mensaje dice que puede estar usado', async () => {
    verify.mockResolvedValueOnce({ data: {}, error: { code: 'mfa_verification_failed' } })
    const err = await verifyRecoveryCode('abcde-12345').catch((e: unknown) => e)
    expect(recoveryCodeErrorMessage(err)).toMatch(/ya se usó/)
  })

  it('demasiados intentos y servidor sin la API tienen su mensaje', () => {
    expect(recoveryCodeErrorMessage({ code: 'mfa_recovery_codes_locked' })).toMatch(/Demasiados/)
    expect(recoveryCodeErrorMessage({ code: 'mfa_recovery_codes_verify_not_enabled' })).toMatch(
      /no tiene activados/,
    )
  })
})
