/**
 * Fuentes sugeridas de Noticias: RSS oficiales, publicados por el propio medio, organismo o empresa (no agregadores
 * ni feeds hechos por terceros). Comprobadas el 27-10-2026: responden 200 y son RSS o Atom con artículos. El tema de
 * cada grupo se guarda como `topic` de la fuente, así salen como pestaña en Noticias.
 *
 * Para añadir una: que sea el feed oficial, que responda con `<rss>` o `<feed>` y que esté vivo (artículos recientes).
 */

export interface CatalogSource {
  url: string
  title: string
  /** Una línea: qué trae. */
  about: string
}

export interface CatalogGroup {
  /** También es el tema con el que se guarda. */
  topic: string
  sources: CatalogSource[]
}

export const NEWS_CATALOG: CatalogGroup[] = [
  {
    topic: 'Actualidad',
    sources: [
      {
        url: 'https://api2.rtve.es/rss/temas_noticias.xml',
        title: 'RTVE Noticias',
        about: 'Última hora de la radiotelevisión pública',
      },
      {
        url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
        title: 'El País',
        about: 'Portada',
      },
      {
        url: 'https://www.europapress.es/rss/rss.aspx',
        title: 'Europa Press',
        about: 'Agencia de noticias: lo último',
      },
      { url: 'https://www.eldiario.es/rss/', title: 'elDiario.es', about: 'Portada' },
      { url: 'https://www.20minutos.es/rss/', title: '20minutos', about: 'Portada' },
      {
        url: 'https://feeds.bbci.co.uk/mundo/rss.xml',
        title: 'BBC News Mundo',
        about: 'Internacional, en español',
      },
    ],
  },
  {
    topic: 'Instituciones',
    sources: [
      {
        url: 'https://www.boe.es/rss/boe.php',
        title: 'BOE',
        about: 'Sumario diario del Boletín Oficial del Estado',
      },
      {
        url: 'https://www.lamoncloa.gob.es/Paginas/rss.aspx',
        title: 'La Moncloa',
        about: 'Notas de prensa del Gobierno de España',
      },
      {
        url: 'https://www.bde.es/wbe/es/inicio/rss/rss-noticias/',
        title: 'Banco de España',
        about: 'Notas de prensa y publicaciones',
      },
      {
        url: 'https://www.who.int/rss-feeds/news-english.xml',
        title: 'OMS (WHO)',
        about: 'Noticias de la Organización Mundial de la Salud, en inglés',
      },
    ],
  },
  {
    topic: 'Economía',
    sources: [
      {
        url: 'https://e00-expansion.uecdn.es/rss/portada.xml',
        title: 'Expansión',
        about: 'Portada: mercados, empresas y economía',
      },
    ],
  },
  {
    topic: 'Tecnología',
    sources: [
      {
        url: 'https://www.xataka.com/feedburner.xml',
        title: 'Xataka',
        about: 'Tecnología en español',
      },
      {
        url: 'https://www.genbeta.com/feedburner.xml',
        title: 'Genbeta',
        about: 'Software e internet',
      },
      {
        url: 'https://www.theverge.com/rss/index.xml',
        title: 'The Verge',
        about: 'Tecnología y cultura digital, en inglés',
      },
      {
        url: 'https://www.apple.com/newsroom/rss-feed.rss',
        title: 'Apple Newsroom',
        about: 'Anuncios oficiales de Apple',
      },
      {
        url: 'https://blog.cloudflare.com/rss/',
        title: 'Blog de Cloudflare',
        about: 'Redes, seguridad e infraestructura',
      },
    ],
  },
  {
    topic: 'IA',
    sources: [
      { url: 'https://openai.com/news/rss.xml', title: 'OpenAI', about: 'Noticias y lanzamientos' },
      {
        url: 'https://blog.google/technology/ai/rss/',
        title: 'Google AI',
        about: 'IA en el blog oficial de Google',
      },
      {
        url: 'https://huggingface.co/blog/feed.xml',
        title: 'Hugging Face',
        about: 'Modelos abiertos y herramientas',
      },
    ],
  },
  {
    topic: 'Desarrollo',
    sources: [
      { url: 'https://github.blog/feed/', title: 'Blog de GitHub', about: 'Novedades y guías' },
      {
        url: 'https://github.blog/changelog/feed/',
        title: 'GitHub Changelog',
        about: 'Cada cambio del producto',
      },
      { url: 'https://vercel.com/atom', title: 'Vercel', about: 'Blog y changelog' },
      { url: 'https://supabase.com/rss.xml', title: 'Supabase', about: 'Blog oficial' },
      { url: 'https://react.dev/rss.xml', title: 'React', about: 'Blog oficial de React' },
      { url: 'https://nodejs.org/en/feed/blog.xml', title: 'Node.js', about: 'Versiones y avisos' },
      {
        url: 'https://devblogs.microsoft.com/typescript/feed/',
        title: 'TypeScript',
        about: 'Blog oficial del equipo de TypeScript',
      },
      { url: 'https://blog.rust-lang.org/feed.xml', title: 'Rust', about: 'Blog oficial de Rust' },
      {
        url: 'https://developer.apple.com/news/rss/news.rss',
        title: 'Apple Developer',
        about: 'Noticias para desarrolladores de Apple',
      },
    ],
  },
  {
    topic: 'Ciencia',
    sources: [
      { url: 'https://www.nasa.gov/news-release/feed/', title: 'NASA', about: 'Notas de prensa' },
      {
        url: 'https://www.esa.int/rssfeed/Our_Activities/Space_News',
        title: 'ESA',
        about: 'Agencia Espacial Europea',
      },
      {
        url: 'https://www.sciencedaily.com/rss/top.xml',
        title: 'ScienceDaily',
        about: 'Lo más destacado de la investigación, en inglés',
      },
    ],
  },
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
