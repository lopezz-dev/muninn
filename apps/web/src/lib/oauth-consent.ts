import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { t } from '../i18n'
import { loadSupabase, type SecondFactorStep, secondFactorStep } from './auth'

/**
 * Pantalla de autorización del servidor OAuth de Supabase (ADR-0036): cuando un cliente como claude.ai pide
 * acceso al MCP remoto, Supabase Auth manda aquí con `?authorization_id=…`. Viven aparte de `auth.ts` para
 * que solo las descargue esa pantalla (chunk diferido).
 */

/** Hay que preguntar (`ask`) o ya diste permiso antes y se vuelve al cliente sin preguntar (`redirect`). */
export type ConsentRequest =
  | { kind: 'ask'; details: OAuthAuthorizationDetails }
  | { kind: 'redirect'; url: string }

/** Los *scopes* estándar de Supabase Auth que tienen texto propio (`oauth.scopes.*`). */
const SCOPES = ['openid', 'email', 'profile', 'phone'] as const
type KnownScope = (typeof SCOPES)[number]
const isKnownScope = (s: string): s is KnownScope => (SCOPES as readonly string[]).includes(s)

/** Los *scopes* pedidos, sin repetir y en texto del idioma activo (los desconocidos, tal cual). */
export function scopeLabels(scope: string | undefined): string[] {
  const names = (scope ?? '').split(/\s+/).filter(Boolean)
  return [...new Set(names)].map((s) => (isKnownScope(s) ? t(`oauth.scopes.${s}`) : s))
}

/** La web a la que vuelves al terminar (`claude.ai`), para enseñarla. */
export function redirectHost(uri: string): string {
  try {
    return new URL(uri).host
  } catch {
    return uri
  }
}

export async function getConsentRequest(authorizationId: string): Promise<ConsentRequest> {
  const c = await loadSupabase()
  const { data, error } = await c.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error) throw error
  if (!data) throw new Error(t('oauth.notFound'))
  return 'authorization_id' in data
    ? { kind: 'ask', details: data }
    : { kind: 'redirect', url: data.redirect_url }
}

/**
 * Si la sesión ya pasó el segundo factor, si le falta o si la cuenta no lo tiene. Pregunta al servidor: la sesión que guarda la
 * vuelta de GitHub llega sin factores. Sin red, lanza: aquí no se da acceso a ciegas.
 */
export async function consentSecondFactor(): Promise<SecondFactorStep> {
  return secondFactorStep(await loadSupabase())
}

/**
 * Apunta que apruebas esta autorización con el segundo factor (ADR-0064, ADR-0066): la sesión que nazca de ella verá tus
 * datos aunque sus tokens sean `aal1`. Por el core, pero sin `loadMuninn` (caché sin conexión, tiempo real): aquí no hace
 * falta. Devuelve si quedó apuntada; sin segundo factor en esta sesión, `false`.
 */
export async function approveAppWithMfa(authorizationId: string, userId: string): Promise<boolean> {
  const [{ createMuninn }, { createSupabaseStore }, client] = await Promise.all([
    import('@muninn/core'),
    import('@muninn/core/supabase'),
    loadSupabase(),
  ])
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const m = createMuninn(createSupabaseStore(client, userId), { timeZone })
  return m.account.apps.approveWithMfa(authorizationId)
}

/** Aprueba o rechaza; devuelve la dirección del cliente (con el código, o con el error si se rechaza). */
export async function decideConsent(authorizationId: string, approve: boolean): Promise<string> {
  const c = await loadSupabase()
  const opts = { skipBrowserRedirect: true }
  const { data, error } = approve
    ? await c.auth.oauth.approveAuthorization(authorizationId, opts)
    : await c.auth.oauth.denyAuthorization(authorizationId, opts)
  if (error) throw error
  if (!data?.redirect_url) throw new Error(t('oauth.noRedirect'))
  return data.redirect_url
}

/** Mensajes, en el idioma activo, para lo que puede fallar al pedir o decidir la autorización. */
export function consentErrorMessage(err: unknown): string {
  const e = err as { status?: number; message?: string; name?: string }
  if (e.status === 404 || e.status === 400 || e.status === 410) return t('oauth.expired')
  if (e.name === 'AuthRetryableFetchError' || err instanceof TypeError) return t('oauth.offline')
  return e.message || t('oauth.unknown')
}
