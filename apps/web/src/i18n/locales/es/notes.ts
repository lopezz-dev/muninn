import type { Messages } from '../../types'
import type { notes as en } from '../en/notes'

/** Textos de `notes` en español. Mismas claves que `en/notes.ts`: si falta una, no compila. */
export const notes: Messages<typeof en> = {}
