// Edge Function de Supabase (Deno): aviso por correo al entrar desde un dispositivo sin nombre o nuevo (ADR-0080). Corre con el
// ordenador apagado. Qué sesión avisar y el texto del correo los decide @muninn/core (`login-alerts.ts`, con tests); aquí
// solo se leen secretos y se envía con la API de Resend. Antes de desplegar: `pnpm --filter @muninn/core build:edge`
// (genera ./_core/muninn.js). Pasos completos en docs/gotchas/db.md, «Aviso de dispositivo nuevo (pasos manuales)».
//
//   POST /functions/v1/security/login-alerts  ← pg_cron cada 5 minutos (cabecera x-muninn-sync-secret).

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  listKnownDevices,
  listPendingLogins,
  pruneLoginAlertLog,
  recordLogins,
  runLoginAlerts,
  sameSecret,
} from './_core/muninn.js'

const env = (name: string) => Deno.env.get(name) ?? ''

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

/** Sin clave, remitente o dirección de la app no se puede escribir el correo: mejor un error claro que avisos que no llegan. */
function mailConfig() {
  const apiKey = env('RESEND_API_KEY')
  const from = env('MUNINN_MAIL_FROM')
  const appUrl = env('MUNINN_APP_URL')
  if (!apiKey || !from || !appUrl) {
    throw new Error('Faltan los secretos RESEND_API_KEY, MUNINN_MAIL_FROM o MUNINN_APP_URL')
  }
  return { apiKey, from, appUrl }
}

Deno.serve(async (req: Request) => {
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  if (route !== 'login-alerts') return json(404, { error: 'Usa POST /security/login-alerts' })
  if (req.method !== 'POST') return json(405, { error: 'Solo POST' })
  if (!sameSecret(env('MUNINN_SYNC_SECRET'), req.headers.get('x-muninn-sync-secret'))) {
    return json(401, { error: 'Falta el secreto del cron' })
  }
  try {
    const { apiKey, from, appUrl } = mailConfig()
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const summary = await runLoginAlerts({
      pending: () => listPendingLogins(db),
      known: (owners: string[]) => listKnownDevices(db, owners),
      record: (rows) => recordLogins(db, rows),
      send: async (mail: { to: string; subject: string; text: string; html: string }) => {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from, ...mail, to: [mail.to] }),
        })
        if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
      },
      appUrl,
      timeZone: env('MUNINN_TIME_ZONE') || 'Europe/Madrid',
    })
    return json(200, { ...summary, pruned: await pruneLoginAlertLog(db) })
  } catch (err) {
    // Los logs van al panel de Supabase (Edge Functions › security › Logs).
    console.error(err)
    return json(500, { error: err instanceof Error ? err.message : String(err) })
  }
})
