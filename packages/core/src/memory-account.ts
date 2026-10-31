import type { AccountSession, AssuranceLevel, MfaFactor, OAuthAppGrant } from './schemas'
import type { AccountStore } from './store'

/** Lo que trae de partida la seguridad simulada. */
export interface MemoryAccountSeed {
  /** Sesiones abiertas; sin ninguna `current`, se añade la de este dispositivo. */
  sessions?: AccountSession[]
  factors?: MfaFactor[]
  /** Apps con acceso por OAuth. */
  grants?: OAuthAppGrant[]
}

/** En la demo y los tests vale cualquier código de seis cifras menos este. */
export const MEMORY_WRONG_MFA_CODE = '000000'

const browserAgent = () => (typeof navigator === 'undefined' ? null : (navigator.userAgent ?? null))

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const fakeSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => BASE32[b % 32]).join('')

/**
 * Seguridad de la cuenta en memoria (ADR-0061), para la demo y los tests: imita lo que hace Supabase Auth sin red.
 * No se guarda en la instantánea del store: es Auth, no datos del usuario. `onClosed` recibe las sesiones que se cierran,
 * como la cascada de `auth.sessions` a `push_subscriptions` en Supabase (ADR-0074).
 */
export function createMemoryAccount(
  seed: MemoryAccountSeed = {},
  now: () => string,
  onClosed: (sessionIds: string[]) => void = () => {},
): AccountStore {
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
      appName: null,
    })
  }
  let factors = [...(seed.factors ?? [])]
  let grants = [...(seed.grants ?? [])]
  // Autorizaciones aprobadas con el segundo factor (ADR-0066); en memoria no cambia lo que ven las apps, solo se apunta.
  const mfaApproved = new Set<string>()
  const hasVerified = () => factors.some((f) => f.status === 'verified')
  // Con un factor confirmado de partida, la sesión ya pasó el código al entrar.
  let aal: AssuranceLevel['current'] = hasVerified() ? 'aal2' : 'aal1'

  return {
    async sessions() {
      return structuredClone(sessions)
    },
    async revokeSession(id) {
      const found = sessions.some((s) => s.id === id)
      sessions = sessions.filter((s) => s.id !== id)
      if (found) onClosed([id])
      return found
    },
    async signOut(scope) {
      const closed = sessions.filter((s) => scope === 'global' || !s.current).map((s) => s.id)
      sessions = sessions.filter((s) => !closed.includes(s.id))
      onClosed(closed)
    },
    oauthGrants: {
      async list() {
        return structuredClone(grants)
      },
      async approveWithMfa(authorizationId) {
        if (aal !== 'aal2') return false
        mfaApproved.add(authorizationId)
        return true
      },
      async revoke(clientId) {
        grants = grants.filter((g) => g.clientId !== clientId)
      },
    },
    mfa: {
      async factors() {
        return structuredClone(factors)
      },
      async enroll(name) {
        if (factors.some((f) => f.name === name))
          throw new Error(`Ya hay un factor llamado «${name}»`)
        const factor: MfaFactor = {
          id: crypto.randomUUID(),
          name,
          status: 'unverified',
          createdAt: now(),
        }
        factors.push(factor)
        const secret = fakeSecret()
        return {
          factorId: factor.id,
          // Sin generador de QR en memoria: la demo enseña solo el secreto.
          qrCode: '',
          secret,
          uri: `otpauth://totp/Muninn:demo?secret=${secret}&issuer=Muninn`,
        }
      },
      async verify(factorId, code) {
        const factor = factors.find((f) => f.id === factorId)
        if (!factor) throw new Error('Ese factor ya no existe')
        if (code === MEMORY_WRONG_MFA_CODE) throw new Error('El código no es correcto')
        factor.status = 'verified'
        aal = 'aal2'
      },
      async unenroll(factorId) {
        const factor = factors.find((f) => f.id === factorId)
        // Como Supabase: quitar un factor confirmado pide una sesión que ya pasó el código.
        if (factor?.status === 'verified' && aal !== 'aal2')
          throw new Error('Para quitar el segundo factor, primero escribe un código')
        factors = factors.filter((f) => f.id !== factorId)
        if (!hasVerified()) aal = 'aal1'
      },
      async assurance() {
        return { current: aal, next: hasVerified() ? 'aal2' : 'aal1' }
      },
    },
  }
}
