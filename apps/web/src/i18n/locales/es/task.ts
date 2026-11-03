import type { Messages } from '../../types'
import type { task as en } from '../en/task'

/** Textos de `task` en español. Mismas claves que `en/task.ts`: si falta una, no compila. */
export const task: Messages<typeof en> = {}
