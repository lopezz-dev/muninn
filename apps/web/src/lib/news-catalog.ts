/**
 * Fuentes sugeridas de Noticias: RSS oficiales, publicados por el propio medio, organismo o empresa (no agregadores
 * ni feeds hechos por terceros). Comprobadas el 27-10-2026: responden 200 y son RSS o Atom con artículos. El nombre de
 * cada grupo, en el idioma de la interfaz (`label`), se guarda como `topic` de la fuente, así sale como pestaña en
 * Noticias (ADR-0077). `topic` es solo su identificador.
 *
 * Para añadir una: que sea el feed oficial, que responda con `<rss>` o `<feed>` y que esté vivo (artículos recientes).
 */

import { t } from '../i18n'
import type { news as en } from '../i18n/locales/en/news'

type CatalogMessages = typeof en.catalog

export interface CatalogSource {
  url: string
  /** Nombre propio de la fuente: no se traduce. */
  title: string
  /** Una línea: qué trae (en el idioma activo). */
  about: string
}

export interface CatalogGroup {
  /** También es el tema con el que se guarda: un valor, no se traduce. */
  topic: string
  /** El tema tal como se enseña, en el idioma activo. */
  label: string
  sources: CatalogSource[]
}

/** Una fuente; `about` es un *getter*: se lee al pintar, en el idioma activo (ADR-0077). */
const src = (key: keyof CatalogMessages['about'], url: string, title: string): CatalogSource => ({
  url,
  title,
  get about() {
    return t(`catalog.about.${key}`, { ns: 'news' })
  },
})

const group = (
  key: keyof CatalogMessages['topics'],
  topic: string,
  sources: CatalogSource[],
): CatalogGroup => ({
  topic,
  get label() {
    return t(`catalog.topics.${key}`, { ns: 'news' })
  },
  sources,
})

export const NEWS_CATALOG: CatalogGroup[] = [
  group('actualidad', 'Actualidad', [
    src('rtve', 'https://api2.rtve.es/rss/temas_noticias.xml', 'RTVE Noticias'),
    src('elpais', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', 'El País'),
    src('europapress', 'https://www.europapress.es/rss/rss.aspx', 'Europa Press'),
    src('eldiario', 'https://www.eldiario.es/rss/', 'elDiario.es'),
    src('veinteminutos', 'https://www.20minutos.es/rss/', '20minutos'),
    src('bbcMundo', 'https://feeds.bbci.co.uk/mundo/rss.xml', 'BBC News Mundo'),
  ]),
  group('instituciones', 'Instituciones', [
    src('boe', 'https://www.boe.es/rss/boe.php', 'BOE'),
    src('moncloa', 'https://www.lamoncloa.gob.es/Paginas/rss.aspx', 'La Moncloa'),
    src('bde', 'https://www.bde.es/wbe/es/inicio/rss/rss-noticias/', 'Banco de España'),
    src('who', 'https://www.who.int/rss-feeds/news-english.xml', 'OMS (WHO)'),
  ]),
  group('economia', 'Economía', [
    src('expansion', 'https://e00-expansion.uecdn.es/rss/portada.xml', 'Expansión'),
  ]),
  group('tecnologia', 'Tecnología', [
    src('xataka', 'https://www.xataka.com/feedburner.xml', 'Xataka'),
    src('genbeta', 'https://www.genbeta.com/feedburner.xml', 'Genbeta'),
    src('verge', 'https://www.theverge.com/rss/index.xml', 'The Verge'),
    src('apple', 'https://www.apple.com/newsroom/rss-feed.rss', 'Apple Newsroom'),
    src('cloudflare', 'https://blog.cloudflare.com/rss/', 'Blog de Cloudflare'),
  ]),
  group('ia', 'IA', [
    src('openai', 'https://openai.com/news/rss.xml', 'OpenAI'),
    src('googleAi', 'https://blog.google/technology/ai/rss/', 'Google AI'),
    src('huggingface', 'https://huggingface.co/blog/feed.xml', 'Hugging Face'),
  ]),
  group('desarrollo', 'Desarrollo', [
    src('githubBlog', 'https://github.blog/feed/', 'Blog de GitHub'),
    src('githubChangelog', 'https://github.blog/changelog/feed/', 'GitHub Changelog'),
    src('vercel', 'https://vercel.com/atom', 'Vercel'),
    src('supabase', 'https://supabase.com/rss.xml', 'Supabase'),
    src('react', 'https://react.dev/rss.xml', 'React'),
    src('node', 'https://nodejs.org/en/feed/blog.xml', 'Node.js'),
    src('typescript', 'https://devblogs.microsoft.com/typescript/feed/', 'TypeScript'),
    src('rust', 'https://blog.rust-lang.org/feed.xml', 'Rust'),
    src('appleDev', 'https://developer.apple.com/news/rss/news.rss', 'Apple Developer'),
  ]),
  group('ciencia', 'Ciencia', [
    src('nasa', 'https://www.nasa.gov/news-release/feed/', 'NASA'),
    src('esa', 'https://www.esa.int/rssfeed/Our_Activities/Space_News', 'ESA'),
    src('scienceDaily', 'https://www.sciencedaily.com/rss/top.xml', 'ScienceDaily'),
  ]),
]

/** La misma fuente aunque cambie `http`/`https`, `www.` o la barra final. */
export const sameFeed = (a: string, b: string) => {
  const norm = (u: string) =>
    u
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/+$/, '')
  return norm(a) === norm(b)
}
