import type { Messages } from '../../types'
import type { news as en } from '../en/news'

/** Textos de `news` en español. Mismas claves que `en/news.ts`: si falta una, no compila. */
export const news: Messages<typeof en> = {}
