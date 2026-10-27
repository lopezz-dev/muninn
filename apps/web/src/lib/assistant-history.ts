import type { ChangeTarget, ToolRun } from '@muninn/assistant'
import { clear, createStore, get, set, type UseStore } from 'idb-keyval'

/**
 * Historial del asistente (ADR-0041): en el IndexedDB de este dispositivo, por usuario, las últimas 30
 * conversaciones. No va a la nube: lo que el asistente cambia ya queda en la actividad. Se borra al cerrar sesión.
 */

export interface ChangeView {
  summary: string
  target?: ChangeTarget
  /** Ya se deshizo. */
  undone?: boolean
}

export interface Turn {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  /** Imágenes del usuario, ya reducidas (`data:image/jpeg;base64,…`). Solo viajan al modelo en su turno (ADR-0048). */
  images?: string[]
  tools?: ToolRun[]
  changes?: ChangeView[]
  /** El turno se cortó con un error (Ollama apagado a mitad, etc.). */
  error?: string
  /** Se paró a mano. */
  stopped?: boolean
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  turns: Turn[]
}

export const MAX_CONVERSATIONS = 30

/** Título a partir de la primera pregunta: una línea, como mucho 60 caracteres. */
export function titleFrom(text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > 60 ? `${line.slice(0, 59)}…` : line || 'Conversación'
}

/** Añade o reemplaza una conversación y deja las más recientes primero, sin pasar del máximo. */
export function upsertConversation(list: Conversation[], c: Conversation): Conversation[] {
  return [c, ...list.filter((x) => x.id !== c.id)]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, MAX_CONVERSATIONS)
}

/** «Hoy», «Esta semana» o «Antes», como la lista del diseño. */
export function groupOf(iso: string, now = new Date()): 'Hoy' | 'Esta semana' | 'Antes' {
  const d = new Date(iso)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (d >= start) return 'Hoy'
  start.setDate(start.getDate() - 6)
  return d >= start ? 'Esta semana' : 'Antes'
}

let db: UseStore | undefined
const store = () => {
  db ??= createStore('muninn-assistant', 'conversations')
  return db
}
const keyOf = (userKey: string) => `history:${userKey}`

export async function loadHistory(userKey: string): Promise<Conversation[]> {
  try {
    return ((await get<Conversation[]>(keyOf(userKey), store())) ?? []).slice(0, MAX_CONVERSATIONS)
  } catch {
    return []
  }
}

export async function saveHistory(userKey: string, list: Conversation[]) {
  try {
    await set(keyOf(userKey), list.slice(0, MAX_CONVERSATIONS), store())
  } catch {
    // Sin IndexedDB (modo privado), el historial dura lo que la pestaña.
  }
}

/** Al cerrar sesión o cambiar de usuario: el historial es del dispositivo, pero no debe verlo otra cuenta. */
export async function clearHistory() {
  try {
    await clear(store())
  } catch {}
}
