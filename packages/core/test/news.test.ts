import { describe, expect, it } from 'vitest'
import {
  createMemoryStore,
  createMuninn,
  decodeEntities,
  fetchFeed,
  parseFeed,
  plainText,
  relatedProjects,
  ValidationError,
} from '../src'

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

  it('descarga condicional: 304, error y feed', async () => {
    const seen: Record<string, string>[] = []
    const fake = (status: number, body = '', headers: Record<string, string> = {}) =>
      (async (_u: string, init: RequestInit) => {
        seen.push(init.headers as Record<string, string>)
        return new Response(status === 304 ? null : body, { status, headers })
      }) as unknown as typeof fetch
    const src = { url: 'https://x.test/rss', etag: '"abc"', lastModified: null }
    expect(await fetchFeed(src, fake(304))).toEqual({ status: 'not-modified' })
    expect(seen[0]?.['if-none-match']).toBe('"abc"')
    await expect(fetchFeed(src, fake(500))).rejects.toThrow('500')
    await expect(fetchFeed(src, fake(200, '<html></html>'))).rejects.toThrow('No parece un feed')
    const ok = await fetchFeed(src, fake(200, RSS, { etag: '"def"' }))
    expect(ok.status === 'ok' && ok.etag).toBe('"def"')
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
    const summary = await app.news.refresh(fetchFn)
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
