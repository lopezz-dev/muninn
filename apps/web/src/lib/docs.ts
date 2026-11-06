import { Lexer } from 'marked'
import { makeSlugger } from '../markdown/outline'
import { plainText } from '../markdown/plain'
import { type DocKey, type DocLang, docKeyByNumber } from './doc-slugs'
import { matchesAll, normalize, words } from './text'

/**
 * Las guías de `docs/user/<idioma>/*.md` como datos. Aquí solo hay lógica pura (con tests): los ficheros los
 * importa al compilar `screens/docs/content.ts`, y el prerender (`vite/seo.ts`) los lee del disco.
 */

export type DocStatus = 'disponible' | 'parcial' | 'proximamente'

/**
 * Grupos del menú, en su orden (ADR-0052). Una guía con otro `group` (o sin él) va a «Más guías», al final. La
 * pantalla los nombra con i18next (`docs` › `groups`); estas etiquetas son para el prerender, que no lo usa.
 */
export const DOC_GROUPS = [
  { id: 'primeros-pasos', label: { en: 'Getting started', es: 'Primeros pasos' } },
  { id: 'tu-trabajo', label: { en: 'Your work', es: 'Tu trabajo' } },
  { id: 'modulos', label: { en: 'Modules', es: 'Módulos' } },
  { id: 'ia', label: { en: 'Assistants and AI', es: 'Asistentes e IA' } },
  { id: 'cuenta', label: { en: 'Account', es: 'Cuenta' } },
] as const

const OTHER_GROUP = { id: 'otras', label: { en: 'More guides', es: 'Más guías' } } as const
const ALL_GROUPS = [...DOC_GROUPS, OTHER_GROUP]

export type DocGroupId = (typeof ALL_GROUPS)[number]['id']

export interface Doc {
  /** `proyectos-y-tablero`: el nombre del fichero sin el número ni la extensión. */
  slug: string
  /** El número del fichero (`03`): el mismo en los dos idiomas, empareja una guía con su traducción. */
  n: string
  /** La guía en `lib/doc-slugs.ts` (su slug en inglés); `undefined` si no está ahí. */
  key?: DocKey
  lang: DocLang
  title: string
  description: string
  order: number
  status: DocStatus
  group: DocGroupId
  /** Nombre de un icono de `icons` o `screenIcons` de `@muninn/ui`; la pantalla lo resuelve. */
  icon: string
  /** El Markdown sin el bloque de metadatos ni el `# Título` del principio (el título sale de los metadatos). */
  body: string
  /** Minutos de lectura, redondeados hacia arriba (a ~200 palabras por minuto). */
  minutes: number
}

export interface DocGroup {
  id: DocGroupId
  label: { en: string; es: string }
  docs: Doc[]
}

const STATUSES: DocStatus[] = ['disponible', 'parcial', 'proximamente']
const GROUP_IDS: string[] = DOC_GROUPS.map((g) => g.id)

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

/** `03-proyectos-y-tablero.md` → `03`. */
const numberOf = (file: string) => /(?:^|[/\\])(\d{2})-[\w-]+\.md$/.exec(file)?.[1] ?? ''

/** Quita el `# Título` con que empiezan las guías. */
const withoutTitle = (body: string) => body.replace(/^\s*#\s+.*\r?\n/, '')

const groupRank = (id: DocGroupId) => {
  const i = GROUP_IDS.indexOf(id)
  return i < 0 ? GROUP_IDS.length : i
}

/**
 * Las guías de un idioma en el orden del menú: por grupo y, dentro, por `order`. Las que no tienen nombre numerado
 * o título se ignoran.
 */
export function buildDocs(files: Record<string, string>, lang: DocLang = 'es'): Doc[] {
  const docs: Doc[] = []
  for (const [file, raw] of Object.entries(files)) {
    const slug = slugOf(file)
    if (!slug) continue
    const { meta, body } = splitFrontMatter(raw)
    if (!meta.title) continue
    const text = withoutTitle(body)
    const words = plainText(text, Number.POSITIVE_INFINITY).split(' ').length
    const n = numberOf(file)
    docs.push({
      slug,
      n,
      key: docKeyByNumber(n),
      lang,
      title: meta.title,
      description: meta.description ?? '',
      order: Number(meta.order) || 0,
      status: STATUSES.find((s) => s === meta.status) ?? 'disponible',
      group: GROUP_IDS.includes(meta.group ?? '') ? (meta.group as DocGroupId) : OTHER_GROUP.id,
      icon: meta.icon || 'docs',
      body: text,
      minutes: Math.max(1, Math.ceil(words / 200)),
    })
  }
  return docs.sort(
    (a, b) =>
      groupRank(a.group) - groupRank(b.group) ||
      a.order - b.order ||
      a.title.localeCompare(b.title, lang),
  )
}

/** Las guías por grupo, en el orden del menú; los grupos vacíos no salen. */
export function groupDocs(docs: Doc[]): DocGroup[] {
  return ALL_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    docs: docs.filter((d) => d.group === g.id),
  })).filter((g) => g.docs.length > 0)
}

export const groupLabel = (id: DocGroupId, lang: DocLang) =>
  (ALL_GROUPS.find((g) => g.id === id)?.label ?? OTHER_GROUP.label)[lang]

export interface Section {
  /** `id` del título, el mismo que pinta el renderizador; vacío antes del primer título. */
  id: string
  title: string
  text: string
}

/** Un texto partido por sus títulos, con el texto corrido de cada apartado. */
export function sections(body: string): Section[] {
  const slug = makeSlugger()
  const out: Section[] = [{ id: '', title: '', text: '' }]
  for (const t of Lexer.lex(body, { gfm: true })) {
    if (t.type === 'heading') {
      const title = plainText(t.text, 200)
      out.push({ id: slug(title), title, text: '' })
      continue
    }
    const last = out[out.length - 1]
    if (last) last.text += ` ${plainText(t.raw, Number.POSITIVE_INFINITY)}`
  }
  return out.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.id || s.text)
}

export interface DocHit {
  doc: Doc
  /** Un trozo del texto que contiene la búsqueda, para enseñar por qué sale. */
  snippet: string
  /** El apartado donde está, para ir directo a él; sin él, la guía entera. */
  section?: { id: string; title: string }
}

/** Unos 130 caracteres alrededor de la posición `at` de `text`. */
const around = (text: string, at: number) =>
  `${at > 40 ? '…' : ''}${text.slice(Math.max(0, at - 40), at + 90).trim()}${text.length > at + 90 ? '…' : ''}`

/**
 * Busca en el título, la descripción y el texto (sin mayúsculas ni tildes; deben estar todas las palabras).
 * Primero las que coinciden en el título y después las que juntan todas las palabras en un apartado. Cada
 * resultado dice en qué apartado está: el primero que tiene todas las palabras (contando su título) o, si
 * ninguno, el primero con la primera palabra.
 */
export function searchDocs(docs: Doc[], query: string): DocHit[] {
  const terms = words(query)
  if (terms.length === 0) return docs.map((doc) => ({ doc, snippet: '' }))
  const first = terms.slice(0, 1)
  const hits: (DocHit & { score: number })[] = []
  for (const doc of docs) {
    const parts = sections(doc.body)
    const all = `${doc.title} ${doc.description} ${parts.map((p) => `${p.title} ${p.text}`).join(' ')}`
    if (!matchesAll(all, terms)) continue
    const has = (p: Section, every: boolean) =>
      matchesAll(`${p.title} ${p.text}`, every ? terms : first)
    const whole = parts.find((p) => has(p, true))
    const part = whole ?? parts.find((p) => has(p, false))
    const at = part ? normalize(part.text).indexOf(terms[0] ?? '') : -1
    hits.push({
      doc,
      snippet: part && at >= 0 ? around(part.text, at) : '',
      section: part?.id ? { id: part.id, title: part.title } : undefined,
      // Primero las del título; luego las que tienen todas las palabras en un mismo apartado.
      score: (matchesAll(doc.title, terms) ? 2 : 0) + (whole ? 1 : 0),
    })
  }
  return hits.sort((a, b) => b.score - a.score).map(({ score: _, ...hit }) => hit)
}

/** Los vecinos de una guía en el orden del menú. */
export function neighbours(docs: Doc[], slug: string): { prev?: Doc; next?: Doc } {
  const i = docs.findIndex((d) => d.slug === slug)
  return i < 0 ? {} : { prev: docs[i - 1], next: docs[i + 1] }
}

/**
 * Un enlace entre guías (`05-notas.md#archivar`): el número de la guía y el apartado; `null` si no lo es. Se
 * resuelve por el número: cada idioma enlaza con sus propios nombres de fichero.
 */
export function docLink(href: string): { n: string; hash: string } | null {
  const m = /^(?:\.\/)?(\d{2})-[\w-]+\.md(?:#(.*))?$/.exec(href.trim())
  return m?.[1] ? { n: m[1], hash: m[2] ?? '' } : null
}

/** La guía a la que lleva un enlace entre guías, entre las de su mismo idioma; `null` si no es uno o no existe. */
export function linkedDoc(docs: Doc[], href: string): { doc: Doc; hash: string } | null {
  const link = docLink(href)
  const doc = link ? docs.find((d) => d.n === link.n) : undefined
  return link && doc ? { doc, hash: link.hash } : null
}
