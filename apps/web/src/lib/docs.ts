import { plainText } from '../markdown/plain'
import { normalize } from './text'

/**
 * Las guías de `docs/user/*.md` como datos. Aquí solo hay lógica pura (con tests): los ficheros los
 * importa en tiempo de compilación `screens/docs/content.ts`.
 */

export type DocStatus = 'disponible' | 'parcial' | 'proximamente'

export interface Doc {
  /** `proyectos-y-tablero`: el nombre del fichero sin el número ni la extensión. */
  slug: string
  title: string
  description: string
  order: number
  status: DocStatus
  /** El Markdown sin el bloque de metadatos. */
  body: string
}

const STATUSES: DocStatus[] = ['disponible', 'parcial', 'proximamente']

/** Lee el bloque `---` del principio (`clave: valor`, sin anidar). Devuelve los metadatos y el resto. */
export function splitFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!m) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line)
    if (!kv?.[1]) continue
    meta[kv[1]] = (kv[2] ?? '').trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  return { meta, body: raw.slice(m[0].length) }
}

/** `03-proyectos-y-tablero.md` → `proyectos-y-tablero`; otro nombre, `null` (README, por ejemplo). */
export function slugOf(file: string): string | null {
  return /(?:^|[/\\])\d{2}-([\w-]+)\.md$/.exec(file)?.[1] ?? null
}

/** Todas las guías, ordenadas por `order`. Las que no tienen nombre numerado o título se ignoran. */
export function buildDocs(files: Record<string, string>): Doc[] {
  const docs: Doc[] = []
  for (const [file, raw] of Object.entries(files)) {
    const slug = slugOf(file)
    if (!slug) continue
    const { meta, body } = splitFrontMatter(raw)
    if (!meta.title) continue
    const status = STATUSES.find((s) => s === meta.status) ?? 'disponible'
    docs.push({
      slug,
      title: meta.title,
      description: meta.description ?? '',
      order: Number(meta.order) || 0,
      status,
      body,
    })
  }
  return docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'es'))
}

export interface DocHit {
  doc: Doc
  /** Un trozo del texto que contiene la búsqueda, para enseñar por qué sale. */
  snippet: string
}

/**
 * Busca en el título, la descripción y el texto (sin mayúsculas ni tildes; deben estar todas las palabras).
 * Primero las que coinciden en el título.
 */
export function searchDocs(docs: Doc[], query: string): DocHit[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return docs.map((doc) => ({ doc, snippet: '' }))
  const hits: (DocHit & { inTitle: boolean })[] = []
  for (const doc of docs) {
    const text = plainText(doc.body, Number.POSITIVE_INFINITY)
    const hay = normalize(`${doc.title} ${doc.description} ${text}`)
    if (!words.every((w) => hay.includes(w))) continue
    const at = normalize(text).indexOf(words[0] ?? '')
    const snippet =
      at < 0
        ? ''
        : `${at > 40 ? '…' : ''}${text.slice(Math.max(0, at - 40), at + 90).trim()}${text.length > at + 90 ? '…' : ''}`
    const title = normalize(doc.title)
    hits.push({ doc, snippet, inTitle: words.every((w) => title.includes(w)) })
  }
  return hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle))
}

/** Los vecinos de una guía en el orden del menú. */
export function neighbours(docs: Doc[], slug: string): { prev?: Doc; next?: Doc } {
  const i = docs.findIndex((d) => d.slug === slug)
  return i < 0 ? {} : { prev: docs[i - 1], next: docs[i + 1] }
}

/** Un enlace entre guías (`05-notas.md#archivar`): a qué guía y a qué apartado va; `null` si no lo es. */
export function docLink(href: string): { slug: string; hash: string } | null {
  const m = /^(?:\.\/)?\d{2}-([\w-]+)\.md(?:#(.*))?$/.exec(href.trim())
  return m?.[1] ? { slug: m[1], hash: m[2] ?? '' } : null
}
