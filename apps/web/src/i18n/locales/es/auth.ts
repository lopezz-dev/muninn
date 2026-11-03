import type { Messages } from '../../types'
import type { auth as en } from '../en/auth'

/** Textos de `auth` en español. Mismas claves que `en/auth.ts`: si falta una, no compila. */
export const auth: Messages<typeof en> = {}
