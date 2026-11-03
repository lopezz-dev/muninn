import { t } from '../i18n'
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
  if (!factor) throw new Error(t('secondFactor.noApp'))
  const res = await c.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
  if (res.error) throw res.error
  resetAuth()
}

/**
 * Entra con un código de recuperación en lugar del de la app (ADR-0075): vale una sola vez y sube la sesión a `aal2`
 * igual que el de la app. Supabase ignora mayúsculas, espacios y guiones.
 */
export async function verifyRecoveryCode(code: string) {
  const c = await loadSupabase()
  const res = await c.auth.mfa.recoveryCodes.verify({ code: code.trim() })
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

/** Mensajes, en el idioma activo, para lo que puede fallar al escribir el código. */
export function secondFactorErrorMessage(err: unknown): string {
  const e = err as { code?: string }
  if (e.code === 'mfa_verification_failed' || e.code === 'mfa_challenge_expired')
    return t('secondFactor.wrongOrExpired')
  if (e.code === 'mfa_verification_rejected' || e.code === 'mfa_recovery_codes_locked')
    return t('secondFactor.tooManyAttempts')
  if (e.code === 'mfa_recovery_codes_verify_not_enabled') return t('secondFactor.recoveryDisabled')
  return authErrorMessage(err)
}

/** Mensajes para un código de recuperación: el que no vale suele ser uno ya usado o mal copiado. */
export function recoveryCodeErrorMessage(err: unknown): string {
  const e = err as { code?: string }
  if (
    e.code === 'mfa_verification_failed' ||
    e.code === 'invalid_credentials' ||
    e.code === 'validation_failed' ||
    e.code === 'mfa_factor_not_found'
  )
    return t('secondFactor.recoveryInvalid')
  return secondFactorErrorMessage(err)
}
