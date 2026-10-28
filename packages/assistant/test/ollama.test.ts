import { describe, expect, it } from 'vitest'
import { createOllamaProvider, ProviderError, parseToolCalls, toOllamaMessages } from '../src'

/** Una respuesta NDJSON partida en trozos que no coinciden con las líneas, como llega por la red. */
function ndjson(lines: unknown[], cut = 7) {
  const text = lines.map((l) => JSON.stringify(l)).join('\n')
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += cut) c.enqueue(bytes.slice(i, i + cut))
      c.close()
    },
  })
}

describe('proveedor Ollama', () => {
  it('estado: listo, sin modelo o apagado', async () => {
    const tags = (names: string[]) =>
      (async () => Response.json({ models: names.map((name) => ({ name })) })) as typeof fetch
    expect(
      (await createOllamaProvider({ model: 'qwen3:8b', fetch: tags(['qwen3:8b']) }).status()).state,
    ).toBe('ready')
    expect(
      (await createOllamaProvider({ model: 'llama3.1', fetch: tags(['llama3.1:latest']) }).status())
        .state,
    ).toBe('ready')
    expect(
      await createOllamaProvider({ model: 'qwen3:14b', fetch: tags(['qwen3:8b']) }).status(),
    ).toEqual({
      state: 'no-model',
      model: 'qwen3:14b',
      models: ['qwen3:8b'],
    })
    const down = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect((await createOllamaProvider({ fetch: down }).status()).state).toBe('offline')
  })

  it('lee el streaming: texto y llamadas a herramientas, y manda el contexto y las herramientas', async () => {
    let sent: Record<string, unknown> = {}
    const fetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body))
      return new Response(
        ndjson([
          { message: { role: 'assistant', content: 'Mira' }, done: false },
          { message: { role: 'assistant', content: 'ndo…' }, done: false },
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{ function: { name: 'overview', arguments: {} } }],
            },
            done: false,
          },
          { message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' },
        ]),
      )
    }) as unknown as typeof globalThis.fetch
    const p = createOllamaProvider({ model: 'qwen3:8b', fetch })
    const chunks = []
    for await (const c of p.chat({
      messages: [{ role: 'user', content: 'hola' }],
      tools: [{ name: 'overview', description: 'd', parameters: { type: 'object' } }],
    }))
      chunks.push(c)
    expect(chunks).toEqual([
      { type: 'text', text: 'Mira' },
      { type: 'text', text: 'ndo…' },
      { type: 'tool_calls', calls: [{ name: 'overview', arguments: {} }] },
    ])
    expect(sent).toMatchObject({
      model: 'qwen3:8b',
      stream: true,
      think: false,
      options: { num_ctx: 16384 },
      tools: [{ type: 'function', function: { name: 'overview' } }],
    })
  })

  it('un error de Ollama se convierte en ProviderError legible', async () => {
    const fetch = (async () =>
      new Response('{"error":"model \\"qwen3:14b\\" not found, try pulling it first"}', {
        status: 404,
      })) as unknown as typeof globalThis.fetch
    const run = async () => {
      for await (const _ of createOllamaProvider({ fetch }).chat({ messages: [] })) {
      }
    }
    await expect(run()).rejects.toThrow(ProviderError)
    await expect(run()).rejects.toThrow(/404/)
  })

  it('convierte mensajes y argumentos en texto', () => {
    expect(
      toOllamaMessages([
        { role: 'assistant', content: '', toolCalls: [{ name: 'a', arguments: { x: 1 } }] },
        { role: 'tool', toolName: 'a', content: '{}' },
      ]),
    ).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'a', arguments: { x: 1 } } }],
      },
      { role: 'tool', content: '{}', tool_name: 'a' },
    ])
    expect(parseToolCalls([{ function: { name: 'a', arguments: '{"x":2}' } }])).toEqual([
      { name: 'a', arguments: { x: 2 } },
    ])
  })

  it('manda las imágenes del usuario y sabe si el modelo las ve', async () => {
    expect(toOllamaMessages([{ role: 'user', content: '¿Qué es?', images: ['aGk='] }])).toEqual([
      { role: 'user', content: '¿Qué es?', images: ['aGk='] },
    ])
    // Sin imágenes no se manda el campo.
    expect(toOllamaMessages([{ role: 'user', content: 'hola', images: [] }])).toEqual([
      { role: 'user', content: 'hola' },
    ])
    const show = (capabilities: string[]) =>
      (async () => Response.json({ capabilities })) as unknown as typeof fetch
    const ve = createOllamaProvider({ model: 'gemma3', fetch: show(['completion', 'vision']) })
    const ciego = createOllamaProvider({ model: 'qwen3:8b', fetch: show(['completion', 'tools']) })
    expect(await ve.vision?.()).toBe(true)
    expect(await ciego.vision?.()).toBe(false)
    const caido = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    expect(await createOllamaProvider({ fetch: caido }).vision?.()).toBe(false)
  })
})
