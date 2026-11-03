import type { Messages } from '../../types'
import type { dialogs as en } from '../en/dialogs'

/** Textos de `dialogs` en español. Mismas claves que `en/dialogs.ts`: si falta una, no compila. */
export const dialogs: Messages<typeof en> = {}
