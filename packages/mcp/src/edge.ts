/**
 * Lo que necesita la Edge Function `mcp` (supabase/functions/mcp): el manejador HTTP y la autenticación con
 * Supabase, con el core, el SDK de MCP y zod dentro (`pnpm --filter @muninn/mcp build:edge`). supabase-js no
 * va dentro: la función lo importa de npm y lo inyecta.
 */
export { createMcpHttpHandler } from './http'
export { supabaseAuthenticator } from './supabase-auth'
