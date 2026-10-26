import { useEffect } from 'react'

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

/** Aplica las metas de la página y devuelve cómo deshacerlo. La canónica es la ruta sin `?…` ni `#…`. */
export function applyPageMeta(doc: Document, { title, description }: PageMeta): () => void {
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
  ] as const
  const before = { title: doc.title, contents: tags.map((t) => t.content) }
  const [desc, ogTitle, ogDesc, ogUrl, twTitle, twDesc] = tags
  const text = description || desc.content

  doc.title = full
  desc.content = text
  ogTitle.content = full
  ogDesc.content = text
  ogUrl.content = url
  twTitle.content = full
  twDesc.content = text
  const canonical = doc.createElement('link')
  canonical.rel = 'canonical'
  canonical.href = url
  doc.head.append(canonical)

  return () => {
    // El título lo pone la siguiente pantalla; solo se devuelve si nadie lo ha cambiado.
    if (doc.title === full) doc.title = before.title
    tags.forEach((t, i) => {
      t.content = before.contents[i] ?? ''
    })
    canonical.remove()
  }
}

/** `applyPageMeta` mientras el componente está montado. */
export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => applyPageMeta(document, { title, description }), [title, description])
}
