import type { Messages } from '../../types'
import type { docs as en } from '../en/docs'

/** Textos de `docs` en español. Mismas claves que `en/docs.ts`: si falta una, no compila. */
export const docs: Messages<typeof en> = {}
