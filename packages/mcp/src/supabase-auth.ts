import { createMuninn, type Muninn } from '@muninn/core'
import { createSupabaseStore } from '@muninn/core/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// biome-ignore lint/suspicious/noExplicitAny: cliente genérico sin tipos generados, como en el core.
type Client = SupabaseClient<any, any, any>

/**
 * `authenticate` del MCP remoto con Supabase: comprueba el token de acceso del usuario con Supabase Auth y
 * devuelve un core que escribe **con ese mismo token** (clave pública + sesión del usuario), así que RLS
 * sigue filtrando por dueño. Nunca usa la service role.
 *
 * `createClient` se inyecta para que sirva el de npm en Node y en Deno.
 */
export function supabaseAuthenticator(options: {
  url: string
  /** Clave pública (`sb_publishable_…` o la anon). */
  publishableKey: string
  createClient: (url: string, key: string, opts: object) => Client
  timeZone?: string
}) {
  const base = { auth: { persistSession: false, autoRefreshToken: false } }
  const anon = options.createClient(options.url, options.publishableKey, base)

  return async function authenticate(token: string): Promise<Muninn | null> {
    const { data, error } = await anon.auth.getUser(token)
    if (error || !data.user) return null
    const client = options.createClient(options.url, options.publishableKey, {
      ...base,
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    return createMuninn(createSupabaseStore(client, data.user.id), {
      actor: 'mcp',
      timeZone: options.timeZone,
    })
  }
}
