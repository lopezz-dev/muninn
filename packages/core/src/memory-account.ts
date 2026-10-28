import type { AccountSession } from './schemas'
import type { AccountStore } from './store'

/** Lo que trae de partida la seguridad simulada. */
export interface MemoryAccountSeed {
  /** Sesiones abiertas; sin ninguna `current`, se añade la de este dispositivo. */
  sessions?: AccountSession[]
}

const browserAgent = () => (typeof navigator === 'undefined' ? null : (navigator.userAgent ?? null))

/**
 * Seguridad de la cuenta en memoria (ADR-0061), para la demo y los tests: imita lo que hace Supabase Auth sin red.
 * No se guarda en la instantánea del store: es Auth, no datos del usuario.
 */
export function createMemoryAccount(seed: MemoryAccountSeed = {}, now: () => string): AccountStore {
  let sessions = [...(seed.sessions ?? [])]
  if (!sessions.some((s) => s.current)) {
    const ts = now()
    sessions.push({
      id: crypto.randomUUID(),
      createdAt: ts,
      lastActiveAt: ts,
      userAgent: browserAgent(),
      ip: null,
      aal: 'aal1',
      current: true,
    })
  }

  return {
    async sessions() {
      return structuredClone(sessions)
    },
    async revokeSession(id) {
      const before = sessions.length
      sessions = sessions.filter((s) => s.id !== id)
      return sessions.length < before
    },
    async signOut(scope) {
      sessions = scope === 'global' ? [] : sessions.filter((s) => s.current)
    },
  }
}
