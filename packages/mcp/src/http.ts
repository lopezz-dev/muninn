import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { Muninn } from '@muninn/core'
import { createMuninnMcpServer } from './server'

/**
 * MCP remoto por HTTP (Streamable HTTP, ADR-0033). Es un manejador `Request → Response` de la API web estándar:
 * sirve igual en Node (`index.ts --http`), en una Edge Function de Supabase (Deno) o en tests, sin red.
 *
 * - **Sin estado:** cada petición crea su servidor MCP y su transporte (no hay sesiones que guardar entre
 *   instancias). Las herramientas son las mismas que por stdio: sin borrados definitivos (ADR-0009).
 * - **Autenticación:** `Authorization: Bearer <token de acceso de Supabase del usuario>`. `authenticate` lo valida
 *   y devuelve el core de ese usuario (con su sesión, así que RLS sigue mandando); sin token válido, 401 con la
 *   pista de dónde están los metadatos OAuth (RFC 9728), que es lo que piden claude.ai y los clientes móviles.
 * - **Origin:** si la petición trae `Origin` (un navegador), solo se acepta de `allowedOrigins` (protección contra
 *   *DNS rebinding*, como pide la especificación). Los clientes de escritorio no mandan `Origin`.
 */

export const METADATA_PATH = '/.well-known/oauth-protected-resource'

export interface McpHttpOptions {
  /** Valida el token y devuelve el core del usuario, o `null` si no vale (caducado, falso…). */
  authenticate(token: string): Promise<Muninn | null>
  /** URL pública del endpoint MCP (p. ej. `https://<ref>.supabase.co/functions/v1/mcp`). */
  resourceUrl: string
  /** Servidor de autorización OAuth (Supabase Auth: `https://<ref>.supabase.co/auth/v1`). Sin él, no hay metadatos. */
  authorizationServer?: string
  /** Orígenes de navegador permitidos (CORS). Por defecto, ninguno. */
  allowedOrigins?: string[]
  /** Errores inesperados (a stderr o a los logs de la función). */
  onError?: (err: unknown) => void
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

/** Error en forma JSON-RPC, como los del propio transporte, para que el cliente lo enseñe. */
const rpcError = (status: number, message: string, headers: Record<string, string> = {}) =>
  json(status, { jsonrpc: '2.0', error: { code: -32000, message }, id: null }, headers)

export function createMcpHttpHandler(options: McpHttpOptions) {
  const resource = options.resourceUrl.replace(/\/+$/, '')
  const metadataUrl = `${resource}${METADATA_PATH}`
  const allowed = new Set(options.allowedOrigins ?? [])

  const cors = (origin: string | null): Record<string, string> =>
    origin && allowed.has(origin)
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-headers':
            'authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id',
          'access-control-allow-methods': 'POST, GET, OPTIONS',
          'access-control-expose-headers': 'www-authenticate, mcp-session-id',
          vary: 'origin',
        }
      : {}

  /** `WWW-Authenticate` (RFC 6750 y RFC 9728): dónde están los metadatos y, si lo hay, el error. */
  const challenge = (error?: 'invalid_token') => {
    const params = [
      options.authorizationServer ? `resource_metadata="${metadataUrl}"` : null,
      error ? `error="${error}"` : null,
    ].filter(Boolean)
    return params.length ? `Bearer ${params.join(', ')}` : 'Bearer'
  }

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const origin = req.headers.get('origin')
    if (origin && !allowed.has(origin)) return rpcError(403, 'Origen no permitido')
    const h = cors(origin)

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })

    if (url.pathname.endsWith(METADATA_PATH)) {
      if (req.method !== 'GET' || !options.authorizationServer) return json(404, {}, h)
      return json(
        200,
        {
          resource,
          authorization_servers: [options.authorizationServer],
          bearer_methods_supported: ['header'],
          resource_name: 'Muninn',
        },
        h,
      )
    }

    // Sin estado no hay flujo SSE que abrir con GET ni sesión que cerrar con DELETE.
    if (req.method !== 'POST') return rpcError(405, 'Usa POST', { ...h, allow: 'POST, OPTIONS' })

    const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1]?.trim()
    if (!token) {
      return rpcError(401, 'Falta el token de acceso', { ...h, 'www-authenticate': challenge() })
    }
    let app: Muninn | null
    try {
      app = await options.authenticate(token)
    } catch (err) {
      options.onError?.(err)
      app = null
    }
    if (!app) {
      return rpcError(401, 'Token no válido o caducado', {
        ...h,
        'www-authenticate': challenge('invalid_token'),
      })
    }

    const server = createMuninnMcpServer(app)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    try {
      await server.connect(transport)
      const res = await transport.handleRequest(req)
      const headers = new Headers(res.headers)
      for (const [k, v] of Object.entries(h)) headers.set(k, v)
      // El cuerpo ya está listo (respuesta JSON): se puede cerrar el servidor de esta petición.
      const body = await res.arrayBuffer()
      return new Response(res.status === 202 || res.status === 204 ? null : body, {
        status: res.status,
        headers,
      })
    } catch (err) {
      options.onError?.(err)
      return rpcError(500, 'Error interno del servidor MCP', h)
    } finally {
      await server.close().catch(() => {})
    }
  }
}
