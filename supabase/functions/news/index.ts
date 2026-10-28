// Edge Function de Supabase (Deno): descarga las fuentes RSS de Noticias (ADR-0042). Corre con el ordenador apagado.
// Toda la lógica está en @muninn/core (`news.ts` y `news-feed.ts`, con tests); aquí solo se leen secretos y se enruta.
// Antes de desplegar: `pnpm --filter @muninn/core build:edge` (genera ./_core/muninn.js). Pasos completos en
// docs/gotchas/db.md, «Noticias: descarga con la Edge Function (pasos manuales)». Desplegada el 26-10-2026.
//
//   POST /functions/v1/news/fetch  ← pg_cron cada hora (cabecera x-muninn-sync-secret): todas las fuentes activas de
//                                     todos los usuarios y la limpieza de lo antiguo; o la app con la sesión del
//                                     usuario («Actualizar»): solo sus fuentes, con RLS.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  bearerToken,
  createMuninn,
  createSupabaseStore,
  listNewsOwners,
  pruneNews,
  sameSecret,
} from './_core/muninn.js'

const env = (name: string) => Deno.env.get(name) ?? ''
const timeZone = () => env('MUNINN_TIME_ZONE') || 'Europe/Madrid'

/**
 * Las IPs de un nombre, para no descargar nada que apunte dentro de la red de Supabase (SSRF, ADR-0042). Si el entorno
 * no tiene `Deno.resolveDns`, no se descarga nada: cada fuente queda con este error en vez de saltarse la comprobación.
 */
async function resolve(hostname: string): Promise<string[]> {
  if (typeof Deno.resolveDns !== 'function') {
    throw new Error('Este servidor no puede comprobar a qué dirección apunta la fuente')
  }
  const [v4, v6] = await Promise.all([
    Deno.resolveDns(hostname, 'A').catch(() => [] as string[]),
    Deno.resolveDns(hostname, 'AAAA').catch(() => [] as string[]),
  ])
  return [...v4, ...v6]
}
const feedOptions = { resolve }

const admin = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

// «Actualizar» lo pide el navegador (con preflight por la cabecera Authorization). Sin cookies: `*` basta.
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  })

/** El core del usuario de la petición, con su sesión y la clave pública: RLS manda (nunca la service role). */
async function userMuninn(req: Request) {
  const jwt = bearerToken(req.headers.get('authorization'))
  if (!jwt) return null
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser(jwt)
  if (error || !data.user) return null
  return createMuninn(createSupabaseStore(client, data.user.id), {
    actor: 'user',
    timeZone: timeZone(),
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  if (route !== 'fetch') return json(404, { error: 'Usa POST /news/fetch' })
  if (req.method !== 'POST') return json(405, { error: 'Solo POST' })
  try {
    if (sameSecret(env('MUNINN_SYNC_SECRET'), req.headers.get('x-muninn-sync-secret'))) {
      // Cron: usuario a usuario, con la service role y su `owner_id` explícito (gotchas/db).
      const db = admin()
      const owners = await listNewsOwners(db)
      const users = []
      for (const owner of owners) {
        const m = createMuninn(createSupabaseStore(db, owner), {
          actor: 'system',
          timeZone: timeZone(),
        })
        users.push(await m.news.refresh(fetch, feedOptions))
      }
      return json(200, { users: users.length, results: users, pruned: await pruneNews(db) })
    }
    const m = await userMuninn(req)
    if (!m) return json(401, { error: 'Inicia sesión con tu cuenta de Muninn' })
    return json(200, await m.news.refresh(fetch, feedOptions))
  } catch (err) {
    // Los logs van al panel de Supabase (Edge Functions › news › Logs).
    console.error(err)
    return json(500, { error: err instanceof Error ? err.message : String(err) })
  }
})
