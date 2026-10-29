import type { Session, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Hay credenciales de Supabase en el entorno. Sin ellas la app arranca en modo demo. */
export const hasSupabase = Boolean(url && key)

/** Dentro de la app de escritorio (Tauri). El OAuth de GitHub vuelve por deep link (ADR-0059). */
export const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM)

/** Clave fija de la sesión en localStorage (por defecto supabase-js usa `sb-<ref>-auth-token`). */
const SESSION_KEY = 'muninn.auth'
/** El usuario eligió probar sin cuenta. Se borra al salir de la demo. */
const DEMO_KEY = 'muninn.demo'

export interface Account {
  id: string
  email: string | null
  /** Nombre visible: el de GitHub si lo hay; si no, el correo. */
  name: string
  avatarUrl: string | null
  /** Con qué entró la última vez (`email`, `github`). */
  provider: string
}

/** `anonymous`: sin sesión ni demo; las rutas de la app mandan a /login. */
export type AuthState =
  | { kind: 'user'; account: Account }
  | { kind: 'demo' }
  | { kind: 'anonymous' }

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const readFlag = (k: string) => {
  try {
    return storage()?.getItem(k) ?? null
  } catch {
    return null
  }
}

const writeFlag = (k: string, v: string | null) => {
  try {
    if (v === null) storage()?.removeItem(k)
    else storage()?.setItem(k, v)
  } catch {
    // Sin almacenamiento, la elección dura hasta recargar.
  }
}

export function toAccount(session: Session): Account {
  const u = session.user
  const meta = u.user_metadata as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    id: u.id,
    email: u.email ?? null,
    name: text(meta.full_name) ?? text(meta.name) ?? text(meta.user_name) ?? u.email ?? 'Tú',
    avatarUrl: text(meta.avatar_url),
    provider: text(u.app_metadata.provider) ?? 'email',
  }
}

// ─── Cliente (diferido) ──────────────────────────────────────────────────────

let client: Promise<SupabaseClient> | undefined
const listeners = new Set<() => void>()

/** Avisa cuando cambia quién ha iniciado sesión (aquí o en otra pestaña). */
export function onAuthChange(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Cliente de Supabase con la sesión del usuario (RLS). supabase-js pesa bastante: se descarga solo
 * si hay una sesión guardada, si se vuelve de GitHub o al iniciar sesión, nunca en el bundle inicial.
 */
export function loadSupabase(): Promise<SupabaseClient> {
  if (!url || !key)
    return Promise.reject(new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const c = createClient(url, key, {
      auth: { storageKey: SESSION_KEY, flowType: 'pkce', detectSessionInUrl: true },
    })
    // Solo nos interesa si cambia el usuario: refrescar el token o volver a la pestaña no cuenta.
    c.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null
      if (resolvedUserId === undefined || next === resolvedUserId) return
      resetAuth()
      for (const l of listeners) l()
    })
    return c
  })
  return client
}

// ─── Estado de la sesión ─────────────────────────────────────────────────────

let current: Promise<AuthState> | undefined
/** Usuario del último estado resuelto (`undefined` = aún no resuelto). */
let resolvedUserId: string | null | undefined

/** Vuelve de GitHub con `?code=…` (PKCE): supabase-js lo canjea al crear el cliente. */
const isOAuthCallback = () =>
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('code')

async function resolve(): Promise<AuthState> {
  if (!hasSupabase) return { kind: 'demo' }
  const demo = readFlag(DEMO_KEY) === '1'
  // Sin sesión guardada no hace falta descargar supabase-js para saber que no hay nadie.
  if (!readFlag(SESSION_KEY) && !isOAuthCallback())
    return demo ? { kind: 'demo' } : { kind: 'anonymous' }
  const c = await loadSupabase()
  const { data } = await c.auth.getSession()
  if (data.session) {
    writeFlag(DEMO_KEY, null)
    return { kind: 'user', account: toAccount(data.session) }
  }
  return demo ? { kind: 'demo' } : { kind: 'anonymous' }
}

/** Estado de la sesión, memorizado: el `beforeLoad` raíz lo pide en cada navegación. */
export function getAuth(): Promise<AuthState> {
  current ??= resolve().then(
    (state) => {
      resolvedUserId = state.kind === 'user' ? state.account.id : null
      return state
    },
    (err) => {
      current = undefined
      throw err
    },
  )
  return current
}

/** Olvida el estado memorizado; la próxima navegación lo vuelve a resolver. */
export function resetAuth() {
  current = undefined
}

// ─── Acciones ────────────────────────────────────────────────────────────────
// Las del formulario de login (enviar y verificar el código, GitHub) van en `login-actions.ts`,
// dentro del chunk diferido de la pantalla.

/** Cierra la sesión solo en este dispositivo (las de otros siguen abiertas). */
export async function signOut() {
  const c = await loadSupabase()
  const { error } = await c.auth.signOut({ scope: 'local' })
  if (error) throw error
  resetAuth()
}

export function enterDemo() {
  writeFlag(DEMO_KEY, '1')
  resetAuth()
}

export function leaveDemo() {
  writeFlag(DEMO_KEY, null)
  resetAuth()
}

/** Solo rutas internas: evita que `?redirect=https://…` saque al usuario de la app. */
export function safeRedirect(target: unknown): string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/'
}
