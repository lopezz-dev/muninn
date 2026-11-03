import { describe, expect, it } from 'vitest'
import {
  docHtml,
  docPage,
  docsIndexPage,
  pageHtml,
  readDocs,
  robotsTxt,
  sitemapXml,
} from '../vite/seo'

const SITE = 'https://muninn.test'

const TEMPLATE = `<!doctype html>
<html lang="es">
  <head>
    <title>Muninn · Tu sistema operativo personal</title>
    <meta
      name="description"
      content="General"
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE}/" />
    <meta property="og:title" content="Muninn" />
    <meta
      property="og:description"
      content="General"
    />
    <meta name="twitter:title" content="Muninn" />
    <meta
      name="twitter:description"
      content="General"
    />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

const docs = readDocs()

describe('guías de docs/user en el build', () => {
  it('lee las guías numeradas, con título y slug', () => {
    expect(docs.length).toBeGreaterThan(5)
    expect(docs.map((d) => d.slug)).toContain('notas')
    expect(docs.every((d) => d.title)).toBe(true)
  })

  it('resuelve los enlaces entre guías y da a los títulos los ids de la app', () => {
    const html = docHtml(
      '## Archivar una nota\n\nMira [tareas](04-tareas.md#Fecha%20l%C3%ADmite) o [arriba](#Archivar%20una%20nota).',
    )
    expect(html).toContain('<h2 id="archivar-una-nota">')
    expect(html).toContain('href="/documentacion/tareas#fecha-limite"')
    expect(html).toContain('href="#archivar-una-nota"')
  })
})

describe('pageHtml', () => {
  const doc = docs.find((d) => d.slug === 'notas')
  if (!doc) throw new Error('falta la guía de notas')
  const html = pageHtml(TEMPLATE, docPage(doc, SITE))

  it('cambia título, metas (también las de varias líneas) y canónica', () => {
    expect(html).toContain(`<title>${doc.title} · Muninn</title>`)
    expect(html).not.toContain('content="General"')
    expect(html).toContain(`content="${SITE}/documentacion/notas"`)
    expect(html).toContain(`<link rel="canonical" href="${SITE}/documentacion/notas" />`)
    expect(html).toContain('<meta property="og:type" content="article" />')
  })

  it('mete el texto de la guía en #root y sus datos estructurados', () => {
    expect(html).toMatch(/<div id="root"><main class="prerender">[\s\S]*<h1>/)
    expect(html).toContain('"@type":"TechArticle"')
    expect(html).toContain('"@type":"BreadcrumbList"')
  })

  it('escapa lo que pone en atributos y no deja cerrar el <script> de JSON-LD', () => {
    const out = pageHtml(TEMPLATE, {
      title: 'A "B" <C>',
      description: 'x</script><b>',
      url: `${SITE}/x`,
      content: '',
      structured: [{ name: '</script>' }],
    })
    expect(out).toContain('content="x&lt;/script&gt;&lt;b&gt;"')
    expect(out).toContain('<title>A &quot;B&quot; &lt;C&gt; · Muninn</title>')
    expect(out).toContain('"\\u003c/script>"')
  })

  it('falla si index.html pierde una meta que se tiene que cambiar', () => {
    expect(() =>
      pageHtml(TEMPLATE.replace(/<meta name="twitter:title"[^>]*>/, ''), docPage(doc, SITE)),
    ).toThrow('twitter:title')
  })

  it('la portada enlaza todas las guías', () => {
    const index = docsIndexPage(docs, SITE)
    for (const d of docs) expect(index.content).toContain(`href="/documentacion/${d.slug}"`)
  })
})

describe('robots.txt y sitemap.xml', () => {
  it('robots bloquea lo privado, deja la documentación y apunta al sitemap del dominio', () => {
    const robots = robotsTxt(SITE)
    expect(robots).toContain('Disallow: /proyectos')
    expect(robots).not.toContain('Disallow: /documentacion')
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  it('el sitemap lista la entrada, la portada y cada guía', () => {
    const xml = sitemapXml(docs, SITE)
    expect(xml).toContain(`<loc>${SITE}/login</loc>`)
    expect(xml).toContain(`<loc>${SITE}/documentacion</loc>`)
    for (const d of docs) expect(xml).toContain(`<loc>${SITE}/documentacion/${d.slug}</loc>`)
  })
})
