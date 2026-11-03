import type { Messages } from '../../types'
import type { board as en } from '../en/board'

/** Textos de `board` en español. Mismas claves que `en/board.ts`: si falta una, no compila. */
export const board: Messages<typeof en> = {}
