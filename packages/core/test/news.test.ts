import { describe, expect, it } from 'vitest'
import {
  assertPublicUrl,
  createMemoryStore,
  createMuninn,
  decodeEntities,
  feedCharset,
  fetchFeed,
  isPrivateAddress,
  parseFeed,
  plainText,
  relatedProjects,
  ValidationError,
} from '../src'

/** DNS falso: todo nombre apunta a una IP pública. */
const dns = { resolve: async () => ['93.184.216.34'] }

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Blog de Tauri</title>
  <link>https://tauri.app/blog</link>
  <item>
    <title>Guía: firmar &amp; notarizar apps en macOS</title>
    <link>https://tauri.app/blog/firmar-macos</link>
    <guid isPermaLink="false">tauri-123</guid>
    <pubDate>Wed, 21 Oct 2026 08:30:00 +0000</pubDate>
    <dc:creator>Ana</dc:creator>
    <description><![CDATA[<p>Paso a paso del <b>Developer ID</b> y de notarytool en HuginnDB.</p><script>x()</script>]]></description>
  </item>
  <item>
    <title>Sin enlace</title>
  </item>
  <item>
    <title>Enlace relativo</title>
    <link>/blog/relativo</link>
    <description>&lt;p&gt;Texto escapado &amp;amp; con entidades&lt;/p&gt;</description>
  </item>
</channel>
</rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">This Week in Rust</title>
  <link rel="self" href="https://this-week-in-rust.org/atom.xml"/>
  <link href="https://this-week-in-rust.org/"/>
  <entry>
    <title>This Week in Rust 600</title>
    <link rel="alternate" href="https://this-week-in-rust.org/blog/600/"/>
    <id>tag:this-week-in-rust.org,2026:600</id>
    <updated>2026-10-21T00:00:00Z</updated>
    <author><name>TWiR</name></author>
    <summary>Novedades de la semana</summary>
  </entry>
</feed>`

describe('lector de feeds', () => {
  it('RSS 2.0: título, enlace, guid, fecha, autor y resumen en texto plano', () => {
    const f = parseFeed(RSS, 'https://tauri.app/blog/rss.xml')
    expect(f.title).toBe('Blog de Tauri')
    expect(f.siteUrl).toBe('https://tauri.app/blog')
    expect(f.items).toHaveLength(2)
    expect(f.items[0]).toEqual({
      guid: 'tauri-123',
      url: 'https://tauri.app/blog/firmar-macos',
      title: 'Guía: firmar & notarizar apps en macOS',
      summary: 'Paso a paso del Developer ID y de notarytool en HuginnDB.',
      author: 'Ana',
      publishedAt: '2026-10-21T08:30:00.000Z',
    })
    // Sin guid, el enlace (resuelto contra la web) hace de id; el HTML escapado se limpia.
    expect(f.items[1]).toMatchObject({
      guid: 'https://tauri.app/blog/relativo',
      url: 'https://tauri.app/blog/relativo',
      summary: 'Texto escapado & con entidades',
      publishedAt: null,
    })
  })

  it('Atom: enlace alternativo, id, updated y autor', () => {
    const f = parseFeed(ATOM)
    expect(f.title).toBe('This Week in Rust')
    expect(f.siteUrl).toBe('https://this-week-in-rust.org/')
    expect(f.items[0]).toMatchObject({
      guid: 'tag:this-week-in-rust.org,2026:600',
      url: 'https://this-week-in-rust.org/blog/600/',
      author: 'TWiR',
      publishedAt: '2026-10-21T00:00:00.000Z',
    })
  })

  it('entidades y texto plano', () => {
    expect(decodeEntities('&laquo;Hola&raquo; &#241; &#x00e9; &unknown;')).toBe(
      '«Hola» ñ é &unknown;',
    )
    expect(plainText('<p>uno</p>\n<p>dos</p>')).toBe('uno dos')
  })

  it('quita el enlace de «Leer» del final del resumen', () => {
    // Tal cual lo manda Expansión: el enlace «Leer» y un píxel de seguimiento.
    const expansion =
      '<![CDATA[Unicaja gana 543 millones.&nbsp;<a href="https://www.expansion.com/a.html">Leer</a><img src="http://x.test/m" alt=""/>]]>'
    expect(plainText(expansion)).toBe('Unicaja gana 543 millones.')
    expect(plainText('Texto. &lt;a href="https://x.test"&gt;Read more »&lt;/a&gt;')).toBe('Texto.')
    expect(plainText('Texto <a href="https://x.test">[…] Seguir leyendo</a>')).toBe('Texto')
    // Un enlace con otro texto se queda.
    expect(plainText('Lo cuenta <a href="https://x.test">Reuters</a>.')).toBe('Lo cuenta Reuters .')
  })

  it('un resumen que solo es «Leer» se queda vacío', () => {
    const f = parseFeed(`<rss><channel><item><title>T</title><link>https://x.test/1</link>
      <description><![CDATA[<a href="https://x.test/1">Leer</a>]]></description></item></channel></rss>`)
    expect(f.items[0]?.summary).toBe('')
  })

  it('descarga condicional: 304, error y feed', async () => {
    const seen: Record<string, string>[] = []
    const fake = (status: number, body = '', headers: Record<string, string> = {}) =>
      (async (_u: string, init: RequestInit) => {
        seen.push(init.headers as Record<string, string>)
        return new Response(status === 304 ? null : body, { status, headers })
      }) as unknown as typeof fetch
    const src = { url: 'https://x.test/rss', etag: '"abc"', lastModified: null }
    expect(await fetchFeed(src, fake(304), dns)).toEqual({ status: 'not-modified' })
    expect(seen[0]?.['if-none-match']).toBe('"abc"')
    await expect(fetchFeed(src, fake(500), dns)).rejects.toThrow('500')
    await expect(fetchFeed(src, fake(200, '<html></html>'), dns)).rejects.toThrow(
      'No parece un feed',
    )
    const ok = await fetchFeed(src, fake(200, RSS, { etag: '"def"' }), dns)
    expect(ok.status === 'ok' && ok.etag).toBe('"def"')
  })

  it('respeta la codificación del feed (el BOE va en ISO-8859-1)', async () => {
    const xml = `<?xml version="1.0" encoding="ISO-8859-1"?><rss version="2.0"><channel><title>BOE</title>
      <item><title>Real Decreto sobre la campaña de vacunación</title><link>https://boe.es/1</link></item></channel></rss>`
    // Cada carácter, un byte: así viaja un feed en latin-1.
    const latin1 = Uint8Array.from(xml, (c) => c.charCodeAt(0))
    const src = { url: 'https://x.test/rss', etag: null, lastModified: null }
    const fetchFn = (async () =>
      new Response(latin1, {
        status: 200,
        headers: { 'content-type': 'text/xml' },
      })) as unknown as typeof fetch
    const res = await fetchFeed(src, fetchFn, dns)
    expect(res.status === 'ok' && res.feed.items[0]?.title).toBe(
      'Real Decreto sobre la campaña de vacunación',
    )
    // La cabecera manda sobre la declaración XML.
    expect(feedCharset('text/xml; charset=ISO-8859-1', '<?xml encoding="UTF-8"?>')).toBe(
      'windows-1252',
    )
    expect(feedCharset(null, '<?xml version="1.0"?>')).toBe('utf-8')
    expect(feedCharset('text/xml; charset=nope', '')).toBe('utf-8')
  })
})

describe('noticias en el core', () => {
  const setup = () => {
    let clock = new Date('2026-10-22T07:00:00Z')
    const app = createMuninn(createMemoryStore(undefined, { now: () => clock.toISOString() }), {
      now: () => clock,
      timeZone: 'Europe/Madrid',
    })
    return { app, tick: (ms: number) => (clock = new Date(clock.getTime() + ms)) }
  }

  it('fuentes: alta con el dominio de título, sin duplicar, archivar y recuperar al volver a añadirla', async () => {
    const { app } = setup()
    const s = await app.news.sources.create({
      url: 'https://www.tauri.app/blog/rss.xml',
      topic: 'Tauri',
    })
    expect(s).toMatchObject({ title: 'tauri.app', enabled: true, topic: 'Tauri' })
    await expect(app.news.sources.create({ url: s.url })).rejects.toThrow('Ya tienes esa fuente')
    await expect(app.news.sources.create({ url: 'ftp://x' })).rejects.toThrow(ValidationError)
    await app.news.sources.archive(s.id)
    expect(await app.news.sources.list()).toHaveLength(0)
    const back = await app.news.sources.create({ url: s.url })
    expect(back.id).toBe(s.id)
    expect(back.archivedAt).toBeNull()
  })

  it('ingesta sin duplicados, título del feed y artículos por tema', async () => {
    const { app, tick } = setup()
    const tauri = await app.news.sources.create({
      url: 'https://tauri.app/blog/rss.xml',
      topic: 'Tauri',
    })
    const rust = await app.news.sources.create({
      url: 'https://this-week-in-rust.org/atom.xml',
      topic: 'Rust',
    })
    const first = await app.news.ingest(tauri.id, {
      feed: parseFeed(RSS),
      etag: '"1"',
      lastModified: null,
    })
    expect(first.added).toHaveLength(2)
    tick(60_000)
    const again = await app.news.ingest(tauri.id, {
      feed: parseFeed(RSS),
      etag: '"2"',
      lastModified: null,
    })
    expect(again.added).toHaveLength(0)
    expect(await app.news.sources.get(tauri.id)).toMatchObject({
      title: 'Blog de Tauri',
      etag: '"2"',
    })
    await app.news.ingest(rust.id, { feed: parseFeed(ATOM), etag: null, lastModified: null })

    // Sin fecha de publicación cuenta la de descarga (hoy): va primero.
    expect((await app.news.items.list()).map((i) => i.title)).toEqual([
      'Enlace relativo',
      'Guía: firmar & notarizar apps en macOS',
      'This Week in Rust 600',
    ])
    expect(await app.news.items.list({ topic: 'rust' })).toHaveLength(1)

    // Un título puesto a mano no lo pisa el feed; un error se apunta en la fuente.
    await app.news.sources.update(rust.id, { title: 'TWiR', enabled: false })
    await app.news.ingest(rust.id, { feed: parseFeed(ATOM), etag: null, lastModified: null })
    expect((await app.news.sources.get(rust.id)).title).toBe('TWiR')
    await app.news.ingest(rust.id, { error: 'La fuente respondió 500' })
    expect((await app.news.sources.get(rust.id)).lastError).toBe('La fuente respondió 500')

    // Las fuentes archivadas no salen en la lista de artículos.
    await app.news.sources.archive(tauri.id)
    expect((await app.news.items.list()).map((i) => i.sourceId)).toEqual([rust.id])
  })

  it('leer, guardar y resumen del día', async () => {
    const { app } = setup()
    const s = await app.news.sources.create({ url: 'https://tauri.app/blog/rss.xml' })
    const { added } = await app.news.ingest(s.id, {
      feed: parseFeed(RSS),
      etag: null,
      lastModified: null,
    })
    const item = added[0]
    if (!item) throw new Error('sin artículos')
    await app.news.items.markRead(item.id)
    await app.news.items.setSaved(item.id, true)
    expect(await app.news.items.list({ saved: true })).toHaveLength(1)
    expect(await app.news.items.list({ unread: true })).toHaveLength(1)

    expect(await app.news.digests.get()).toBeNull()
    const d = await app.news.digests.save({
      date: app.today(),
      content: '- Uno',
      model: 'qwen3:8b',
      itemIds: [item.id],
    })
    const d2 = await app.news.digests.save({ date: app.today(), content: '- Dos' })
    expect(d2.id).toBe(d.id)
    expect((await app.news.digests.get())?.content).toBe('- Dos')
    expect((await app.news.digests.latest())?.date).toBe('2026-10-22')
  })

  it('refresh descarga las fuentes activas y apunta errores', async () => {
    const { app } = setup()
    await app.news.sources.create({ url: 'https://tauri.app/blog/rss.xml' })
    const off = await app.news.sources.create({ url: 'https://off.test/rss' })
    await app.news.sources.update(off.id, { enabled: false })
    const broken = await app.news.sources.create({ url: 'https://broken.test/rss' })
    const fetchFn = (async (url: string) =>
      url.includes('broken')
        ? new Response('no', { status: 404 })
        : new Response(RSS, { status: 200 })) as unknown as typeof fetch
    const summary = await app.news.refresh(fetchFn, dns)
    expect(summary).toMatchObject({ sources: 2, added: 2, notModified: 0 })
    expect(summary.errors).toEqual([{ sourceId: broken.id, error: 'La fuente respondió 404' }])
    await expect(app.news.fetchNow()).rejects.toThrow('servidor')
  })

  it('relacionadas con un proyecto: palabra completa, sin tildes ni mayúsculas', () => {
    const projects = [
      { id: '1', name: 'HuginnDB' },
      { id: '2', name: 'Muninn' },
      { id: '3', name: 'IA' },
    ]
    expect(
      relatedProjects({ title: 'Firmar apps', summary: 'para huginndb y más' }, projects),
    ).toEqual([projects[0]])
    expect(relatedProjects({ title: 'MuninnX no cuenta', summary: '' }, projects)).toEqual([])
  })
})

describe('noticias: solo direcciones públicas (SSRF)', () => {
  it('rechaza localhost, IPs privadas, puertos raros, credenciales y nombres internos', async () => {
    for (const url of [
      'http://localhost/rss',
      'http://127.0.0.1/rss',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.5/feed',
      'http://192.168.1.10/feed',
      'http://172.20.0.1/feed',
      'http://[::1]/feed',
      'http://[fd00::1]/feed',
      'http://[::ffff:127.0.0.1]/feed',
      'http://[::127.0.0.1]/feed',
      'http://[64:ff9b::169.254.169.254]/feed',
      'http://[2002:a00:1::1]/feed',
      'http://[2001:0:4136:e378::1]/feed',
      'http://[fec0::1]/feed',
      'https://intranet/feed',
      'https://db.internal/feed',
      'https://ejemplo.com:8443/feed',
      'https://user:pass@ejemplo.com/feed',
      'ftp://ejemplo.com/feed',
    ]) {
      await expect(assertPublicUrl(url), url).rejects.toThrow('dirección pública')
    }
    await expect(assertPublicUrl('https://blog.ejemplo.com/rss.xml')).resolves.toBeInstanceOf(URL)
    await expect(assertPublicUrl('https://93.184.216.34/rss')).resolves.toBeInstanceOf(URL)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
    expect(isPrivateAddress('2606:4700::1111')).toBe(false)
  })

  it('IPv6: solo unicast global, y las IPv4 que van dentro cuentan como IPv4', () => {
    for (const ip of [
      '::',
      '::1',
      '::7f00:1',
      '::ffff:7f00:1',
      '::ffff:8.8.8.8',
      '64:ff9b::a9fe:a9fe',
      '64:ff9b:1::1',
      '2002:7f00:1::',
      '2002:c0a8:101::1',
      '2001::1',
      '2001:db8::1',
      'fd12:3456::1',
      'fe80::1',
      'ff02::1',
      '1::2::3',
      'zz::1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['64:ff9b::808:808', '64:ff9b::8.8.8.8', '2002:808:808::1', '2a00:1450::1']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })

  it('sin DNS no se descarga nada', async () => {
    let fetched = false
    const fetchFn = (async () => {
      fetched = true
      return new Response(RSS, { status: 200 })
    }) as unknown as typeof fetch
    const src = { url: 'https://blog.ejemplo.com/rss', etag: null, lastModified: null }
    const noDns = {
      resolve: async (): Promise<string[]> => {
        throw new Error('Este servidor no puede comprobar a qué dirección apunta la fuente')
      },
    }
    await expect(fetchFeed(src, fetchFn, noDns)).rejects.toThrow('no puede comprobar')
    // Un nombre que no existe: el DNS no devuelve nada y se dice así, no como «dirección no pública».
    await expect(fetchFeed(src, fetchFn, { resolve: async () => [] })).rejects.toThrow(
      'No encuentro blog.ejemplo.com',
    )
    expect(fetched).toBe(false)
  })

  it('con DNS, un nombre que apunta dentro tampoco vale', async () => {
    const resolve = async (h: string) =>
      h === 'trampa.ejemplo.com' ? ['10.1.2.3'] : ['93.184.216.34']
    await expect(assertPublicUrl('https://trampa.ejemplo.com/rss', resolve)).rejects.toThrow()
    await expect(assertPublicUrl('https://bien.ejemplo.com/rss', resolve)).resolves.toBeInstanceOf(
      URL,
    )
  })

  it('las redirecciones se siguen a mano y se comprueban; el tamaño tiene tope', async () => {
    const calls: string[] = []
    const redirectTo = (location: string) =>
      (async (url: string, init: RequestInit) => {
        calls.push(url)
        expect(init.redirect).toBe('manual')
        return url.includes('final')
          ? new Response(RSS, { status: 200 })
          : new Response(null, { status: 302, headers: { location } })
      }) as unknown as typeof fetch
    const src = { url: 'https://a.ejemplo.com/rss', etag: null, lastModified: null }
    await expect(fetchFeed(src, redirectTo('http://169.254.169.254/'), dns)).rejects.toThrow(
      'dirección pública',
    )
    const ok = await fetchFeed(src, redirectTo('https://b.ejemplo.com/final'), dns)
    expect(ok.status).toBe('ok')
    expect(calls.at(-1)).toBe('https://b.ejemplo.com/final')
    const huge = (async () =>
      new Response('x', {
        status: 200,
        headers: { 'content-length': '999999999' },
      })) as unknown as typeof fetch
    await expect(fetchFeed(src, huge, dns)).rejects.toThrow('demasiado grande')
  })

  it('no deja añadir una fuente interna', async () => {
    const app = createMuninn(createMemoryStore())
    await expect(app.news.sources.create({ url: 'http://localhost:54321/rss' })).rejects.toThrow(
      ValidationError,
    )
  })
})
