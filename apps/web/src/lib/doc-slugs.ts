/**
 * Las guías por idioma (ADR-0077, fase 4), sin su texto: lo que necesita quien enlaza a una guía (Ajustes, el
 * Asistente, GitHub…) sin cargar las guías. La clave de cada guía es su slug en inglés; el número es el prefijo del
 * fichero (`docs/user/<idioma>/NN-slug.md`), el mismo en los dos idiomas, y es lo que empareja una guía con su
 * traducción. `test/doc-slugs.test.ts` comprueba que esto coincide con los ficheros.
 */

export type DocLang = 'en' | 'es'

export const DOC_LANGS: DocLang[] = ['en', 'es']

export const DOC_SLUGS = {
  welcome: { n: '01', es: 'bienvenida' },
  installation: { n: '02', es: 'instalacion' },
  'projects-and-board': { n: '03', es: 'proyectos-y-tablero' },
  tasks: { n: '04', es: 'tareas' },
  notes: { n: '05', es: 'notas' },
  'ai-assistants': { n: '06', es: 'asistentes-ia' },
  'data-and-privacy': { n: '07', es: 'datos-y-privacidad' },
  'getting-around': { n: '08', es: 'moverte-por-muninn' },
  github: { n: '09', es: 'github' },
  finance: { n: '10', es: 'finanzas' },
  assistant: { n: '11', es: 'asistente' },
  news: { n: '12', es: 'noticias' },
  notifications: { n: '13', es: 'notificaciones' },
  'account-and-security': { n: '14', es: 'cuenta-y-seguridad' },
} as const

export type DocKey = keyof typeof DOC_SLUGS

const KEYS = Object.keys(DOC_SLUGS) as DocKey[]

/** El slug de una guía en un idioma. */
export const docSlug = (key: DocKey, lang: DocLang): string =>
  lang === 'en' ? key : DOC_SLUGS[key].es

/** La clave de una guía a partir de su slug en un idioma; `undefined` si no hay ninguna. */
export const docKeyOf = (slug: string, lang: DocLang): DocKey | undefined =>
  KEYS.find((k) => docSlug(k, lang) === slug)

/** La clave de una guía a partir del número de su fichero (`05`). */
export const docKeyByNumber = (n: string): DocKey | undefined =>
  KEYS.find((k) => DOC_SLUGS[k].n === n)

/** Ruta de la portada (sin `slug`) o de una guía: el inglés sin prefijo y el español con `/es`. */
export const docPath = (lang: DocLang, slug?: string): string =>
  `${lang === 'es' ? '/es' : ''}/docs${slug ? `/${slug}` : ''}`

/** El idioma de una ruta de la documentación (`/es/docs/…` → `es`); el resto, inglés. */
export const docLangOf = (pathname: string): DocLang =>
  /^\/es\/docs(?:\/|$)/.test(pathname) ? 'es' : 'en'

/** ¿Es una ruta de la documentación, en cualquier idioma? Es pública (ADR-0076). */
export const isDocsPath = (pathname: string): boolean => /^(?:\/es)?\/docs(?:\/|$)/.test(pathname)

/** El otro idioma. */
export const otherDocLang = (lang: DocLang): DocLang => (lang === 'es' ? 'en' : 'es')

/** El idioma de las guías para un idioma de la interfaz (`es-ES` → `es`; cualquier otro, inglés). */
export const docLangFor = (locale: string | undefined): DocLang =>
  locale?.toLowerCase().startsWith('es') ? 'es' : 'en'

/** Las rutas de una guía (o, sin clave, de la portada) en cada idioma, para los `hreflang`. */
export const docAlternates = (key?: DocKey): Record<DocLang, string> => ({
  en: docPath('en', key && docSlug(key, 'en')),
  es: docPath('es', key && docSlug(key, 'es')),
})

/** `og:locale` de cada idioma. */
export const OG_LOCALE: Record<DocLang, string> = { en: 'en_US', es: 'es_ES' }

/**
 * La misma página en el otro idioma: la portada o la guía traducida. Una guía que no existe va a la portada.
 * `slug` es el de `from`.
 */
export function translatedDocPath(from: DocLang, slug?: string): string {
  const to = otherDocLang(from)
  if (!slug) return docPath(to)
  const key = docKeyOf(slug, from)
  return docPath(to, key ? docSlug(key, to) : undefined)
}
