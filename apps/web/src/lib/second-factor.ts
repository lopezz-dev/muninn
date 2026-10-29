import { loadSupabase, resetAuth } from './auth'
import { authErrorMessage } from './login-actions'

/**
 * El segundo factor al entrar (ADR-0061): la cuenta tiene una app de códigos y la sesión aún es `aal1`. Como el login,
 * ocurre antes de que exista el core, así que habla con Supabase Auth desde aquí (ADR-0022).
 * Activarlo y desactivarlo, en cambio, va por `m.account.mfa` en Ajustes › Cuenta.
 */

/** Comprueba el código de la app y sube la sesión a `aal2`. */
export async function verifySecondFactor(code: string) {
  const c = await loadSupabase()
  const { data, error } = await c.auth.mfa.listFactors()
  if (error) throw error
  const factor = data.totp[0]
  if (!factor) throw new Error('Tu cuenta no tiene ninguna app de códigos.')
  const res = await c.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
  if (res.error) throw res.error
  resetAuth()
}

/** «Usar otra cuenta»: deja la sesión a medias y vuelve al formulario. */
export async function abandonSecondFactor() {
  const c = await loadSupabase()
  const { error } = await c.auth.signOut({ scope: 'local' })
  if (error) throw error
  resetAuth()
}

/** Mensajes en español para lo que puede fallar al escribir el código. */
export function secondFactorErrorMessage(err: unknown): string {
  const e = err as { code?: string }
  if (e.code === 'mfa_verification_failed' || e.code === 'mfa_challenge_expired')
    return 'El código no es correcto o ha caducado. Escribe el que sale ahora en tu app.'
  if (e.code === 'mfa_verification_rejected')
    return 'Demasiados intentos. Espera un minuto y vuelve a probar.'
  return authErrorMessage(err)
}
