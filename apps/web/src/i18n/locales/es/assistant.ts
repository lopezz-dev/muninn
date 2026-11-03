import type { Messages } from '../../types'
import type { assistant as en } from '../en/assistant'

/** Textos de `assistant` en español. Mismas claves que `en/assistant.ts`: si falta una, no compila. */
export const assistant: Messages<typeof en> = {}
