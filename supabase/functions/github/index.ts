// Edge Function de Supabase (Deno): sincroniza las issues de GitHub con las tareas de Muninn (ADR-0031).
// Toda la lógica está en @muninn/core (`github-sync.ts`, con tests); aquí solo se leen los secretos y se enruta.
// Antes de desplegar: `pnpm --filter @muninn/core build:edge` (genera ./_core/muninn.js). Pasos completos en
// docs/gotchas/db.md, «Sincronización con GitHub (pasos manuales)».
//
//   POST /functions/v1/github/webhook  ← GitHub (evento `issues`, firmado con GITHUB_WEBHOOK_SECRET)
//   POST /functions/v1/github/sync     ← pg_cron cada pocos minutos (cabecera x-muninn-sync-secret)

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  createGithubClient,
  createMuninn,
  createSupabaseStore,
  handleGithubWebhook,
  reconcileGithub,
  sameSecret,
  verifyGithubSignature,
} from './_core/muninn.js'

const env = (name: string) => Deno.env.get(name) ?? ''

/** El core con la service role, ligado al dueño de los proyectos (como el MCP: un usuario por despliegue). */
function muninn() {
  const userId = env('MUNINN_USER_ID')
  if (!userId) throw new Error('Falta el secreto MUNINN_USER_ID')
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return createMuninn(createSupabaseStore(client, userId), {
    actor: 'github',
    // «Hoy» es el del usuario, no el del servidor (gotchas/core).
    timeZone: env('MUNINN_TIME_ZONE') || 'Europe/Madrid',
  })
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'Solo POST' })
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  try {
    if (route === 'webhook') {
      // La firma es del cuerpo tal cual: se lee como texto antes de interpretarlo.
      const body = await req.text()
      const signature = req.headers.get('x-hub-signature-256')
      if (!(await verifyGithubSignature(env('GITHUB_WEBHOOK_SECRET'), body, signature))) {
        return json(401, { error: 'Firma no válida' })
      }
      const result = await handleGithubWebhook(
        muninn(),
        req.headers.get('x-github-event'),
        JSON.parse(body),
      )
      return json(result.status, result.body)
    }
    if (route === 'sync') {
      if (!sameSecret(env('MUNINN_SYNC_SECRET'), req.headers.get('x-muninn-sync-secret'))) {
        return json(401, { error: 'Secreto no válido' })
      }
      const token = env('GITHUB_TOKEN')
      if (!token) throw new Error('Falta el secreto GITHUB_TOKEN')
      return json(200, await reconcileGithub(muninn(), createGithubClient({ token })))
    }
    return json(404, { error: 'Usa /github/webhook o /github/sync' })
  } catch (err) {
    // Los logs van al panel de Supabase (Edge Functions › github › Logs).
    console.error(err)
    return json(500, { error: err instanceof Error ? err.message : String(err) })
  }
})
