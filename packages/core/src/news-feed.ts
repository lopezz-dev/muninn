/**
 * Lectura de feeds RSS 2.0, RSS 1.0 (RDF) y Atom (ADR-0042), sin dependencias ni DOM: corre en la Edge Function
 * `news` (Deno), en Node y en los tests. No es un parser XML completo: saca lo que Muninn guarda (título, enlace,
 * id, fecha, autor y un resumen en texto plano) y tolera los feeds mal formados más comunes.
 */

export interface ParsedFeedItem {
  guid: string
  url: string
  title: string
  summary: string
  author: string | null
  publishedAt: string | null
}

export interface ParsedFeed {
  title: string | null
  siteUrl: string | null
  items: ParsedFeedItem[]
}

/** Lo que se guarda como mucho: un resumen corto y un tope de artículos por descarga. */
export const NEWS_SUMMARY_MAX = 600
export const NEWS_ITEMS_PER_FEED = 50

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  euro: '€',
}

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all
    }
    return ENTITIES[code.toLowerCase()] ?? all
  })
}

/** Quita CDATA, etiquetas HTML y entidades: texto plano en una línea. */
export function plainText(html: string) {
  const unwrapped = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  // Las entidades primero: en RSS el HTML suele venir escapado (&lt;p&gt;).
  const decoded = /<|&lt;/.test(unwrapped) ? decodeEntities(unwrapped) : unwrapped
  return decodeEntities(
    decoded.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : text

/** Contenido de la primera etiqueta `name` (con o sin prefijo de espacio de nombres) dentro de `xml`. */
function tag(xml: string, name: string): string | null {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`,
    'i',
  )
  return re.exec(xml)?.[1] ?? null
}

/** Atributo `attr` de la primera etiqueta `name` que cumpla `filter` (p. ej. `<link rel="alternate" href>`). */
function attrOf(xml: string, name: string, attr: string, filter?: (el: string) => boolean) {
  const re = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>`, 'gi')
  for (const el of xml.match(re) ?? []) {
    if (filter && !filter(el)) continue
    const value = new RegExp(`\\s${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(el)
    if (value) return decodeEntities(value[2] ?? value[3] ?? '')
  }
  return null
}

function blocks(xml: string, name: string) {
  return (
    xml.match(
      new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>[\\s\\S]*?</(?:[\\w-]+:)?${name}>`, 'gi'),
    ) ?? []
  )
}

const text = (xml: string, ...names: string[]) => {
  for (const n of names) {
    const v = tag(xml, n)
    if (v !== null && plainText(v)) return plainText(v)
  }
  return null
}

/** Fechas RFC 822 (RSS) o ISO 8601 (Atom) → ISO; lo que no se entienda, `null`. */
export function feedDate(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value.trim())
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const isHttp = (u: string | null): u is string => Boolean(u && /^https?:\/\//i.test(u))

/** Un enlace relativo se resuelve contra la web de la fuente. */
function absolute(url: string | null, base: string | null) {
  if (!url) return null
  try {
    return new URL(url.trim(), base ?? undefined).toString()
  } catch {
    return null
  }
}

export function parseFeed(xml: string, feedUrl?: string): ParsedFeed {
  const atom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml)
  const head = xml.split(atom ? /<entry[\s>]/i : /<item[\s>]/i)[0] ?? ''
  const siteUrl = atom
    ? attrOf(head, 'link', 'href', (el) => !/rel\s*=\s*["'](?!alternate)/i.test(el))
    : text(head, 'link')
  const base = isHttp(siteUrl) ? siteUrl : (feedUrl ?? null)

  const items = blocks(xml, atom ? 'entry' : 'item')
    .slice(0, NEWS_ITEMS_PER_FEED)
    .flatMap((raw): ParsedFeedItem[] => {
      const title = text(raw, 'title')
      const link = atom
        ? attrOf(raw, 'link', 'href', (el) => !/rel\s*=\s*["'](?!alternate)/i.test(el))
        : (text(raw, 'link') ?? attrOf(raw, 'link', 'href'))
      const url = absolute(link, base)
      const guid = text(raw, atom ? 'id' : 'guid') ?? url
      if (!title || !url || !isHttp(url) || !guid) return []
      const summary = text(raw, 'description', 'summary', 'encoded', 'content') ?? ''
      return [
        {
          guid: clip(guid, 500),
          url,
          title: clip(title, 300),
          summary: clip(summary, NEWS_SUMMARY_MAX),
          author: (() => {
            const a =
              text(raw, 'creator') ??
              (atom ? text(tag(raw, 'author') ?? '', 'name') : text(raw, 'author'))
            return a ? clip(a, 120) : null
          })(),
          publishedAt: feedDate(
            tag(raw, 'pubDate') ?? tag(raw, 'published') ?? tag(raw, 'updated') ?? tag(raw, 'date'),
          ),
        },
      ]
    })

  return {
    title: text(head, 'title'),
    siteUrl: isHttp(siteUrl) ? siteUrl : null,
    items,
  }
}

export type FeedFetchResult =
  | { status: 'not-modified' }
  | { status: 'ok'; feed: ParsedFeed; etag: string | null; lastModified: string | null }

/**
 * Descarga una fuente con petición condicional (`If-None-Match` / `If-Modified-Since`): si no ha cambiado, el servidor
 * contesta 304 y no se procesa nada. 10 s como mucho y 3 MB de feed.
 */
export async function fetchFeed(
  source: { url: string; etag: string | null; lastModified: string | null },
  fetchFn: typeof fetch = fetch,
): Promise<FeedFetchResult> {
  const headers: Record<string, string> = {
    accept:
      'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
    'user-agent': 'Muninn/1.0 (+lector RSS personal)',
  }
  if (source.etag) headers['if-none-match'] = source.etag
  if (source.lastModified) headers['if-modified-since'] = source.lastModified
  const res = await fetchFn(source.url, {
    headers,
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  })
  if (res.status === 304) return { status: 'not-modified' }
  if (!res.ok) throw new Error(`La fuente respondió ${res.status}`)
  const body = await res.text()
  if (body.length > 3_000_000) throw new Error('El feed es demasiado grande')
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(body)) throw new Error('No parece un feed RSS o Atom')
  return {
    status: 'ok',
    feed: parseFeed(body, source.url),
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
  }
}
