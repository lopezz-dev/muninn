import type { Messages } from '../../types'
import type { integrations as en } from '../en/integrations'

/** Textos de `integrations` en español. Mismas claves que `en/integrations.ts`: si falta una, no compila. */
export const integrations: Messages<typeof en> = {}
