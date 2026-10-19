#!/usr/bin/env node
import { homedir } from 'node:os'
import { join } from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMuninn, type Store } from '@muninn/core'
import { createFileStore } from '@muninn/core/file-store'
import { createSupabaseStore } from '@muninn/core/supabase'
import { createClient } from '@supabase/supabase-js'
import { createMuninnMcpServer } from './server'

/**
 * Configuración por variables de entorno:
 *  - Supabase: MUNINN_SUPABASE_URL, MUNINN_SUPABASE_SERVICE_ROLE_KEY, MUNINN_USER_ID
 *  - Local:    MUNINN_DATA_FILE (por defecto ~/.muninn/data.json) — se usa si no hay Supabase.
 * stdout es el canal MCP: los logs van siempre a stderr.
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

const { store, label } = storeFromEnv()
const server = createMuninnMcpServer(createMuninn(store, { actor: 'mcp' }))
await server.connect(new StdioServerTransport())
console.error(`[muninn-mcp] listo · datos en ${label}`)
