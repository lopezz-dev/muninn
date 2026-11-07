import { useEffect } from 'react'
import { type DocLang, OG_LOCALE } from './doc-slugs'

/**
 * Título, descripción y URL canónica de una página pública (login, guías). `index.html` trae los valores de
 * toda la app; aquí se cambian mientras la página está abierta y se devuelven al salir. Los buscadores que
 * ejecutan JavaScript (Google) leen estos; los que no, solo ven los de `index.html`.
 */
export interface PageMeta {
  /** Sin « · Muninn»: se añade aquí. */
  title: string
  /** Sin ella se queda la de `index.html`. */
  description?: string
  /** Idioma del contenido (ADR-0077): `<html lang>` y `og:locale`. */
  lang?: DocLang
  /** Rutas de la misma página en cada idioma: `<link rel="alternate" hreflang>`, con `x-default` en inglés. */
  alternates?: Record<DocLang, string>
}

function metaTag(doc: Document, attr: 'name' | 'property', key: string) {
  let el = doc.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = doc.createElement('meta')
    el.setAttribute(attr, key)
    doc.head.append(el)
  }
  return el
}

function link(doc: Document, rel: string, href: string, hreflang?: string) {
  const el = doc.createElement('link')
  el.rel = rel
  el.href = href
  if (hreflang) el.hreflang = hreflang
  doc.head.append(el)
  return el
}

/** Aplica las metas de la página y devuelve cómo deshacerlo. La canónica es la ruta sin `?…` ni `#…`. */
export function applyPageMeta(
  doc: Document,
  { title, description, lang, alternates }: PageMeta,
): () => void {
  const loc = doc.location
  const url = `${loc.origin}${loc.pathname}`
  const full = `${title} · Muninn`
  const tags = [
    metaTag(doc, 'name', 'description'),
    metaTag(doc, 'property', 'og:title'),
    metaTag(doc, 'property', 'og:description'),
    metaTag(doc, 'property', 'og:url'),
    metaTag(doc, 'name', 'twitter:title'),
    metaTag(doc, 'name', 'twitter:description'),
    metaTag(doc, 'property', 'og:locale'),
  ] as const
  const before = {
    title: doc.title,
    lang: doc.documentElement.lang,
    contents: tags.map((t) => t.content),
  }
  const [desc, ogTitle, ogDesc, ogUrl, twTitle, twDesc, ogLocale] = tags
  const text = description || desc.content

  doc.title = full
  desc.content = text
  ogTitle.content = full
  ogDesc.content = text
  ogUrl.content = url
  twTitle.content = full
  twDesc.content = text
  if (lang) {
    doc.documentElement.lang = lang
    ogLocale.content = OG_LOCALE[lang]
  }
  // La guía prerenderizada (ADR-0076) ya trae las suyas en el HTML: una sola canónica y un juego de alternativas.
  for (const old of doc.head.querySelectorAll(
    'link[rel="canonical"], link[rel="alternate"][hreflang]',
  ))
    old.remove()
  const added = [link(doc, 'canonical', url)]
  if (alternates) {
    added.push(
      link(doc, 'alternate', `${loc.origin}${alternates.en}`, 'en'),
      link(doc, 'alternate', `${loc.origin}${alternates.es}`, 'es'),
      link(doc, 'alternate', `${loc.origin}${alternates.en}`, 'x-default'),
    )
  }

  return () => {
    // El título lo pone la siguiente pantalla; solo se devuelve si nadie lo ha cambiado.
    if (doc.title === full) doc.title = before.title
    doc.documentElement.lang = before.lang
    tags.forEach((t, i) => {
      t.content = before.contents[i] ?? ''
    })
    for (const el of added) el.remove()
  }
}

/** `applyPageMeta` mientras el componente está montado. */
export function usePageMeta({ title, description, lang, alternates }: PageMeta) {
  const en = alternates?.en
  const es = alternates?.es
  useEffect(
    () =>
      applyPageMeta(document, {
        title,
        description,
        lang,
        alternates: en && es ? { en, es } : undefined,
      }),
    [title, description, lang, en, es],
  )
}

/** Pide a los buscadores que no indexen la página mientras está abierta (rutas que no existen). */
export function applyNoIndex(doc: Document): () => void {
  const robots = doc.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex'
  doc.head.append(robots)
  return () => robots.remove()
}

/** `applyNoIndex` mientras el componente está montado. */
export function useNoIndex() {
  useEffect(() => applyNoIndex(document), [])
}
