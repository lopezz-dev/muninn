import type { Messages } from '../../types'
import type { projects as en } from '../en/projects'

/** Textos de `projects` en español. Mismas claves que `en/projects.ts`: si falta una, no compila. */
export const projects: Messages<typeof en> = {}
