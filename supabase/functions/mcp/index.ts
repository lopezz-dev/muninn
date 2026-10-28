// Edge Function de Supabase (Deno): el MCP de Muninn por HTTP, para usarlo desde el móvil o desde claude.ai (ADR-0033).
// La lógica está en packages/mcp (`http.ts`, con tests); aquí solo se lee la configuración.
// Antes de desplegar: `pnpm --filter @muninn/mcp build:edge` (genera ./_mcp/mcp.js). Pasos en docs/gotchas/mcp.md,
// «MCP remoto (pasos manuales)».
//
//   POST /functions/v1/mcp                                       ← cliente MCP con `Authorization: Bearer <token de Supabase>`
//   GET  /functions/v1/mcp/.well-known/oauth-protected-resource  ← metadatos OAuth (RFC 9728)

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { createMcpHttpHandler, supabaseAuthenticator } from './_mcp/mcp.js'

const env = (name: string) => Deno.env.get(name) ?? ''
const url = env('SUPABASE_URL').replace(/\/+$/, '')

const handle = createMcpHttpHandler({
  // Con la clave pública y el token de cada petición: RLS decide qué ve cada usuario. Nunca la service role.
  authenticate: supabaseAuthenticator({
    url,
    publishableKey: env('MUNINN_PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY'),
    createClient,
    timeZone: env('MUNINN_TIME_ZONE') || 'Europe/Madrid',
  }),
  resourceUrl: `${url}/functions/v1/mcp`,
  authorizationServer: `${url}/auth/v1`,
  allowedOrigins: env('MUNINN_MCP_ALLOWED_ORIGINS').split(',').filter(Boolean),
  onError: (err: unknown) => console.error(err),
})

Deno.serve((req: Request) => handle(req))
