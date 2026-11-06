import { Lexer, type Token } from 'marked'
import type { CommentAnchor } from './schemas'

/**
 * Texto visible de una nota y anclaje de comentarios (ADR-0079).
 *
 * `noteText` reproduce lo que da el editor (TipTap con `@tiptap/markdown`, que usa el lexer de marked) con
 * `doc.textBetween(0, doc.content.size, '\n', leaf)`, donde `leaf` da `'\n'` en un salto duro y el texto alternativo en una
 * imagen: cada bloque de texto (párrafo, título, bloque de código, celda de tabla, elemento de lista o de tareas) separado
 * por un `\n`, sin marcas de Markdown. La interfaz manda la **cita** y el core la busca aquí: si las dos proyecciones
 * difieren en un detalle, la cita se sigue encontrando.
 */

/** Contexto que se guarda a cada lado de la cita. */
export const ANCHOR_CONTEXT = 32

// ─── Texto visible ──────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', amp: '&' }

// Referencias numéricas del rango C1 que HTML5 lleva a Windows-1252 (como `decodeHtmlEntities` de TipTap).
const WINDOWS_1252 = new Map<number, number>([
  [0x80, 0x20ac],
  [0x82, 0x201a],
  [0x83, 0x0192],
  [0x84, 0x201e],
  [0x85, 0x2026],
  [0x86, 0x2020],
  [0x87, 0x2021],
  [0x88, 0x02c6],
  [0x89, 0x2030],
  [0x8a, 0x0160],
  [0x8b, 0x2039],
  [0x8c, 0x0152],
  [0x8e, 0x017d],
  [0x91, 0x2018],
  [0x92, 0x2019],
  [0x93, 0x201c],
  [0x94, 0x201d],
  [0x95, 0x2022],
  [0x96, 0x2013],
  [0x97, 0x2014],
  [0x98, 0x02dc],
  [0x99, 0x2122],
  [0x9a, 0x0161],
  [0x9b, 0x203a],
  [0x9c, 0x0153],
  [0x9e, 0x017e],
  [0x9f, 0x0178],
])

function codePoint(n: number) {
  if (n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '�'
  return String.fromCodePoint(WINDOWS_1252.get(n) ?? n)
}

/** Como el editor: solo `&lt; &gt; &quot; &amp;` y las numéricas (`&nbsp;` se queda tal cual). */
function decodeEntities(text: string) {
  return text.replace(
    /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(lt|gt|quot|amp));/g,
    (_m, dec: string | undefined, hex: string | undefined, name: string) =>
      dec !== undefined
        ? codePoint(Number(dec))
        : hex !== undefined
          ? codePoint(Number.parseInt(hex, 16))
          : (NAMED_ENTITIES[name] as string),
  )
}

type AnyToken = Token & { tokens?: Token[]; text?: string; raw?: string }

function inline(tokens: Token[] | undefined): string {
  let out = ''
  for (const tok of (tokens ?? []) as AnyToken[]) {
    switch (tok.type) {
      case 'text':
        out += tok.tokens?.length ? inline(tok.tokens) : decodeEntities(tok.text ?? '')
        break
      case 'escape':
      case 'codespan':
        out += tok.text ?? ''
        break
      case 'br':
        out += '\n'
        break
      case 'image':
        out += tok.text ?? ''
        break
      case 'checkbox':
        break
      case 'html':
        // El editor no tiene nodo de HTML: se ve como texto.
        out += tok.raw ?? ''
        break
      default:
        out += tok.tokens ? inline(tok.tokens) : decodeEntities(tok.text ?? '')
    }
  }
  return out
}

/** Líneas en blanco al final de un bloque que el editor convierte en párrafos vacíos (como `extractAbsorbedBlankLines`). */
const TRAILING_BLANK_LINES = /\n[^\S\n]*(?:\n[^\S\n]*)+$/

function absorbBlankLines(tokens: AnyToken[]): AnyToken[] {
  return tokens.flatMap((tok, i) => {
    if (tok.type === 'space' || tokens[i + 1]?.type === 'space') return [tok]
    const trailing = (tok.raw ?? '').match(TRAILING_BLANK_LINES)
    if (!trailing) return [tok]
    return [
      { ...tok, raw: (tok.raw ?? '').slice(0, -trailing[0].length) } as AnyToken,
      { type: 'space', raw: trailing[0] } as AnyToken,
    ]
  })
}

/**
 * Bloques de texto de una lista de tokens. Con `implicit`, las líneas en blanco de más entre bloques son párrafos vacíos,
 * como en el editor (cada uno añade un separador).
 */
function blocks(tokens: Token[] | undefined, implicit: boolean, out: string[]) {
  const list = implicit
    ? absorbBlankLines((tokens ?? []) as AnyToken[])
    : ((tokens ?? []) as AnyToken[])
  const solid = list.map((t, i) => (t.type === 'space' ? -1 : i)).filter((i) => i >= 0)
  list.forEach((tok, i) => {
    switch (tok.type) {
      case 'space': {
        if (!implicit) return
        const separators = ((tok.raw ?? '').replace(/\r\n/g, '\n').match(/\n\n/g) ?? []).length
        if (separators === 0) return
        const boundary = !solid.some((j) => j < i) || !solid.some((j) => j > i)
        const empty = Math.max(separators - (boundary ? 0 : 1), 0)
        for (let k = 0; k < empty; k++) out.push('')
        return
      }
      case 'paragraph':
      case 'heading':
        out.push(inline(tok.tokens))
        return
      case 'text':
        out.push(tok.tokens?.length ? inline(tok.tokens) : decodeEntities(tok.text ?? ''))
        return
      case 'code':
        out.push(tok.text ?? '')
        return
      case 'blockquote':
        blocks(tok.tokens, true, out)
        return
      case 'list':
        for (const item of (tok as Token & { items: AnyToken[] }).items) listItem(item, out)
        return
      case 'table': {
        const table = tok as Token & {
          header: { tokens: Token[] }[]
          rows: { tokens: Token[] }[][]
        }
        for (const cell of table.header) out.push(inline(cell.tokens))
        for (const row of table.rows) for (const cell of row) out.push(inline(cell.tokens))
        return
      }
      case 'html': {
        const text = (tok.text ?? tok.raw ?? '').replace(/\s+$/, '')
        if (text) out.push(text)
        return
      }
      case 'hr':
      case 'def':
        return
      default:
        if (tok.tokens) blocks(tok.tokens, implicit, out)
    }
  })
}

/** Un elemento de lista (o de tareas): su primer párrafo y lo que lleve dentro. */
function listItem(item: AnyToken, out: string[]) {
  const tokens = ((item.tokens ?? []) as AnyToken[]).filter((t) => t.type !== 'checkbox')
  if (tokens.length === 0) {
    out.push('')
    return
  }
  const [first, ...rest] = tokens as [AnyToken, ...AnyToken[]]
  if (first.type === 'heading') {
    out.push(inline(first.tokens))
    blocks(rest, true, out)
  } else if (tokens.some((t) => t.type === 'paragraph')) {
    blocks(tokens, true, out)
  } else if (first.type === 'text') {
    out.push(first.tokens?.length ? inline(first.tokens) : decodeEntities(first.text ?? ''))
    blocks(rest, true, out)
  } else {
    blocks(tokens, true, out)
  }
}

/** El texto que se lee en la nota, sin marcas de Markdown: un `\n` entre bloques. */
export function noteText(markdown: string): string {
  if (!markdown.trim()) return ''
  const out: string[] = []
  blocks(Lexer.lex(markdown.replace(/\r\n?/g, '\n')), true, out)
  return out.join('\n')
}

// ─── Buscar una cita ────────────────────────────────────────────────────────

export interface Range {
  start: number
  end: number
}

export interface QuoteQuery {
  quote: string
  prefix?: string
  suffix?: string
  /** Posición aproximada, para desempatar por cercanía. */
  start?: number
  /** La n-ésima aparición (1 = la primera). Gana sobre el contexto. */
  occurrence?: number
}

function occurrences(text: string, quote: string): number[] {
  const out: number[] = []
  if (!quote) return out
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) out.push(i)
  return out
}

/** Caracteres iguales al final de `a` y `b`. */
function commonSuffix(a: string, b: string) {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

/** Caracteres iguales al principio de `a` y `b`. */
function commonPrefix(a: string, b: string) {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/** Cuánto casa el contexto de una aparición en `at` con el guardado. */
function contextScore(text: string, at: number, quote: string, prefix = '', suffix = '') {
  const before = text.slice(Math.max(0, at - prefix.length), at)
  const after = text.slice(at + quote.length, at + quote.length + suffix.length)
  return commonSuffix(before, prefix) + commonPrefix(after, suffix)
}

/** Texto con cada tramo de espacios (saltos incluidos) reducido a uno, y de dónde sale cada carácter. */
function collapseSpaces(text: string) {
  let out = ''
  const from: number[] = []
  const to: number[] = []
  for (let i = 0; i < text.length; ) {
    if (/\s/.test(text[i] as string)) {
      let j = i
      while (j < text.length && /\s/.test(text[j] as string)) j++
      out += ' '
      from.push(i)
      to.push(j)
      i = j
    } else {
      out += text[i]
      from.push(i)
      to.push(i + 1)
      i++
    }
  }
  return { out, from, to }
}

/** De las apariciones, la pedida o la que mejor casa con el contexto y queda más cerca. */
function pick(text: string, found: Range[], q: QuoteQuery): Range | null {
  if (found.length === 0) return null
  if (q.occurrence !== undefined) return found[q.occurrence - 1] ?? null
  let best = found[0] as Range
  let bestScore = -1
  let bestDistance = Number.POSITIVE_INFINITY
  for (const r of found) {
    const score = contextScore(text, r.start, text.slice(r.start, r.end), q.prefix, q.suffix)
    const distance = q.start === undefined ? 0 : Math.abs(r.start - q.start)
    if (score > bestScore || (score === bestScore && distance < bestDistance)) {
      best = r
      bestScore = score
      bestDistance = distance
    }
  }
  return best
}

/**
 * Dónde está una cita en el texto: la n-ésima aparición si se pide, o la que mejor casa con su contexto y, a igualdad, la
 * más cercana a `start`. Si no aparece tal cual, se busca sin tener en cuenta el espaciado (el editor y `noteText` pueden
 * diferir en los espacios de una línea de continuación). `null` si no aparece.
 */
export function locateQuote(text: string, q: QuoteQuery): Range | null {
  const exact = occurrences(text, q.quote).map((i) => ({ start: i, end: i + q.quote.length }))
  if (exact.length) return pick(text, exact, q)
  const t = collapseSpaces(text)
  const quote = collapseSpaces(q.quote).out
  if (!quote.trim()) return null
  const loose = occurrences(t.out, quote).map((i) => ({
    start: t.from[i] as number,
    end: t.to[i + quote.length - 1] as number,
  }))
  return pick(text, loose, q)
}

/** El ancla de un trozo del texto: la cita, su contexto y su posición. */
export function buildAnchor(text: string, range: Range): CommentAnchor {
  return {
    quote: text.slice(range.start, range.end),
    prefix: text.slice(Math.max(0, range.start - ANCHOR_CONTEXT), range.start),
    suffix: text.slice(range.end, range.end + ANCHOR_CONTEXT),
    start: range.start,
    end: range.end,
  }
}

// ─── Volver a anclar ────────────────────────────────────────────────────────

export type Reanchored = { anchor: CommentAnchor; orphaned: false } | { orphaned: true }

/** Citas más largas no se buscan de forma aproximada (el coste crece con el largo de la cita por el de la zona). */
const FUZZY_MAX_QUOTE = 2000

/**
 * La mejor coincidencia aproximada de `quote` cerca de `expected`, con distancia de edición ≤ 20 % de su largo. Algoritmo de
 * Sellers (Levenshtein con inicio libre en el texto), en una zona alrededor de `expected`: O(cita × zona). Gana la de menor
 * distancia y, a igualdad, la que empieza más cerca de `expected` y la más larga.
 */
function fuzzyFind(text: string, quote: string, expected: number): Range | null {
  if (quote.length > FUZZY_MAX_QUOTE || quote.length < 4) return null
  const maxDist = Math.floor(quote.length * 0.2)
  const span = quote.length * 2 + ANCHOR_CONTEXT * 2
  const from = Math.max(0, expected - span)
  const to = Math.min(text.length, expected + quote.length + span)
  const zone = text.slice(from, to)
  const m = quote.length
  const n = zone.length
  // Columna j = aparición que termina antes de zone[j]; por cada celda, la distancia y dónde empezó.
  let dist = new Array<number>(n + 1).fill(0)
  let start = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const nextDist = new Array<number>(n + 1)
    const nextStart = new Array<number>(n + 1)
    nextDist[0] = i
    nextStart[0] = 0
    const qc = quote[i - 1]
    for (let j = 1; j <= n; j++) {
      const sub = (dist[j - 1] as number) + (zone[j - 1] === qc ? 0 : 1)
      const del = (dist[j] as number) + 1 // falta un carácter de la cita
      const ins = (nextDist[j - 1] as number) + 1 // sobra un carácter del texto
      if (sub <= del && sub <= ins) {
        nextDist[j] = sub
        nextStart[j] = start[j - 1] as number
      } else if (del <= ins) {
        nextDist[j] = del
        nextStart[j] = start[j] as number
      } else {
        nextDist[j] = ins
        nextStart[j] = nextStart[j - 1] as number
      }
    }
    dist = nextDist
    start = nextStart
  }
  let best: (Range & { d: number }) | null = null
  for (let j = 1; j <= n; j++) {
    const d = dist[j] as number
    const s = start[j] as number
    if (d > maxDist || j <= s) continue
    const cand = { start: from + s, end: from + j, d }
    const closer = best && Math.abs(cand.start - expected) < Math.abs(best.start - expected)
    const same = best && cand.start === best.start
    if (!best || d < best.d || (d === best.d && (closer || (same && cand.end > best.end))))
      best = cand
  }
  return best && { start: best.start, end: best.end }
}

/**
 * Vuelve a anclar un hilo cuando el texto de la nota cambia (ADR-0079): proyecta la posición por lo que no cambió al
 * principio y al final; si no, busca la cita exacta con su contexto; si no, una aproximada cerca de donde estaba. Si nada
 * encaja, el hilo queda «Sin sitio» (nunca se borra).
 */
export function reanchor(oldText: string, newText: string, anchor: CommentAnchor): Reanchored {
  const { quote } = anchor
  // 1. Lo que no cambió al principio y al final de los dos textos.
  const head = commonPrefix(oldText, newText)
  const tail = Math.min(
    commonSuffix(oldText, newText),
    Math.min(oldText.length, newText.length) - head,
  )
  const delta = newText.length - oldText.length
  let projected: number | null = null
  if (anchor.end <= head) projected = anchor.start
  else if (anchor.start >= oldText.length - tail) projected = anchor.start + delta
  if (projected !== null && newText.slice(projected, projected + quote.length) === quote) {
    return {
      anchor: buildAnchor(newText, { start: projected, end: projected + quote.length }),
      orphaned: false,
    }
  }
  // Dónde debería estar más o menos, para desempatar.
  const expected =
    projected ??
    Math.max(0, Math.min(newText.length, anchor.start + (anchor.start >= head ? delta : 0)))

  // 2. La cita exacta, la que mejor casa con su contexto y queda más cerca.
  const exact = locateQuote(newText, {
    quote,
    prefix: anchor.prefix,
    suffix: anchor.suffix,
    start: expected,
  })
  if (exact) return { anchor: buildAnchor(newText, exact), orphaned: false }

  // 3. Aproximada en la zona esperada: la cita pasa a ser el texto nuevo.
  const near = fuzzyFind(newText, quote, expected)
  if (near) return { anchor: buildAnchor(newText, near), orphaned: false }

  // 4. Sin sitio.
  return { orphaned: true }
}
