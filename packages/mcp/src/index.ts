#!/usr/bin/env node
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMuninn, type Store } from '@muninn/core'
import { createFileStore } from '@muninn/core/file-store'
import { createSupabaseStore } from '@muninn/core/supabase'
import { createClient } from '@supabase/supabase-js'
import { createMcpHttpHandler } from './http'
import { createMuninnMcpServer } from './server'
import { supabaseAuthenticator } from './supabase-auth'

/**
 * Configuración por variables de entorno:
 *  - Supabase: MUNINN_SUPABASE_URL, MUNINN_SUPABASE_SERVICE_ROLE_KEY, MUNINN_USER_ID
 *  - Local:    MUNINN_DATA_FILE (por defecto ~/.muninn/data.json) — se usa si no hay Supabase.
 * stdout es el canal MCP: los logs van siempre a stderr.
 *
 * Con `--http` (o MUNINN_MCP_HTTP=1) sirve el MCP remoto por HTTP en lugar de stdio (ADR-0033): cada petición
 * trae el token de acceso de Supabase del usuario y no se usa la service role. Variables:
 * MUNINN_SUPABASE_URL, MUNINN_SUPABASE_PUBLISHABLE_KEY, MUNINN_MCP_PORT (8787), MUNINN_MCP_HOST (127.0.0.1),
 * MUNINN_MCP_PUBLIC_URL (la que ven los clientes) y MUNINN_MCP_ALLOWED_ORIGINS (separados por comas).
 */
function storeFromEnv(): { store: Store; label: string } {
  const { MUNINN_SUPABASE_URL, MUNINN_SUPABASE_SERVICE_ROLE_KEY, MUNINN_USER_ID } = process.env
  if (MUNINN_SUPABASE_URL) {
    if (!MUNINN_SUPABASE_SERVICE_ROLE_KEY || !MUNINN_USER_ID) {
      throw new Error(
        'Con MUNINN_SUPABASE_URL hacen falta MUNINN_SUPABASE_SERVICE_ROLE_KEY y MUNINN_USER_ID',
      )
    }
    const client = createClient(MUNINN_SUPABASE_URL, MUNINN_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return {
      store: createSupabaseStore(client, MUNINN_USER_ID),
      label: `supabase ${MUNINN_SUPABASE_URL}`,
    }
  }
  const file = process.env.MUNINN_DATA_FILE ?? join(homedir(), '.muninn', 'data.json')
  return { store: createFileStore(file), label: `fichero ${file}` }
}

/** MCP remoto (HTTP) en Node: adapta `node:http` al manejador `Request → Response` de `http.ts`. */
function serveHttp() {
  const env = process.env
  const url = env.MUNINN_SUPABASE_URL
  const key = env.MUNINN_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('El modo --http necesita MUNINN_SUPABASE_URL y MUNINN_SUPABASE_PUBLISHABLE_KEY')
  }
  const port = Number(env.MUNINN_MCP_PORT ?? 8787)
  const host = env.MUNINN_MCP_HOST ?? '127.0.0.1'
  const handle = createMcpHttpHandler({
    authenticate: supabaseAuthenticator({ url, publishableKey: key, createClient }),
    resourceUrl: env.MUNINN_MCP_PUBLIC_URL ?? `http://${host}:${port}/mcp`,
    authorizationServer: `${url.replace(/\/+$/, '')}/auth/v1`,
    allowedOrigins: (env.MUNINN_MCP_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    onError: (err) => console.error('[muninn-mcp]', err),
  })
  createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v)
      else if (Array.isArray(v)) headers.set(k, v.join(', '))
    }
    const body = chunks.length && req.method !== 'GET' ? Buffer.concat(chunks) : undefined
    const response = await handle(
      new Request(`http://${req.headers.host ?? `${host}:${port}`}${req.url ?? '/'}`, {
        method: req.method,
        headers,
        body,
      }),
    )
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  }).listen(port, host, () => {
    console.error(`[muninn-mcp] HTTP en http://${host}:${port}/mcp · Supabase ${url}`)
  })
}

if (process.argv.includes('--http') || process.env.MUNINN_MCP_HTTP === '1') {
  serveHttp()
} else {
  const { store, label } = storeFromEnv()
  const server = createMuninnMcpServer(createMuninn(store, { actor: 'mcp' }))
  await server.connect(new StdioServerTransport())
  console.error(`[muninn-mcp] listo · datos en ${label}`)
}
