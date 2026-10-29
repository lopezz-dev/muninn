// Edge Function de Supabase (Deno): avisos Web Push (ADR-0040). Corre con el ordenador apagado.
// Qué avisar y a quién lo decide @muninn/core (`push.ts`, con tests); aquí solo se leen secretos, se firma con VAPID y se
// enruta. Antes de desplegar: `pnpm --filter @muninn/core build:edge` (genera ./_core/muninn.js). Pasos completos en
// docs/gotchas/web.md, «Publicar la PWA y activar Web Push (pasos manuales)».
//
//   POST /functions/v1/push/send  ← pg_cron cada mañana (cabecera x-muninn-sync-secret): a cada usuario con dispositivos,
//                                    un aviso por cobro de suscripción que entra en su ventana y aún no se avisó.
//   POST /functions/v1/push/test  ← la app con la sesión del usuario («Probar» en Ajustes › Notificaciones): un aviso
//                                    de prueba a sus dispositivos, con RLS.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import webpush from 'npm:web-push@3.6.7'
import {
  bearerToken,
  createMuninn,
  createSupabaseStore,
  listPushOwners,
  prunePushLog,
  sameSecret,
  TEST_ALERT,
} from './_core/muninn.js'

const env = (name: string) => Deno.env.get(name) ?? ''
const timeZone = () => env('MUNINN_TIME_ZONE') || 'Europe/Madrid'

/** Sin las tres claves VAPID no se puede firmar: mejor un error claro que avisos que nunca llegan. */
function vapid() {
  const publicKey = env('VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  const subject = env('VAPID_SUBJECT')
  if (!publicKey || !privateKey || !subject) {
    throw new Error('Faltan los secretos VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

/**
 * Entrega con `web-push` y devuelve el código del servicio de push. Un 404/410 llega como excepción con `statusCode`:
 * se devuelve tal cual para que el core borre la suscripción.
 */
// Mismo tipo que `PushSender` del core (el empaquetado no trae tipos).
const send = async (
  device: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string; tag: string },
): Promise<number> => {
  try {
    const res = await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(payload),
      // Un día: si el teléfono está apagado más tiempo, el aviso de cobro ya no sirve. `high` para que iOS lo enseñe ya.
      { TTL: 86_400, urgency: 'high' },
    )
    return res.statusCode
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (typeof status === 'number') {
      if (status !== 404 && status !== 410) console.error('push', status, (err as Error).message)
      return status
    }
    throw err
  }
}

const admin = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

// «Probar» lo pide el navegador (con preflight por la cabecera Authorization). Sin cookies: `*` basta.
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
  if (route !== 'send' && route !== 'test')
    return json(404, { error: 'Usa POST /push/send o /push/test' })
  if (req.method !== 'POST') return json(405, { error: 'Solo POST' })
  try {
    if (route === 'send') {
      if (!sameSecret(env('MUNINN_SYNC_SECRET'), req.headers.get('x-muninn-sync-secret'))) {
        return json(401, { error: 'Falta el secreto del cron' })
      }
      vapid()
      // Usuario a usuario, con la service role y su `owner_id` explícito (gotchas/db).
      const db = admin()
      const results = []
      for (const owner of await listPushOwners(db)) {
        const m = createMuninn(createSupabaseStore(db, owner), {
          actor: 'system',
          timeZone: timeZone(),
        })
        const alerts = await m.push.chargeAlerts()
        results.push({ alerts: alerts.length, ...(await m.push.deliver(alerts, send)) })
      }
      return json(200, { users: results.length, results, pruned: await prunePushLog(db) })
    }
    const m = await userMuninn(req)
    if (!m) return json(401, { error: 'Inicia sesión con tu cuenta de Muninn' })
    vapid()
    return json(200, await m.push.deliver([TEST_ALERT], send))
  } catch (err) {
    // Los logs van al panel de Supabase (Edge Functions › push › Logs).
    console.error(err)
    return json(500, { error: err instanceof Error ? err.message : String(err) })
  }
})
