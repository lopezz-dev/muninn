// Edge Function de Supabase (Deno): guarda los tipos de cambio de referencia del BCE en `fx_rates` (ADR-0085).
// La lógica (qué fichero pedir y cómo leerlo) está en @muninn/core (`fx.ts`, con tests); aquí solo se leen secretos,
// se descarga y se escribe. Antes de desplegar: `pnpm --filter @muninn/core build:edge` (genera ./_core/muninn.js).
// Pasos completos en docs/gotchas/db.md, «Divisas: tipos del BCE con la Edge Function (pasos manuales)». Sin desplegar.
//
//   POST /functions/v1/fx/fetch  ← pg_cron de lunes a viernes por la tarde, con la cabecera x-muninn-sync-secret.
//                                  Cuerpo opcional `{ "history": true }`: vuelve a cargar el histórico desde 2015.
//
// Las direcciones del BCE son fijas (`ECB_URLS`): nada que escriba un usuario se descarga desde aquí.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  ECB_URLS,
  FX_HISTORY_FROM,
  latestFxDate,
  parseEcbRates,
  planEcbFetch,
  sameSecret,
  upsertFxRates,
} from './_core/muninn.js'

const env = (name: string) => Deno.env.get(name) ?? ''

const admin = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

// Solo la llama el cron (sin navegador), pero contestar el preflight no cuesta nada (gotchas/db, CORS).
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type, x-muninn-sync-secret',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  })

/** Descarga un fichero del BCE con un tiempo máximo (el histórico pesa unos 8 MB). */
async function download(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { accept: 'application/xml, text/xml' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`BCE ${url}: ${res.status} ${res.statusText}`)
  return await res.text()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  if (route !== 'fetch') return json(404, { error: 'Usa POST /fx/fetch' })
  if (req.method !== 'POST') return json(405, { error: 'Solo POST' })
  if (!sameSecret(env('MUNINN_SYNC_SECRET'), req.headers.get('x-muninn-sync-secret'))) {
    return json(401, { error: 'Falta el secreto del cron' })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const db = admin()
    const latest = await latestFxDate(db)
    const today = new Date().toISOString().slice(0, 10)
    const file = body?.history === true ? 'history' : planEcbFetch(latest, today)
    const rates = parseEcbRates(await download(ECB_URLS[file]), { since: FX_HISTORY_FROM })
    if (rates.length === 0) throw new Error(`El fichero ${file} del BCE no trae ningún tipo`)
    const saved = await upsertFxRates(db, rates)
    const days = new Set(rates.map((r) => r.date))
    const newest = rates.reduce((max, r) => (r.date > max ? r.date : max), '')
    return json(200, { file, previous: latest, latest: newest, days: days.size, rows: saved })
  } catch (err) {
    // Los logs van al panel de Supabase (Edge Functions › fx › Logs).
    console.error(err)
    return json(500, { error: err instanceof Error ? err.message : String(err) })
  }
})
