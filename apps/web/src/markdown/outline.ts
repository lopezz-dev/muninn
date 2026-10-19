import { Lexer } from 'marked'
import { normalize } from '../lib/text'
import { plainText } from './plain'

/** `Iniciar sesión` → `iniciar-sesion`. Sin tildes, para que `#iniciar-sesión` y `#iniciar-sesion` lleven al mismo sitio. */
export const slugify = (text: string) =>
  normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Reparte ids únicos a los títulos de un documento, en orden: `notas`, `notas-2`… */
export function makeSlugger() {
  const seen = new Map<string, number>()
  return (text: string) => {
    const base = slugify(text) || 'seccion'
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }
}

export interface OutlineItem {
  depth: number
  text: string
  id: string
}

/** Los títulos (nivel 2 y 3) de un texto, para el índice «En esta página». */
export function outline(source: string): OutlineItem[] {
  const slug = makeSlugger()
  const out: OutlineItem[] = []
  for (const t of Lexer.lex(source, { gfm: true })) {
    if (t.type !== 'heading') continue
    const text = plainText(t.text, 200)
    const id = slug(text)
    if (t.depth === 2 || t.depth === 3) out.push({ depth: t.depth, text, id })
  }
  return out
}
