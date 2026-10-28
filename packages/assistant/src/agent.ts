import { type Muninn, withActor } from '@muninn/core'
import { z } from 'zod'
import { systemPrompt } from './prompt'
import type { ChatMessage, ChatProvider, ToolCall, ToolSpec } from './provider'
import {
  type AnyTool,
  type Change,
  catalog,
  isExpectedError,
  parametersOf,
  toolsFor,
} from './tools'

/** Una llamada a herramienta dentro de un turno, tal como la enseña la UI. */
export interface ToolRun {
  id: string
  name: string
  title: string
  detail?: string
  access: 'read' | 'write'
  args: Record<string, unknown>
  status: 'running' | 'ok' | 'error'
  /** El texto del error que se devolvió al modelo. */
  error?: string
}

export type AssistantEvent =
  /** Trozo de la respuesta, en streaming. */
  | { type: 'text'; text: string }
  | { type: 'tool'; run: ToolRun }
  | { type: 'tool_done'; run: ToolRun }
  | { type: 'change'; change: Change }

export interface RunOptions {
  provider: ChatProvider
  /** El core del usuario: el bucle escribe con una copia de actor `assistant` (ADR-0041). */
  app: Muninn
  /** Va a `payload.context.conversation` de cada evento de la actividad. */
  conversationId?: string
  /** Por defecto, todo el catálogo. La app pasa `toolsFor(módulos activos)`. */
  tools?: AnyTool[]
  /** Vueltas con herramientas antes de obligar al modelo a contestar. */
  maxSteps?: number
  /** Llamadas por vuelta: lo que pase de ahí se rechaza y se le dice al modelo. */
  maxCallsPerStep?: number
  /** Lo que se le devuelve al modelo de cada resultado, como mucho. */
  maxResultChars?: number
  system?: string
  signal?: AbortSignal
  onEvent?: (event: AssistantEvent) => void
}

export interface RunResult {
  /** La respuesta final (todo el texto del turno). */
  text: string
  tools: ToolRun[]
  changes: Change[]
  /** Los mensajes nuevos de este turno, con las llamadas y sus resultados. */
  messages: ChatMessage[]
  /** Si se llegó al máximo de vueltas y se le obligó a contestar. */
  stoppedAtLimit: boolean
}

/** Nombre de cada módulo tal como lo ve el usuario en Ajustes › Módulos. */
const MODULE_LABEL: Record<string, string> = {
  tasks: 'Tareas y proyectos',
  notes: 'Notas',
  finance: 'Finanzas',
  news: 'Noticias',
  github: 'GitHub',
}

export const MAX_STEPS = 6
export const MAX_CALLS_PER_STEP = 6

const specOf = (t: AnyTool): ToolSpec => ({
  name: t.name,
  description: t.description,
  parameters: parametersOf(t),
})

/** Los modelos pequeños mandan `null` o `""` en lo opcional: si no valida, se reintenta sin ellos. */
function parseArgs(tool: AnyTool, args: Record<string, unknown>) {
  const schema = z.object(tool.input)
  const first = schema.safeParse(args)
  if (first.success) return first
  const cleaned = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== null && v !== ''))
  const second = schema.safeParse(cleaned)
  return second.success ? second : first
}

const issues = (err: z.ZodError) =>
  err.issues.map((i) => `${i.path.join('.') || 'argumentos'}: ${i.message}`).join('; ')

const keyOf = (call: ToolCall) =>
  `${call.name}:${JSON.stringify(Object.entries(call.arguments).sort(([a], [b]) => (a < b ? -1 : 1)))}`

/**
 * El bucle de herramientas del asistente (ADR-0041): el modelo pide herramientas del catálogo, se ejecutan de una en
 * una con el core, y su resultado (o el error, para que se corrija, como `run` del MCP) vuelve al modelo, hasta que
 * contesta con texto o se llega a `maxSteps`. Nada es destructivo: el catálogo no tiene borrados. Una misma escritura
 * repetida en el turno no se ejecuta dos veces.
 */
export async function runAssistant(
  history: ChatMessage[],
  options: RunOptions,
): Promise<RunResult> {
  const tools = options.tools ?? toolsFor(null)
  const byName = new Map(tools.map((t) => [t.name, t]))
  const specs = tools.map(specOf)
  const maxSteps = options.maxSteps ?? MAX_STEPS
  const maxCalls = options.maxCallsPerStep ?? MAX_CALLS_PER_STEP
  const maxChars = options.maxResultChars ?? 8000
  const emit = options.onEvent ?? (() => {})

  let current: string | undefined
  const app = withActor(options.app, 'assistant', {
    activityContext: () => ({
      ...(options.conversationId ? { conversation: options.conversationId } : {}),
      ...(current ? { tool: current } : {}),
    }),
  })

  const system: ChatMessage = {
    role: 'system',
    content: options.system ?? systemPrompt(app.today()),
  }
  const turn: ChatMessage[] = []
  const runs: ToolRun[] = []
  const changes: Change[] = []
  const done = new Map<string, string>()
  let text = ''
  let stoppedAtLimit = false

  for (let step = 0; ; step++) {
    const lastStep = step >= maxSteps
    let content = ''
    const calls: ToolCall[] = []
    for await (const chunk of options.provider.chat({
      messages: [system, ...history, ...turn],
      tools: lastStep ? undefined : specs,
      signal: options.signal,
    })) {
      if (chunk.type === 'text') {
        content += chunk.text
        emit({ type: 'text', text: chunk.text })
      } else calls.push(...chunk.calls)
    }
    text += content
    if (!calls.length || lastStep) {
      turn.push({ role: 'assistant', content })
      stoppedAtLimit = lastStep && step > 0
      break
    }
    turn.push({ role: 'assistant', content, toolCalls: calls })

    for (const [i, call] of calls.entries()) {
      const tool = byName.get(call.name)
      const run: ToolRun = {
        id: `${step}.${i}`,
        name: call.name,
        title: tool?.title ?? call.name,
        access: tool?.access ?? 'read',
        args: call.arguments,
        status: 'running',
      }
      runs.push(run)
      emit({ type: 'tool', run: { ...run } })
      const reply = (status: 'ok' | 'error', result: string) => {
        run.status = status
        if (status === 'error') run.error = result
        turn.push({ role: 'tool', toolName: call.name, content: result })
        emit({ type: 'tool_done', run: { ...run } })
      }

      if (!tool) {
        const hidden = catalog.find((t) => t.name === call.name)?.module
        reply(
          'error',
          hidden
            ? `Error: "${call.name}" es del módulo «${MODULE_LABEL[hidden] ?? hidden}», que el usuario tiene desactivado. Dile que lo active en Ajustes › Módulos.`
            : `Error: no existe la herramienta "${call.name}". Usa una de la lista.`,
        )
        continue
      }
      if (i >= maxCalls) {
        reply(
          'error',
          `Error: como mucho ${maxCalls} herramientas por vuelta. Repite esta después si hace falta.`,
        )
        continue
      }
      const parsed = parseArgs(tool, call.arguments)
      if (!parsed.success) {
        reply('error', `Error en los argumentos: ${issues(parsed.error)}`)
        continue
      }
      run.detail = tool.detail?.(parsed.data) ?? undefined
      const key = keyOf(call)
      const repeated = tool.access === 'write' ? done.get(key) : undefined
      if (repeated !== undefined) {
        reply('ok', `Ya hecho en este turno (no se repite): ${repeated}`)
        continue
      }
      current = tool.name
      try {
        const result = await tool.run(
          {
            app,
            changed: (c) => {
              const change = { ...c, tool: tool.name }
              changes.push(change)
              emit({ type: 'change', change })
            },
          },
          parsed.data,
        )
        const json = JSON.stringify(result ?? null)
        const out = json.length > maxChars ? `${json.slice(0, maxChars)}… (recortado)` : json
        if (tool.access === 'write') done.set(key, out)
        reply('ok', out)
      } catch (err) {
        if (!isExpectedError(err)) throw err
        reply('error', `Error: ${err.message}`)
      } finally {
        current = undefined
      }
    }
  }

  return { text: text.trim(), tools: runs, changes, messages: turn, stoppedAtLimit }
}
