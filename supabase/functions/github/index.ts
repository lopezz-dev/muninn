// Edge Function de Supabase (Deno): sincroniza las issues de GitHub con las tareas de Muninn (ADR-0031).
// Toda la lógica está en @muninn/core (`github-sync.ts`, con tests); aquí solo se leen los secretos y se enruta.
// Antes de desplegar: `pnpm --filter @muninn/core build:edge` (genera ./_core/muninn.js). Pasos completos en
// docs/gotchas/db.md, «Sincronización con GitHub (pasos manuales)».
//
//   POST /functions/v1/github/webhook  ← GitHub (evento `issues`, firmado con GITHUB_WEBHOOK_SECRET)
//   POST /functions/v1/github/sync     ← pg_cron cada pocos minutos (cabecera x-muninn-sync-secret)
//   GET  /functions/v1/github/repos    ← la app (Ajustes › Integraciones), con la sesión del dueño (ADR-0035)
//   GET  /functions/v1/github/access?repo=owner/repo  ← ídem, al elegir un repo público: ¿llega el token?

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  bearerToken,
  createGithubClient,
  createMuninn,
  createSupabaseStore,
  handleGithubWebhook,
  reconcileGithub,
  sameSecret,
  verifyGithubSignature,
} from './_core/muninn.js'

const env = (name: string) => Deno.env.get(name) ?? ''

/** Mismo formato que `githubRepo` del core: así no se manda a GitHub una ruta rara. */
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

const admin = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

/** El core con la service role, ligado al dueño de los proyectos (como el MCP: un usuario por despliegue). */
function muninn() {
  const userId = env('MUNINN_USER_ID')
  if (!userId) throw new Error('Falta el secreto MUNINN_USER_ID')
  return createMuninn(createSupabaseStore(admin(), userId), {
    actor: 'github',
    // «Hoy» es el del usuario, no el del servidor (gotchas/core).
    timeZone: env('MUNINN_TIME_ZONE') || 'Europe/Madrid',
  })
}

function github() {
  const token = env('GITHUB_TOKEN')
  if (!token) throw new Error('Falta el secreto GITHUB_TOKEN')
  return createGithubClient({ token })
}

// `/repos` lo llama el navegador (con preflight por la cabecera Authorization). Sin cookies: `*` basta.
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  })

/** ¿La petición trae la sesión del dueño de este despliegue? (Solo él ve los repos del token.) */
async function isOwner(req: Request) {
  const jwt = bearerToken(req.headers.get('authorization'))
  if (!jwt) return false
  const { data, error } = await admin().auth.getUser(jwt)
  return !error && data.user?.id === env('MUNINN_USER_ID')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  try {
    if (route === 'repos' || route === 'access') {
      if (req.method !== 'GET') return json(405, { error: 'Solo GET' })
      if (!(await isOwner(req)))
        return json(401, { error: 'Inicia sesión con tu cuenta de Muninn' })
      if (route === 'repos') return json(200, { repos: await github().listRepos() })
      const repo = new URL(req.url).searchParams.get('repo') ?? ''
      if (!REPO.test(repo)) return json(400, { error: 'Falta ?repo=owner/repo' })
      return json(200, { repo, writable: await github().canWriteIssues(repo) })
    }
    if (req.method !== 'POST') return json(405, { error: 'Solo POST' })
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
      return json(200, await reconcileGithub(muninn(), github()))
    }
    return json(404, { error: 'Usa /github/webhook, /github/sync, /github/repos o /github/access' })
  } catch (err) {
    // Los logs van al panel de Supabase (Edge Functions › github › Logs).
    console.error(err)
    return json(500, { error: err instanceof Error ? err.message : String(err) })
  }
})
