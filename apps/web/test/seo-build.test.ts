import { describe, expect, it } from 'vitest'
import {
  docHtml,
  docPage,
  docsIndexPage,
  pageHtml,
  readAllDocs,
  robotsTxt,
  sitemapXml,
} from '../vite/seo'

const SITE = 'https://muninn.test'

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <title>Muninn · Your personal operating system</title>
    <meta
      name="description"
      content="General"
    />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="es_ES" />
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
    <noscript>
      <p>Turn on JavaScript.</p>
    </noscript>
  </body>
</html>`

const docs = readAllDocs()

describe('guías de docs/user en el build', () => {
  it('lee las guías numeradas de cada idioma, con título y slug', () => {
    expect(docs.en.length).toBeGreaterThan(5)
    expect(docs.es.length).toBe(docs.en.length)
    expect(docs.en.map((d) => d.slug)).toContain('notes')
    expect(docs.es.map((d) => d.slug)).toContain('notas')
    expect([...docs.en, ...docs.es].every((d) => d.title)).toBe(true)
  })

  it('resuelve los enlaces entre guías en su idioma y da a los títulos los ids de la app', () => {
    const es = docHtml(
      '## Archivar una nota\n\nMira [tareas](04-tareas.md#Fecha%20l%C3%ADmite) o [arriba](#Archivar%20una%20nota).',
      docs.es,
    )
    expect(es).toContain('<h2 id="archivar-una-nota">')
    expect(es).toContain('href="/es/docs/tareas#fecha-limite"')
    expect(es).toContain('href="#archivar-una-nota"')
    const en = docHtml('See [tasks](04-tasks.md#due-date).', docs.en)
    expect(en).toContain('href="/docs/tasks#due-date"')
  })
})

describe('pageHtml', () => {
  const es = docs.es.find((d) => d.slug === 'notas')
  const en = docs.en.find((d) => d.slug === 'notes')
  if (!es || !en) throw new Error('falta la guía de notas')
  const html = pageHtml(TEMPLATE, docPage(es, docs.es, SITE))

  it('cambia título, metas (también las de varias líneas) y canónica', () => {
    expect(html).toContain(`<title>${es.title} · Muninn</title>`)
    expect(html).not.toContain('content="General"')
    expect(html).toContain(`content="${SITE}/es/docs/notas"`)
    expect(html).toContain(`<link rel="canonical" href="${SITE}/es/docs/notas" />`)
    expect(html).toContain('<meta property="og:type" content="article" />')
  })

  it('declara su idioma y sus alternativas', () => {
    expect(html).toContain('<html lang="es">')
    expect(html).toContain('<meta property="og:locale" content="es_ES" />')
    expect(html).toContain('<meta property="og:locale:alternate" content="en_US" />')
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE}/docs/notes" />`)
    expect(html).toContain(`<link rel="alternate" hreflang="es" href="${SITE}/es/docs/notas" />`)
    expect(html).toContain(
      `<link rel="alternate" hreflang="x-default" href="${SITE}/docs/notes" />`,
    )
    expect(html).toContain('"inLanguage":"es"')
    expect(html).toContain('activa JavaScript')
    expect(html).not.toContain('Turn on JavaScript.')
    const english = pageHtml(TEMPLATE, docPage(en, docs.en, SITE))
    expect(english).toContain('<html lang="en">')
    expect(english).toContain(`<link rel="canonical" href="${SITE}/docs/notes" />`)
  })

  it('mete el texto de la guía en #root y sus datos estructurados', () => {
    expect(html).toMatch(/<div id="root"><main class="prerender">[\s\S]*<h1>/)
    expect(html).toContain('"@type":"TechArticle"')
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).toContain('<a href="/es/docs">Documentación</a>')
  })

  it('escapa lo que pone en atributos y no deja cerrar el <script> de JSON-LD', () => {
    const out = pageHtml(TEMPLATE, {
      title: 'A "B" <C>',
      description: 'x</script><b>',
      url: `${SITE}/x`,
      lang: 'en',
      alternates: { en: `${SITE}/x`, es: `${SITE}/es/x` },
      content: '',
      structured: [{ name: '</script>' }],
    })
    expect(out).toContain('content="x&lt;/script&gt;&lt;b&gt;"')
    expect(out).toContain('<title>A &quot;B&quot; &lt;C&gt; · Muninn</title>')
    expect(out).toContain('"\\u003c/script>"')
  })

  it('falla si index.html pierde una meta que se tiene que cambiar', () => {
    expect(() =>
      pageHtml(
        TEMPLATE.replace(/<meta name="twitter:title"[^>]*>/, ''),
        docPage(es, docs.es, SITE),
      ),
    ).toThrow('twitter:title')
  })

  it('la portada de cada idioma enlaza todas sus guías', () => {
    const indexEs = docsIndexPage(docs.es, 'es', SITE)
    for (const d of docs.es) expect(indexEs.content).toContain(`href="/es/docs/${d.slug}"`)
    expect(indexEs.url).toBe(`${SITE}/es/docs`)
    const indexEn = docsIndexPage(docs.en, 'en', SITE)
    for (const d of docs.en) expect(indexEn.content).toContain(`href="/docs/${d.slug}"`)
    expect(indexEn.alternates).toEqual({ en: `${SITE}/docs`, es: `${SITE}/es/docs` })
  })
})

describe('robots.txt y sitemap.xml', () => {
  it('robots bloquea lo privado, deja la documentación y apunta al sitemap del dominio', () => {
    const robots = robotsTxt(SITE)
    expect(robots).toContain('Disallow: /projects')
    expect(robots).not.toContain('Disallow: /docs')
    expect(robots).not.toContain('Disallow: /es')
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  it('el sitemap lista la entrada y, en los dos idiomas, la portada y cada guía con sus alternativas', () => {
    const xml = sitemapXml(docs, SITE)
    expect(xml).toContain(`<loc>${SITE}/login</loc>`)
    expect(xml).toContain(`<loc>${SITE}/docs</loc>`)
    expect(xml).toContain(`<loc>${SITE}/es/docs</loc>`)
    for (const d of docs.en) expect(xml).toContain(`<loc>${SITE}/docs/${d.slug}</loc>`)
    for (const d of docs.es) expect(xml).toContain(`<loc>${SITE}/es/docs/${d.slug}</loc>`)
    expect(xml).toContain(
      `<url><loc>${SITE}/es/docs/notas</loc><xhtml:link rel="alternate" hreflang="en" href="${SITE}/docs/notes"/><xhtml:link rel="alternate" hreflang="es" href="${SITE}/es/docs/notas"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/docs/notes"/></url>`,
    )
  })
})
