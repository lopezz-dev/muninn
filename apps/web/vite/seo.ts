import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Marked, type Tokens } from 'marked'
import type { Plugin } from 'vite'
import {
  DOC_LANGS,
  type DocLang,
  docAlternates,
  docPath,
  OG_LOCALE,
  otherDocLang,
} from '../src/lib/doc-slugs'
import { buildDocs, type Doc, groupDocs, groupLabel, linkedDoc } from '../src/lib/docs'
import { makeSlugger, slugify } from '../src/markdown/outline'
import { plainText } from '../src/markdown/plain'

/**
 * SEO en el build (ADR-0076): la URL pública sale de aquí y de ningún otro sitio. Con ella se completan las metas de
 * `index.html` (`%SITE_URL%`), se escriben `robots.txt` y `sitemap.xml`, y se prerenderiza un HTML por guía de
 * `docs/user` y por idioma (ADR-0077: `/docs/…` en inglés y `/es/docs/…` en español, enlazados con `hreflang`) para
 * que buscadores y tarjetas de enlace las lean sin ejecutar JavaScript.
 */

/** Dominio de producción, sin barra final. Cámbialo con `MUNINN_SITE_URL` (en Vercel, en *Environment Variables*). */
export const SITE_URL = (process.env.MUNINN_SITE_URL || 'https://muninn-sepia.vercel.app').replace(
  /\/+$/,
  '',
)

const DOCS_DIR = new URL('../../../docs/user/', import.meta.url)

/** Lo que el prerender escribe por su cuenta, en cada idioma (la app usa i18next; esto se genera sin él). */
const TEXT: Record<
  DocLang,
  { docs: string; docsTitle: string; indexDescription: string; noscript: string }
> = {
  en: {
    docs: 'Documentation',
    docsTitle: 'Muninn documentation',
    indexDescription:
      'Muninn guides: getting started, projects and board, tasks, notes, finances, GitHub, news, the assistant and your account.',
    noscript:
      'Muninn is your personal operating system: projects, tasks, notes, finances and more in one place. To use it, turn on JavaScript in your browser.',
  },
  es: {
    docs: 'Documentación',
    docsTitle: 'Documentación de Muninn',
    indexDescription:
      'Guías de Muninn: primeros pasos, proyectos y tablero, tareas, notas, finanzas, GitHub, noticias, el asistente y tu cuenta.',
    noscript:
      'Muninn es tu sistema operativo personal: proyectos, tareas, notas, finanzas y más en un solo sitio. Para usarlo, activa JavaScript en tu navegador.',
  },
}

/** Las guías de los dos idiomas. */
export type DocsByLang = Record<DocLang, Doc[]>

/** Lo que pide sesión: los buscadores no tienen nada que ver ahí (redirige a /login). */
const PRIVATE_PATHS = [
  '/projects',
  '/notes',
  '/finance',
  '/assistant',
  '/news',
  '/github',
  '/mas',
  '/settings',
  '/dev/',
  '/oauth/',
]

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** JSON dentro de `<script>`: sin `</` que pueda cerrarlo antes de tiempo. */
const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

/** Las guías numeradas de `docs/user/<idioma>`, como las ve la pantalla de Documentación. */
export function readDocs(lang: DocLang, root: URL = DOCS_DIR): Doc[] {
  const dir = new URL(`${lang}/`, root)
  const files: Record<string, string> = {}
  for (const name of readdirSync(dir)) {
    if (/^\d{2}-[\w-]+\.md$/.test(name)) files[name] = readFileSync(new URL(name, dir), 'utf8')
  }
  return buildDocs(files, lang)
}

export const readAllDocs = (root?: URL): DocsByLang => ({
  en: readDocs('en', root),
  es: readDocs('es', root),
})

/** Las URLs de una página en cada idioma (sin clave, la portada). */
const alternatesOf = (site: string, key?: Doc['key']): Record<DocLang, string> => {
  const paths = docAlternates(key)
  return { en: `${site}${paths.en}`, es: `${site}${paths.es}` }
}

export function robotsTxt(site = SITE_URL): string {
  return [
    '# Generado en el build (vite/seo.ts). Lo público es la entrada (/login) y la documentación;',
    '# el resto pide sesión y redirige a /login.',
    'User-agent: *',
    ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n')
}

/**
 * Lo que ve alguien sin sesión: la entrada y, en los dos idiomas, la portada de la documentación y cada guía, con sus
 * alternativas (`hreflang`, con `x-default` en inglés), como pide Google.
 */
export function sitemapXml(docs: DocsByLang, site = SITE_URL): string {
  const alt = (urls: Record<DocLang, string>) =>
    [...DOC_LANGS.map((l) => [l, urls[l]] as const), ['x-default', urls.en] as const]
      .map(([l, u]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${escapeHtml(u)}"/>`)
      .join('')
  const pages = [alternatesOf(site), ...docs.en.map((d) => alternatesOf(site, d.key))]
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Generado en el build (vite/seo.ts). -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    `  <url><loc>${escapeHtml(`${site}/login`)}</loc></url>`,
    ...pages.flatMap((p) =>
      DOC_LANGS.map((l) => `  <url><loc>${escapeHtml(p[l])}</loc>${alt(p)}</url>`),
    ),
    '</urlset>',
    '',
  ].join('\n')
}

/**
 * El Markdown de una guía en HTML, con los mismos ids de título que la app y los enlaces entre guías resueltos entre
 * `docs`, las de su idioma.
 */
export function docHtml(body: string, docs: Doc[]): string {
  const slug = makeSlugger()
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }: Tokens.Heading) {
        const id = slug(plainText(text, 200))
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`
      },
      link({ href, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens)
        if (href.startsWith('#'))
          return `<a href="#${slugify(decodeURIComponent(href.slice(1)))}">${inner}</a>`
        const target = linkedDoc(docs, href)
        if (target) {
          const hash = target.hash ? `#${slugify(decodeURIComponent(target.hash))}` : ''
          return `<a href="${docPath(target.doc.lang, target.doc.slug)}${hash}">${inner}</a>`
        }
        return `<a href="${escapeHtml(href)}" rel="noopener">${inner}</a>`
      },
    },
  })
  return marked.parse(body, { async: false })
}

export interface PageSeo {
  /** Sin « · Muninn»: se añade aquí. */
  title: string
  description: string
  url: string
  lang: DocLang
  /** La URL de la misma página en cada idioma (`hreflang`). */
  alternates: Record<DocLang, string>
  /** Lo que va dentro de `#root` hasta que React pinta encima. */
  content: string
  /** Datos estructurados (schema.org) de la página. */
  structured: unknown[]
}

/** Cambia el `content` de una meta (`name` o `property`) del HTML, esté en una línea o en varias. */
function setMeta(html: string, key: string, value: string): string {
  const re = new RegExp(`(<meta\\s+(?:name|property)="${key}"\\s+content=")[^"]*(")`)
  if (!re.test(html)) throw new Error(`index.html no tiene la meta ${key}`)
  return html.replace(re, `$1${escapeHtml(value)}$2`)
}

/**
 * Un HTML prerenderizado a partir del `index.html` del build: idioma, título, descripción, tarjeta, canónica,
 * alternativas por idioma y datos estructurados propios, y el texto de la página ya dentro de `#root`. React lo
 * sustituye al arrancar.
 */
export function pageHtml(template: string, page: PageSeo): string {
  const full = `${page.title} · Muninn`
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(full)}</title>`)
  html = html.replace(/<html lang="[^"]*">/, `<html lang="${page.lang}">`)
  html = setMeta(html, 'description', page.description)
  html = setMeta(html, 'og:type', 'article')
  html = setMeta(html, 'og:url', page.url)
  html = setMeta(html, 'og:title', full)
  html = setMeta(html, 'og:description', page.description)
  html = setMeta(html, 'og:locale', OG_LOCALE[page.lang])
  html = setMeta(html, 'og:locale:alternate', OG_LOCALE[otherDocLang(page.lang)])
  html = setMeta(html, 'twitter:title', full)
  html = setMeta(html, 'twitter:description', page.description)
  html = html.replace(
    /<noscript>[\s\S]*?<\/noscript>/,
    `<noscript>\n      <p>${escapeHtml(TEXT[page.lang].noscript)}</p>\n    </noscript>`,
  )
  const head = [
    `<link rel="canonical" href="${escapeHtml(page.url)}" />`,
    ...DOC_LANGS.map(
      (l) => `<link rel="alternate" hreflang="${l}" href="${escapeHtml(page.alternates[l])}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(page.alternates.en)}" />`,
    ...page.structured.map(jsonLd),
    // Mientras llega el JavaScript: texto legible con los colores del tema, no la hoja pelada de Tailwind.
    `<style>.prerender{max-width:760px;margin:0 auto;padding:40px 20px 64px;line-height:1.65;color:var(--color-fg-muted)}.prerender :is(h1,h2,h3){color:var(--color-fg);font-weight:600;line-height:1.25;margin:1.6em 0 .5em}.prerender h1{font-size:2rem;margin-top:0}.prerender h2{font-size:1.4rem}.prerender h3{font-size:1.15rem}.prerender :is(p,ul,ol,blockquote,table){margin:.75em 0}.prerender :is(ul,ol){padding-left:1.4em;list-style:revert}.prerender a{color:var(--color-accent)}.prerender code{font-family:var(--font-mono,monospace)}</style>`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${head}\n  </head>`)
  const root = /<div id="root"><\/div>/
  if (!root.test(html)) throw new Error('index.html no tiene <div id="root"></div>')
  return html.replace(root, `<div id="root"><main class="prerender">${page.content}</main></div>`)
}

const breadcrumbs = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    item: it.url,
  })),
})

/** La página de una guía; `docs` son las de su idioma, para resolver los enlaces entre guías. */
export function docPage(doc: Doc, docs: Doc[], site = SITE_URL): PageSeo {
  const lang = doc.lang
  const url = `${site}${docPath(lang, doc.slug)}`
  const home = `${site}${docPath(lang)}`
  const description = doc.description || plainText(doc.body, 155)
  return {
    title: doc.title,
    description,
    url,
    lang,
    alternates: alternatesOf(site, doc.key),
    content: `<nav><a href="${docPath(lang)}">${TEXT[lang].docs}</a> › ${escapeHtml(groupLabel(doc.group, lang))}</nav>\n<h1>${escapeHtml(doc.title)}</h1>\n<p>${escapeHtml(description)}</p>\n${docHtml(doc.body, docs)}`,
    structured: [
      {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: doc.title,
        description,
        url,
        inLanguage: lang,
        timeRequired: `PT${doc.minutes}M`,
        isPartOf: { '@type': 'WebSite', name: 'Muninn', url: site },
        publisher: { '@type': 'Organization', name: 'Muninn', url: site },
      },
      breadcrumbs([
        { name: TEXT[lang].docs, url: home },
        { name: doc.title, url },
      ]),
    ],
  }
}

/** La portada de la documentación en un idioma: las guías por grupo, con su descripción. */
export function docsIndexPage(docs: Doc[], lang: DocLang, site = SITE_URL): PageSeo {
  const groups = groupDocs(docs)
    .map(
      (g) =>
        `<h2>${escapeHtml(g.label[lang])}</h2>\n<ul>\n${g.docs
          .map(
            (d) =>
              `<li><a href="${docPath(lang, d.slug)}">${escapeHtml(d.title)}</a>${d.description ? ` — ${escapeHtml(d.description)}` : ''}</li>`,
          )
          .join('\n')}\n</ul>`,
    )
    .join('\n')
  const url = `${site}${docPath(lang)}`
  return {
    title: TEXT[lang].docs,
    description: TEXT[lang].indexDescription,
    url,
    lang,
    alternates: alternatesOf(site),
    content: `<h1>${TEXT[lang].docsTitle}</h1>\n${groups}`,
    structured: [breadcrumbs([{ name: TEXT[lang].docs, url }])],
  }
}

/**
 * Plugin de Vite: `%SITE_URL%` en `index.html` y, al terminar el build, `robots.txt`, `sitemap.xml`, un
 * `docs/<guía>/index.html` y un `es/docs/<guía>/index.html` por guía, y `404.html` (la app con `noindex`).
 * `enabled: false` (escritorio) solo sustituye la URL.
 */
export function seo({ enabled }: { enabled: boolean }): Plugin {
  let outDir = 'dist'
  return {
    name: 'muninn:seo',
    configResolved(config) {
      outDir = config.build.outDir
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
    },
    closeBundle() {
      if (!enabled) return
      const template = readFileSync(join(outDir, 'index.html'), 'utf8')
      const docs = readAllDocs()
      writeFileSync(join(outDir, 'robots.txt'), robotsTxt())
      writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml(docs))
      const write = (path: string, page: PageSeo) => {
        mkdirSync(join(outDir, path), { recursive: true })
        writeFileSync(join(outDir, path, 'index.html'), pageHtml(template, page))
      }
      for (const lang of DOC_LANGS) {
        const dir = docPath(lang).slice(1)
        write(dir, docsIndexPage(docs[lang], lang))
        for (const doc of docs[lang]) write(join(dir, doc.slug), docPage(doc, docs[lang]))
      }
      // Lo que no existe responde 404 (no un 200 con la app): Vercel sirve este fichero.
      writeFileSync(
        join(outDir, '404.html'),
        template.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>'),
      )
    },
  }
}
