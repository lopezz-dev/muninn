import { z } from 'zod'
import {
  type AccountSession,
  type MfaEnrollment,
  type MfaFactor,
  mfaCode,
  mfaFactorName,
  type SignOutScope,
  signOutScope,
} from './schemas'
import type { AccountStore, Store } from './store'

export interface AccountContext {
  store: Store
  parse: <S extends z.ZodType>(schema: S, value: unknown) => z.output<S>
}

/**
 * «Mac · Chrome», «iPhone · Safari», «Muninn para Windows», «Claude · app conectada»: el nombre que enseña la lista de
 * sesiones. `appName` es la app OAuth que abrió la sesión (claude.ai manda `python-httpx/…`, que no dice nada).
 */
export function sessionDeviceLabel(ua: string | null | undefined, appName?: string | null): string {
  if (appName) return `${appName} · app conectada`
  if (!ua) return 'Dispositivo desconocido'
  const os = /iPhone|iPod/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux|CrOS/.test(ua)
              ? 'Linux'
              : null
  // La app de escritorio (Tauri añade `Muninn/<versión>` al de WebView2 o WKWebView) y clientes que no son un navegador
  // (el MCP, scripts, servidores OAuth como el de claude.ai).
  if (/\bMuninn\/|Tauri/i.test(ua)) return os ? `Muninn para ${os}` : 'Muninn de escritorio'
  if (/^node|undici|Deno|supabase-js-node|curl|python-httpx|python-requests|aiohttp/i.test(ua))
    return 'Programa o servidor'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\/|FxiOS/.test(ua)
      ? 'Firefox'
      : /Chrome\/|CriOS/.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null
  if (os && browser) return `${os} · ${browser}`
  return os ?? browser ?? 'Dispositivo desconocido'
}

/**
 * Seguridad de la cuenta (ADR-0061): dónde está abierta la sesión y cerrarla. Es Supabase Auth, no datos del usuario,
 * pero pasa por el core igual que lo demás: la UI no habla con Supabase y la demo lo simula en memoria.
 */
export function createAccount({ store, parse }: AccountContext) {
  const auth = (): AccountStore => {
    if (!store.account)
      throw new Error('La seguridad de la cuenta solo está disponible con una cuenta')
    return store.account
  }

  /** Si hay sesiones y seguridad que enseñar (con cuenta o en la demo; no en el fichero local del MCP). */
  const available = () => Boolean(store.account)

  /** Sesiones abiertas: la de este dispositivo primero y el resto de la más reciente a la más antigua. */
  async function sessions(): Promise<AccountSession[]> {
    const list = await auth().sessions()
    return [...list].sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        (a.lastActiveAt < b.lastActiveAt ? 1 : a.lastActiveAt > b.lastActiveAt ? -1 : 0),
    )
  }

  /**
   * Cierra la sesión de otro dispositivo. La de este no: para eso está «Cerrar sesión», que además limpia lo guardado
   * aquí. No hay «Deshacer»: una sesión cerrada solo se recupera volviendo a entrar en ese dispositivo.
   */
  async function revokeSession(id: string) {
    const current = (await auth().sessions()).find((s) => s.current)
    if (current?.id === id)
      throw new Error('Esta es la sesión de este dispositivo: usa «Cerrar sesión»')
    return auth().revokeSession(id)
  }

  /** Cierra la sesión en los demás dispositivos (`others`) o en todos, este incluido (`global`). */
  const signOut = async (scope: SignOutScope) => auth().signOut(parse(signOutScope, scope))

  // ─── Segundo factor (TOTP) ───────────────────────────────────────────────

  /** Factores TOTP de la cuenta, el confirmado primero. Muninn ofrece uno: una app de códigos. */
  async function factors(): Promise<MfaFactor[]> {
    const list = await auth().mfa.factors()
    return [...list].sort(
      (a, b) => Number(b.status === 'verified') - Number(a.status === 'verified'),
    )
  }

  /** El factor confirmado, si lo hay: con él, la cuenta pide el código al entrar. */
  const active = async () => (await factors()).find((f) => f.status === 'verified') ?? null

  /**
   * Empieza el alta: devuelve el QR y el secreto. No cuenta hasta `confirm` con un primer código. Un alta anterior que se
   * quedó a medias se borra antes (Supabase no deja dos factores con el mismo nombre).
   */
  async function enroll(name = 'App de códigos'): Promise<MfaEnrollment> {
    const label = parse(mfaFactorName, name)
    const list = await factors()
    if (list.some((f) => f.status === 'verified'))
      throw new Error('Ya tienes el segundo factor activado')
    for (const f of list) await auth().mfa.unenroll(f.id)
    return auth().mfa.enroll(label)
  }

  /** Confirma el alta con el primer código de la app. Desde ese momento, entrar pide el código. */
  const confirm = async (factorId: string, code: string) =>
    auth().mfa.verify(factorId, parse(mfaCode, code))

  /**
   * Desactiva el segundo factor. Pide un código actual, para que quien tenga la sesión abierta sin el móvil no pueda
   * quitarlo (y porque Supabase exige `aal2` para borrar un factor confirmado). No hay «Deshacer»: volver a activarlo
   * es darlo de alta otra vez, con otro secreto.
   */
  async function disable(code: string) {
    const token = parse(mfaCode, code)
    const factor = await active()
    if (!factor) throw new Error('No tienes el segundo factor activado')
    await auth().mfa.verify(factor.id, token)
    await auth().mfa.unenroll(factor.id)
  }

  const assurance = () => auth().mfa.assurance()

  // ─── Apps con acceso (OAuth) ─────────────────────────────────────────────

  /** Apps a las que diste acceso a tu cuenta (claude.ai y otros clientes del MCP remoto), la más reciente primero. */
  async function apps() {
    const list = await auth().oauthGrants.list()
    return [...list].sort((a, b) =>
      a.grantedAt < b.grantedAt ? 1 : a.grantedAt > b.grantedAt ? -1 : 0,
    )
  }

  /**
   * Quita el acceso a una app: sus sesiones se cierran y sus tokens dejan de valer. No hay «Deshacer»: el permiso solo se
   * da desde la propia app, pasando por la pantalla de autorización (ADR-0036).
   */
  async function revokeApp(clientId: string) {
    const id = parse(z.uuid(), clientId)
    await auth().oauthGrants.revoke(id)
  }

  return {
    available,
    sessions: { list: sessions, revoke: revokeSession, signOut },
    mfa: { factors, active, enroll, confirm, disable, assurance },
    apps: { list: apps, revoke: revokeApp },
  }
}
