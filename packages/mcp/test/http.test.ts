import { createMemoryStore, createMuninn, type Muninn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import { createMcpHttpHandler, METADATA_PATH } from '../src/http'
import { supabaseAuthenticator } from '../src/supabase-auth'

const RESOURCE = 'https://ref.supabase.co/functions/v1/mcp'
const AS = 'https://ref.supabase.co/auth/v1'

/** Dos usuarios, cada uno con su store: el token decide cuál se usa. */
function setup() {
  const users: Record<string, Muninn> = {
    'token-ana': createMuninn(createMemoryStore(), { actor: 'mcp' }),
    'token-bea': createMuninn(createMemoryStore(), { actor: 'mcp' }),
  }
  const handle = createMcpHttpHandler({
    authenticate: async (token) => users[token] ?? null,
    resourceUrl: `${RESOURCE}/`,
    authorizationServer: AS,
    allowedOrigins: ['https://claude.ai'],
  })
  let id = 0
  const rpc = (
    method: string,
    params: Record<string, unknown> = {},
    opts: { token?: string; origin?: string } = {},
  ) =>
    handle(
      new Request(RESOURCE, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
          ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
          ...(opts.origin ? { origin: opts.origin } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      }),
    )
  const call = async (token: string, name: string, args: Record<string, unknown> = {}) => {
    const res = await rpc('tools/call', { name, arguments: args }, { token })
    const body = (await res.json()) as {
      result: { content: { text: string }[]; isError?: boolean }
    }
    const text = body.result.content[0]?.text ?? ''
    return body.result.isError ? { error: text } : JSON.parse(text)
  }
  return { handle, rpc, call, users }
}

describe('MCP por HTTP', () => {
  it('sin token: 401 con la pista de los metadatos OAuth', async () => {
    const { rpc } = setup()
    const res = await rpc('tools/list')
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${RESOURCE}${METADATA_PATH}"`,
    )
  })

  it('token falso: 401 invalid_token', async () => {
    const { rpc } = setup()
    const res = await rpc('tools/list', {}, { token: 'otro' })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('error="invalid_token"')
  })

  it('sirve los metadatos del recurso protegido (RFC 9728)', async () => {
    const { handle } = setup()
    const res = await handle(new Request(`${RESOURCE}${METADATA_PATH}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      resource: RESOURCE,
      authorization_servers: [AS],
      bearer_methods_supported: ['header'],
      resource_name: 'Muninn',
    })
  })

  it('con token: inicializa, lista las herramientas (sin borrados) y llama', async () => {
    const { rpc, call } = setup()
    const init = await rpc(
      'initialize',
      {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      },
      { token: 'token-ana' },
    )
    expect(init.status).toBe(200)
    expect(
      ((await init.json()) as { result: { serverInfo: { name: string } } }).result.serverInfo.name,
    ).toBe('muninn')
    const list = await rpc('tools/list', {}, { token: 'token-ana' })
    const names = (
      (await list.json()) as { result: { tools: { name: string }[] } }
    ).result.tools.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['overview', 'create_task', 'archive_task']))
    expect(names.some((n) => n.startsWith('delete'))).toBe(false)

    await call('token-ana', 'create_project', { name: 'Muninn' })
    const task = await call('token-ana', 'create_task', {
      project: 'muninn',
      title: 'Desde el móvil',
    })
    expect(task.source).toBe('mcp')
  })

  it('cada token ve solo sus datos', async () => {
    const { call } = setup()
    await call('token-ana', 'create_project', { name: 'De Ana' })
    expect(await call('token-bea', 'list_projects')).toEqual([])
    expect((await call('token-ana', 'list_projects')).map((p: { name: string }) => p.name)).toEqual(
      ['De Ana'],
    )
  })

  it('Origin: solo los permitidos, con CORS; GET y DELETE no se usan', async () => {
    const { rpc, handle } = setup()
    expect(
      (await rpc('tools/list', {}, { token: 'token-ana', origin: 'https://malo.example' })).status,
    ).toBe(403)
    const ok = await rpc('tools/list', {}, { token: 'token-ana', origin: 'https://claude.ai' })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://claude.ai')
    const pre = await handle(
      new Request(RESOURCE, { method: 'OPTIONS', headers: { origin: 'https://claude.ai' } }),
    )
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization')
    expect(
      (await handle(new Request(RESOURCE, { headers: { authorization: 'Bearer token-ana' } })))
        .status,
    ).toBe(405)
    expect(
      (
        await handle(
          new Request(RESOURCE, {
            method: 'DELETE',
            headers: { authorization: 'Bearer token-ana' },
          }),
        )
      ).status,
    ).toBe(405)
  })

  it('si authenticate lanza, es un 401 y se avisa por onError', async () => {
    const errors: unknown[] = []
    const handle = createMcpHttpHandler({
      authenticate: async () => {
        throw new Error('Supabase caído')
      },
      resourceUrl: RESOURCE,
      onError: (e) => errors.push(e),
    })
    const res = await handle(
      new Request(RESOURCE, { method: 'POST', headers: { authorization: 'Bearer x' }, body: '{}' }),
    )
    expect(res.status).toBe(401)
    // Sin servidor de autorización no hay metadatos que anunciar.
    expect(res.headers.get('www-authenticate')).toBe('Bearer error="invalid_token"')
    expect(errors).toHaveLength(1)
  })
})

describe('autenticación con Supabase', () => {
  it('valida el token con Auth y escribe con la sesión del usuario, no con la service role', async () => {
    const created: { key: string; headers?: Record<string, string> }[] = []
    const fakeCreate = ((
      _url: string,
      key: string,
      opts: { global?: { headers?: Record<string, string> } },
    ) => {
      created.push({ key, headers: opts.global?.headers })
      return {
        auth: {
          getUser: async (token: string) =>
            token === 'bueno'
              ? { data: { user: { id: '00000000-0000-4000-8000-000000000001' } }, error: null }
              : { data: { user: null }, error: new Error('invalid JWT') },
        },
      }
    }) as never
    const authenticate = supabaseAuthenticator({
      url: 'https://ref.supabase.co',
      publishableKey: 'sb_publishable_x',
      createClient: fakeCreate,
    })
    expect(await authenticate('malo')).toBeNull()
    expect(await authenticate('bueno')).not.toBeNull()
    expect(created.every((c) => c.key === 'sb_publishable_x')).toBe(true)
    expect(created.at(-1)?.headers).toEqual({ Authorization: 'Bearer bueno' })
  })
})
