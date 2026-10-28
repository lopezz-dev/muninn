import type { z } from 'zod'
import { type AccountSession, type SignOutScope, signOutScope } from './schemas'
import type { AccountStore, Store } from './store'

export interface AccountContext {
  store: Store
  parse: <S extends z.ZodType>(schema: S, value: unknown) => z.output<S>
}

/** «Mac · Chrome», «iPhone · Safari», «Muninn para Windows»: el nombre que enseña la lista de sesiones. */
export function sessionDeviceLabel(ua: string | null | undefined): string {
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
  // La app de escritorio (Tauri) y clientes que no son un navegador (el MCP, scripts).
  if (/Tauri/i.test(ua)) return os ? `Muninn para ${os}` : 'Muninn de escritorio'
  if (/^node|undici|Deno|supabase-js-node|curl/i.test(ua)) return 'Programa o servidor'
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

  return {
    available,
    sessions: { list: sessions, revoke: revokeSession, signOut },
  }
}
