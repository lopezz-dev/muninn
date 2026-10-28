import {
  type ChatChunk,
  type ChatMessage,
  type ChatProvider,
  type ChatRequest,
  ProviderError,
  type ProviderStatus,
  type ToolCall,
} from '../provider'

export const OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_MODEL = 'qwen3:8b'

export interface OllamaOptions {
  /** Por defecto `http://localhost:11434` (la CSP de Tauri ya admite `localhost:*`). */
  baseUrl?: string
  model?: string
  /**
   * Contexto en tokens. Ollama usa 4096 por defecto y el catálogo de herramientas no cabe: 16384 deja sitio a la
   * conversación y entra en 12 GB de VRAM con un modelo de 8B (ADR-0041).
   */
  numCtx?: number
  /** Razonamiento de los modelos que lo tienen (qwen3): apagado, responde antes. */
  think?: boolean
  /** Cuánto se queda el modelo en memoria tras usarlo. */
  keepAlive?: string
  temperature?: number
  fetch?: typeof fetch
}

/** Mensajes de Muninn → formato de `/api/chat` de Ollama. */
export function toOllamaMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === 'assistant') {
      return {
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                function: { name: c.name, arguments: c.arguments },
              })),
            }
          : {}),
      }
    }
    if (m.role === 'tool') return { role: 'tool', content: m.content, tool_name: m.toolName }
    if (m.role === 'user' && m.images?.length)
      return { role: 'user', content: m.content, images: m.images }
    return { role: m.role, content: m.content }
  })
}

type OllamaToolCall = { function?: { name?: string; arguments?: unknown } }

/** Los argumentos llegan como objeto; algunos modelos los mandan como texto JSON. */
export function parseToolCalls(raw: OllamaToolCall[] | undefined): ToolCall[] {
  return (raw ?? []).flatMap((c) => {
    const name = c.function?.name
    if (!name) return []
    let args = c.function?.arguments ?? {}
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args)
      } catch {
        args = {}
      }
    }
    return [
      {
        name,
        arguments: (args && typeof args === 'object' ? args : {}) as Record<string, unknown>,
      },
    ]
  })
}

/** Lee un cuerpo NDJSON línea a línea. */
async function* lines(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    let nl = buffer.indexOf('\n')
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line) yield line
      nl = buffer.indexOf('\n')
    }
    if (done) break
  }
  if (buffer.trim()) yield buffer.trim()
}

/** El nombre que da `/api/tags` lleva `:latest` si no se pidió etiqueta. */
const sameModel = (a: string, b: string) => a === b || a === `${b}:latest` || `${a}:latest` === b

/** Proveedor de Ollama: habla con `/api/tags` y `/api/chat` (streaming NDJSON) de la API local. */
export function createOllamaProvider(options: OllamaOptions = {}): ChatProvider {
  const base = (options.baseUrl ?? OLLAMA_URL).replace(/\/+$/, '')
  const model = options.model ?? DEFAULT_MODEL
  const doFetch = options.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  async function status(signal?: AbortSignal): Promise<ProviderStatus> {
    let models: string[]
    try {
      const res = await doFetch(`${base}/api/tags`, { signal: signal ?? AbortSignal.timeout(2500) })
      if (!res.ok) return { state: 'offline', detail: `Ollama respondió ${res.status}` }
      const body = (await res.json()) as { models?: { name?: string; model?: string }[] }
      models = (body.models ?? []).map((m) => m.name ?? m.model ?? '').filter(Boolean)
    } catch (err) {
      return { state: 'offline', detail: err instanceof Error ? err.message : String(err) }
    }
    return models.some((m) => sameModel(m, model))
      ? { state: 'ready', model, models }
      : { state: 'no-model', model, models }
  }

  /** `/api/show` dice qué sabe hacer el modelo: `vision` si acepta imágenes (gemma3, qwen2.5vl, llama3.2-vision…). */
  async function vision(signal?: AbortSignal) {
    try {
      const res = await doFetch(`${base}/api/show`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model }),
        signal: signal ?? AbortSignal.timeout(2500),
      })
      if (!res.ok) return false
      const body = (await res.json()) as { capabilities?: string[] }
      return body.capabilities?.includes('vision') ?? false
    } catch {
      return false
    }
  }

  async function* chat(request: ChatRequest): AsyncIterable<ChatChunk> {
    let res: Response
    try {
      res = await doFetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          model,
          messages: toOllamaMessages(request.messages),
          tools: request.tools?.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
          stream: true,
          think: options.think ?? false,
          keep_alive: options.keepAlive ?? '10m',
          options: { num_ctx: options.numCtx ?? 16384, temperature: options.temperature ?? 0.2 },
        }),
      })
    } catch (err) {
      if (request.signal?.aborted) throw err
      throw new ProviderError(
        `No se pudo hablar con Ollama en ${base}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      const detail = /"error"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? text.slice(0, 200)
      throw new ProviderError(`Ollama respondió ${res.status}${detail ? `: ${detail}` : ''}`)
    }
    const calls: ToolCall[] = []
    for await (const line of lines(res.body)) {
      let chunk: {
        message?: { content?: string; tool_calls?: OllamaToolCall[] }
        error?: string
        done?: boolean
      }
      try {
        chunk = JSON.parse(line)
      } catch {
        continue
      }
      if (chunk.error) throw new ProviderError(`Ollama: ${chunk.error}`)
      const text = chunk.message?.content
      if (text) yield { type: 'text', text }
      calls.push(...parseToolCalls(chunk.message?.tool_calls))
      if (chunk.done) break
    }
    if (calls.length) yield { type: 'tool_calls', calls }
  }

  return { id: 'ollama', label: `Local · Ollama · ${model}`, status, chat, vision }
}
