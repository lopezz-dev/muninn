import type { Messages } from '../../types'
import type { home as en } from '../en/home'

/** Textos de `home` en español. Mismas claves que `en/home.ts`: si falta una, no compila. */
export const home: Messages<typeof en> = {}
