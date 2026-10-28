import type { AuthError } from '@supabase/supabase-js'
import { loadSupabase, resetAuth, safeRedirect, toAccount } from './auth'

/**
 * Acciones del formulario de login. Viven aparte de `auth.ts` para que solo las descargue la
 * pantalla de login (chunk diferido) y no el arranque de la app.
 */

/** Mensajes en español para los errores de Supabase Auth que puede ver el usuario. */
export function authErrorMessage(err: unknown): string {
  const e = err as Partial<AuthError> & { message?: string }
  switch (e.code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Has pedido demasiados códigos. Espera un minuto y vuelve a intentarlo.'
    case 'otp_expired':
      return 'El código ha caducado o no es correcto. Pide uno nuevo.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Revisa el correo: no parece válido.'
    case 'email_address_not_authorized':
      // SMTP de serie de Supabase: solo envía a los miembros del equipo del proyecto.
      return 'Este servidor aún no puede enviar correos a esa dirección.'
    case 'signup_disabled':
      return 'Este correo no tiene cuenta y el registro está cerrado.'
    case 'provider_disabled':
      return 'Este método de acceso no está activado.'
  }
  if (e.status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.'
  if (e.name === 'AuthRetryableFetchError' || err instanceof TypeError)
    return 'No hay conexión con el servidor. Comprueba tu red.'
  return e.message || 'Algo ha fallado. Inténtalo de nuevo.'
}

/** Envía un código de un solo uso al correo (crea la cuenta si no existe). */
export async function sendEmailCode(email: string) {
  const c = await loadSupabase()
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw error
}

export async function verifyEmailCode(email: string, token: string) {
  const c = await loadSupabase()
  const { data, error } = await c.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
  if (!data.session) throw new Error('No se pudo iniciar la sesión.')
  resetAuth()
  return toAccount(data.session)
}

/**
 * Redirige a GitHub. Vuelve a `/login?redirect=…&code=…`: supabase-js canjea el código al crear el
 * cliente y la ruta de login redirige al destino (o enseña `error_description` si se canceló).
 */
export async function signInWithGitHub(redirect: string) {
  const c = await loadSupabase()
  const back = new URL('/login', location.origin)
  back.searchParams.set('redirect', safeRedirect(redirect))
  const { error } = await c.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: back.href },
  })
  if (error) throw error
}

/** Proveedores externos activados en el proyecto (para no ofrecer un botón que fallaría). */
export async function enabledProviders(): Promise<Record<string, boolean>> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (!url || !key) return {}
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
  if (!res.ok) return {}
  const data = (await res.json()) as { external?: Record<string, boolean> }
  return data.external ?? {}
}
