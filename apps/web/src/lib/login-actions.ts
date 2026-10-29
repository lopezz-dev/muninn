import type { AuthError } from '@supabase/supabase-js'
import { loadSupabase, resetAuth, safeRedirect, toAccount } from './auth'
import { captchaOptions } from './captcha'
import { openExternal } from './external-link'
import {
  type AuthCallback,
  clearPendingFlow,
  type DeepLinkDeps,
  hasPendingFlow,
  markPendingFlow,
  OAuthAbortedError,
  oauthOptions,
  parseAuthCallback,
  waitForAuthCallback,
} from './oauth-callback'

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
    case 'captcha_failed':
      return 'No hemos podido comprobar que no eres un robot. Inténtalo de nuevo.'
  }
  if (e.status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.'
  if (e.name === 'AuthRetryableFetchError' || err instanceof TypeError)
    return 'No hay conexión con el servidor. Comprueba tu red.'
  return e.message || 'Algo ha fallado. Inténtalo de nuevo.'
}

/**
 * Envía un código de un solo uso al correo (crea la cuenta si no existe). Con el CAPTCHA activo en
 * Supabase, `captchaToken` es obligatorio; es la única llamada del login que lo pide (ADR-0060).
 */
export async function sendEmailCode(email: string, captchaToken?: string | null) {
  const c = await loadSupabase()
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, ...captchaOptions(captchaToken) },
  })
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
    options: oauthOptions(false, back.href),
  })
  if (error) throw error
}

// El plugin solo existe dentro de Tauri: se carga al pulsar el botón.
const deepLinks: DeepLinkDeps = {
  onOpenUrl: async (handler) => (await import('@tauri-apps/plugin-deep-link')).onOpenUrl(handler),
}

/**
 * GitHub en escritorio (ADR-0059): abre la autorización en el navegador del sistema y espera a que vuelva
 * por `muninn://auth/callback`. Rechaza con `OAuthAbortedError` si se cancela (`signal`) o pasa el tiempo.
 * `onBrowser` avisa de que el navegador ya está abierto. `null` si no se pudo abrir.
 */
export async function signInWithGitHubDesktop(opts: {
  signal?: AbortSignal
  onBrowser?: () => void
}) {
  const c = await loadSupabase()
  const { data, error } = await c.auth.signInWithOAuth({
    provider: 'github',
    options: oauthOptions(true, ''),
  })
  if (error) throw error
  markPendingFlow(localStorage)
  // Se deja de escuchar si cancelas tú o si no llega a abrirse el navegador.
  const stop = new AbortController()
  opts.signal?.addEventListener('abort', () => stop.abort(), { once: true })
  const wait = waitForAuthCallback(deepLinks, stop.signal)
  await wait.ready
  if (!(await openExternal(data.url))) {
    stop.abort()
    await wait.result.catch(() => {})
    clearPendingFlow(localStorage)
    // `openExternal` ya lo ha dicho con `notify`.
    return null
  }
  opts.onBrowser?.()
  try {
    return await completeAuthCallback(await wait.result)
  } finally {
    clearPendingFlow(localStorage)
  }
}

/** Termina la sesión con lo que trae el deep link. El verificador PKCE lo guardó supabase-js al empezar. */
export async function completeAuthCallback(callback: AuthCallback) {
  if (callback.kind === 'error')
    throw callback.cancelled ? new OAuthAbortedError('denied') : new Error(callback.message)
  const c = await loadSupabase()
  const { data, error } = await c.auth.exchangeCodeForSession(callback.code)
  if (error) throw error
  if (!data.session) throw new Error('No se pudo iniciar la sesión.')
  resetAuth()
  return toAccount(data.session)
}

/**
 * Si la app se abrió con el enlace de vuelta (estaba cerrada al volver de GitHub), lo recoge. Solo en
 * escritorio; `null` si no hay nada pendiente. Solo si el login lo empezó esta app hace poco: un enlace
 * abierto por otro programa no inicia nada.
 */
export async function pendingAuthCallback(): Promise<AuthCallback | null> {
  if (!hasPendingFlow(localStorage)) return null
  clearPendingFlow(localStorage)
  const { getCurrent } = await import('@tauri-apps/plugin-deep-link')
  for (const u of (await getCurrent()) ?? []) {
    const parsed = parseAuthCallback(u)
    if (parsed) return parsed
  }
  return null
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
