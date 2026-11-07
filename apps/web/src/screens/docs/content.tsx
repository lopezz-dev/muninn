import { Link, useRouterState } from '@tanstack/react-router'
import type { MouseEventHandler, ReactNode } from 'react'
import { type DocLang, docLangOf } from '../../lib/doc-slugs'
import { buildDocs, type Doc } from '../../lib/docs'

/**
 * Las guías de `docs/user/<idioma>/*.md`, incluidas en el chunk de esta pantalla al compilar (no se piden por red:
 * funcionan sin conexión y siempre coinciden con la versión de la app). `README.md` no entra: solo los
 * ficheros `NN-nombre.md`.
 */
const en = import.meta.glob('../../../../../docs/user/en/[0-9][0-9]-*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const es = import.meta.glob('../../../../../docs/user/es/[0-9][0-9]-*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const DOCS: Record<DocLang, Doc[]> = { en: buildDocs(en, 'en'), es: buildDocs(es, 'es') }

/** El idioma de la documentación abierta: lo dice la URL (`/es/docs/…`), no el de la interfaz (ADR-0077). */
export const useDocLang = (): DocLang =>
  useRouterState({ select: (s) => docLangOf(s.location.pathname) })

/** Las guías del idioma de la URL. */
export const useDocs = (): Doc[] => DOCS[useDocLang()]

/** Enlace a una guía (o, sin `slug`, a la portada) en el idioma de la documentación abierta. */
export function DocRouteLink({
  lang,
  slug,
  hash,
  className,
  onClick,
  children,
}: {
  lang: DocLang
  slug?: string
  hash?: string
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  children: ReactNode
}) {
  if (!slug)
    return (
      <Link to={lang === 'es' ? '/es/docs' : '/docs'} className={className} onClick={onClick}>
        {children}
      </Link>
    )
  return (
    <Link
      to={lang === 'es' ? '/es/docs/$pagina' : '/docs/$pagina'}
      params={{ pagina: slug }}
      hash={hash}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}
