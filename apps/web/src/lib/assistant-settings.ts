import type { Muninn, UserSettings } from '@muninn/core'
import { type QueryClient, useQuery } from '@tanstack/react-query'
import { notifyUndo } from './feedback'
import { useMuninn } from './muninn'
import { fail, serial } from './mutations'
import { keys, settingsQuery } from './queries'

/** Valores por defecto del asistente (ADR-0041). Iguales que los de `@muninn/assistant`, sin cargar el paquete. */
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_ASSISTANT_MODEL = 'qwen3:8b'

/** `user_settings.preferences.assistant`: dónde está Ollama y qué modelo usar. Te sigue a todos tus equipos. */
export interface AssistantPrefs {
  ollamaUrl: string
  model: string
}

export const DEFAULT_ASSISTANT: AssistantPrefs = {
  ollamaUrl: DEFAULT_OLLAMA_URL,
  model: DEFAULT_ASSISTANT_MODEL,
}

/** Solo `http(s)://` y sin barra final; lo demás vuelve al valor por defecto. */
export function normalizeUrl(url: unknown): string {
  if (typeof url !== 'string') return DEFAULT_OLLAMA_URL
  const u = url.trim().replace(/\/+$/, '')
  return /^https?:\/\/[^\s/]+(:\d+)?$/i.test(u) ? u : DEFAULT_OLLAMA_URL
}

/** Lo guardado, validado: cada cliente valida su parte de `preferences` al leerla. */
export function assistantPrefs(
  settings: Pick<UserSettings, 'preferences'> | undefined,
): AssistantPrefs {
  const raw = (settings?.preferences.assistant ?? {}) as Partial<
    Record<keyof AssistantPrefs, unknown>
  >
  const model =
    typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim().slice(0, 120) : null
  return { ollamaUrl: normalizeUrl(raw.ollamaUrl), model: model ?? DEFAULT_ASSISTANT_MODEL }
}

export function useAssistantPrefs(): AssistantPrefs {
  const m = useMuninn()
  return assistantPrefs(useQuery(settingsQuery(m)).data)
}

/** Guarda un cambio de los ajustes del asistente, con feedback y «Deshacer» (ADR-0019). */
export async function saveAssistantPrefs(
  m: Muninn,
  qc: QueryClient,
  patch: Partial<AssistantPrefs>,
  opts: { undoing?: boolean; label?: string } = {},
): Promise<boolean> {
  const current = qc.getQueryData<UserSettings>(keys.settings) ?? (await m.settings.get())
  const before = assistantPrefs(current)
  const next = { ...before, ...patch }
  const apply = (prefs: AssistantPrefs) =>
    qc.setQueryData<UserSettings>(keys.settings, (s) =>
      s ? { ...s, preferences: { ...s.preferences, assistant: { ...prefs } } } : s,
    )
  apply(next)
  try {
    await serial('settings', () => m.settings.update({ preferences: { assistant: { ...next } } }))
  } catch (err) {
    apply(before)
    fail('No se pudo guardar el ajuste', err)
    return false
  }
  if (!opts.undoing) {
    notifyUndo(opts.label ?? 'Ajuste guardado', {
      icon: 'assistant',
      undo: () => saveAssistantPrefs(m, qc, before, { undoing: true }),
    })
  }
  return true
}
