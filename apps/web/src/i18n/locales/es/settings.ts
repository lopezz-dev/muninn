import type { Messages } from '../../types'
import type { settings as en } from '../en/settings'

/** Textos de `settings` en español. Mismas claves que `en/settings.ts`: si falta una, no compila. */
export const settings: Messages<typeof en> = {}
