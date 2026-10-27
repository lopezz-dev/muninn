/**
 * Proveedor del modelo (ADR-0041): una interfaz pequeña que implementan Ollama (en el ordenador del usuario) y un
 * proveedor guionizado (tests, banco de pruebas y la demo). El bucle de herramientas no sabe cuál habla.
 */

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

export type ChatMessage =
  | { role: 'system'; content: string }
  /** `images`: imágenes en base64 (sin el prefijo `data:`), para modelos con visión. */
  | { role: 'user'; content: string; images?: string[] }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; content: string; toolName: string }

/** Herramienta tal como la ve el modelo: nombre, descripción y parámetros en JSON Schema. */
export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatRequest {
  messages: ChatMessage[]
  /** Sin herramientas, el modelo solo puede contestar con texto. */
  tools?: ToolSpec[]
  signal?: AbortSignal
}

/** Lo que llega en streaming: trozos de texto y, al final de un paso, las llamadas a herramientas. */
export type ChatChunk = { type: 'text'; text: string } | { type: 'tool_calls'; calls: ToolCall[] }

export type ProviderStatus =
  | { state: 'ready'; model: string; models: string[] }
  /** No responde (Ollama apagado o sin instalar, o no se llega a su dirección). */
  | { state: 'offline'; detail?: string }
  /** Responde, pero el modelo elegido no está descargado. */
  | { state: 'no-model'; model: string; models: string[] }

export interface ChatProvider {
  /** `ollama`, `scripted`… */
  readonly id: string
  /** Lo que se enseña en la UI: «Local · Ollama · qwen3:8b». */
  readonly label: string
  status(signal?: AbortSignal): Promise<ProviderStatus>
  chat(request: ChatRequest): AsyncIterable<ChatChunk>
  /** ¿El modelo ve imágenes? Sin este método, se da por hecho que no. */
  vision?(signal?: AbortSignal): Promise<boolean>
}

/** Fallo del proveedor (red, modelo, respuesta rara): corta el turno y se enseña tal cual. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderError'
  }
}
