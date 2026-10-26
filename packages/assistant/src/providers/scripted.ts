import type { ChatChunk, ChatMessage, ChatProvider, ChatRequest, ToolCall } from '../provider'

/** Un paso del guion: lo que «dice» el modelo en una vuelta (llamadas a herramientas, texto o ambas). */
export interface ScriptedStep {
  /** Fijas o calculadas (p. ej. con un id que devolvió la herramienta anterior). */
  calls?: ToolCall[] | ((messages: ChatMessage[]) => ToolCall[])
  /** Texto fijo o calculado a partir de la conversación (p. ej. del resultado de la última herramienta). */
  text?: string | ((messages: ChatMessage[]) => string)
}

export interface ScriptRule {
  /** Con qué mensaje del usuario se usa este guion. */
  when: RegExp | ((text: string) => boolean)
  steps: ScriptedStep[]
}

export interface ScriptedOptions {
  /** Lo que contesta si ninguna regla encaja. */
  fallback?: string
  /** Pausa entre palabras, para que la demo se vea en streaming (0 en los tests). */
  delayMs?: number
  label?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Última herramienta respondida en la conversación, ya parseada (o `null`). */
export function lastToolResult(messages: ChatMessage[]): unknown {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role === 'tool') {
      try {
        return JSON.parse(m.content)
      } catch {
        return m.content
      }
    }
    if (m?.role === 'user') return null
  }
  return null
}

/**
 * Proveedor guionizado (ADR-0041): responde según reglas fijas, sin modelo. Sirve para los tests y el banco de pruebas
 * (hace de «modelo ideal») y para la demo sin Ollama. La vuelta que toca sale de cuántas respuestas suyas hay desde el
 * último mensaje del usuario.
 */
export function createScriptedProvider(
  rules: ScriptRule[],
  options: ScriptedOptions = {},
): ChatProvider {
  async function* chat({ messages, tools, signal }: ChatRequest): AsyncIterable<ChatChunk> {
    const lastUser = messages.findLastIndex((m) => m.role === 'user')
    const said = messages[lastUser]?.content ?? ''
    const turn = messages.slice(lastUser + 1).filter((m) => m.role === 'assistant').length
    const rule = rules.find((r) =>
      typeof r.when === 'function' ? r.when(said) : r.when.test(said),
    )
    const step: ScriptedStep | undefined = rule
      ? (rule.steps[turn] ?? { text: rule.steps.at(-1)?.text ?? '' })
      : { text: options.fallback ?? 'No sé responder a eso.' }
    const text = typeof step.text === 'function' ? step.text(messages) : (step.text ?? '')
    for (const word of text.split(/(?<=\s)/).filter(Boolean)) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
      if (options.delayMs) await sleep(options.delayMs)
      yield { type: 'text', text: word }
    }
    // Sin herramientas (último paso forzado) el guion no puede llamar a ninguna.
    const calls = typeof step.calls === 'function' ? step.calls(messages) : (step.calls ?? [])
    if (calls.length && tools?.length) yield { type: 'tool_calls', calls }
  }

  return {
    id: 'scripted',
    label: options.label ?? 'Demo · respuestas guionizadas',
    status: async () => ({ state: 'ready', model: 'guion', models: ['guion'] }),
    chat,
  }
}
