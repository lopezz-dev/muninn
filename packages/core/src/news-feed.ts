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

// ─── Solo direcciones públicas (SSRF) ─────────────────────────────────────────
// La Edge Function descarga URLs que escribe el usuario desde la red de Supabase: sin estas comprobaciones, una fuente
// podría apuntar a servicios internos (metadatos de la nube, localhost…) y Muninn haría la petición por él.

/** IPv4 privada, local o reservada (también las mapeadas en IPv6). */
function privateIpv4(ip: string) {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a = 0, b = 0] = p
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

/** Los 8 grupos de 16 bits de una IPv6 (con `::` y un IPv4 al final, si lo trae); `null` si no lo es. */
function ipv6Groups(ip: string): number[] | null {
  let text = ip
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text)
  if (v4) {
    const [, p1 = 0, p2 = 0, p3 = 0, p4 = 0] = v4.map(Number)
    if ([p1, p2, p3, p4].some((n) => n > 255)) return null
    const hi = ((p1 << 8) | p2).toString(16)
    const lo = ((p3 << 8) | p4).toString(16)
    text = `${text.slice(0, -v4[0].length)}${hi}:${lo}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const part = (s: string | undefined) => (s ? s.split(':') : [])
  const head = part(halves[0])
  const tail = part(halves[1])
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => Number.parseInt(g, 16))
}

const ipv4Of = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`

/**
 * ¿Es una dirección IP (v4 o v6) que no es pública? En IPv6 solo vale el unicast global (`2000::/3`), sin Teredo ni
 * documentación; si lleva una IPv4 dentro (NAT64 `64:ff9b::/96`, 6to4 `2002::/16`), cuenta la IPv4. Lo que no se
 * entiende como IP, por si acaso, tampoco vale.
 */
export function isPrivateAddress(address: string) {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return privateIpv4(ip)
  if (!ip.includes(':')) return false
  const g = ipv6Groups(ip)
  if (!g) return true
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g7 = 0, g8 = 0] = g
  if (a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0) {
    return privateIpv4(ipv4Of(g7, g8))
  }
  if (a === 0x2002) return privateIpv4(ipv4Of(b, c))
  // Fuera de 2000::/3 quedan ::1, las IPv4 mapeadas o «compatibles» (::ffff:…, ::7f00:1), fc00::/7, fe80::/10, ff00::/8…
  if ((a & 0xe000) !== 0x2000) return true
  return a === 0x2001 && (b === 0 || b === 0xdb8)
}

/**
 * Lanza si la URL no es una dirección web pública: solo `http(s)`, puertos 80/443, sin usuario ni contraseña, sin
 * `localhost`, nombres sin punto ni dominios internos, y sin IPs privadas. Con `resolve` (DNS), también comprueba las
 * direcciones a las que apunta el nombre.
 */
export async function assertPublicUrl(
  raw: string,
  resolve?: (hostname: string) => Promise<string[]>,
): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('La dirección no es válida')
  }
  const host = url.hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '')
  const bad = () => new Error('Solo se pueden leer fuentes con una dirección pública de internet')
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw bad()
  if (url.username || url.password) throw bad()
  if (url.port && url.port !== '80' && url.port !== '443') throw bad()
  if (
    !host ||
    host === 'localhost' ||
    /\.(localhost|local|internal|lan|home|arpa)$/.test(host) ||
    (!host.includes('.') && !host.includes(':')) ||
    isPrivateAddress(host)
  ) {
    throw bad()
  }
  if (resolve && !/^[\d.]+$/.test(host) && !host.includes(':')) {
    const addresses = await resolve(host)
    // Sin IPs el nombre no existe (o el DNS no contesta): no se descarga, pero el motivo es otro.
    if (!addresses.length)
      throw new Error(`No encuentro ${host}: revisa que la dirección esté bien escrita`)
    if (addresses.some(isPrivateAddress)) throw bad()
  }
  return url
}

/** Lee el cuerpo como texto sin pasar de `max` bytes (un servidor podría mandar uno infinito). */
async function readCapped(res: Response, max: number) {
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > max) throw new Error('El feed es demasiado grande')
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      throw new Error('El feed es demasiado grande')
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

export const FEED_MAX_BYTES = 3_000_000
const MAX_REDIRECTS = 3

export interface FetchFeedOptions {
  /**
   * Resuelve un nombre a sus IPs (en la Edge Function, `Deno.resolveDns`): así tampoco valen nombres que apuntan dentro.
   * Es obligatorio a propósito: sin DNS no se descarga nada (si no puede resolver, que lance o devuelva `[]`).
   */
  resolve: (hostname: string) => Promise<string[]>
}

/**
 * Descarga una fuente con petición condicional (`If-None-Match` / `If-Modified-Since`): si no ha cambiado, el servidor
 * contesta 304 y no se procesa nada. 10 s como mucho y 3 MB de feed. Solo direcciones públicas, también tras cada
 * redirección (que se siguen a mano, como mucho 3).
 */
export async function fetchFeed(
  source: { url: string; etag: string | null; lastModified: string | null },
  fetchFn: typeof fetch,
  options: FetchFeedOptions,
): Promise<FeedFetchResult> {
  const headers: Record<string, string> = {
    accept:
      'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
    'user-agent': 'Muninn/1.0 (+lector RSS personal)',
  }
  if (source.etag) headers['if-none-match'] = source.etag
  if (source.lastModified) headers['if-modified-since'] = source.lastModified
  const signal = AbortSignal.timeout(10_000)
  let target = await assertPublicUrl(source.url, options.resolve)
  let res: Response
  for (let hop = 0; ; hop++) {
    res = await fetchFn(target.toString(), { headers, signal, redirect: 'manual' })
    const location = res.headers.get('location')
    if (res.status < 300 || res.status > 399 || res.status === 304 || !location) break
    if (hop >= MAX_REDIRECTS) throw new Error('Demasiadas redirecciones')
    await res.body?.cancel().catch(() => {})
    target = await assertPublicUrl(new URL(location, target).toString(), options.resolve)
  }
  if (res.status === 304) return { status: 'not-modified' }
  if (!res.ok) throw new Error(`La fuente respondió ${res.status}`)
  const body = await readCapped(res, FEED_MAX_BYTES)
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(body)) throw new Error('No parece un feed RSS o Atom')
  return {
    status: 'ok',
    feed: parseFeed(body, source.url),
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
  }
}
