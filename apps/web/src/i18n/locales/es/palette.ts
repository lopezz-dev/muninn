import type { Messages } from '../../types'
import type { palette as en } from '../en/palette'

/** Textos de `palette` en español. Mismas claves que `en/palette.ts`: si falta una, no compila. */
export const palette: Messages<typeof en> = {}
