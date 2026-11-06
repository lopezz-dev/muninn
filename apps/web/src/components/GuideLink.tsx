import { Link } from '@tanstack/react-router'
import type { MouseEventHandler, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type DocKey, type DocLang, docLangFor, docSlug } from '../lib/doc-slugs'

/** Un apartado de la guía, que cambia con el idioma (el id sale del título traducido). */
export type GuideHash = string | { en: string; es: string }

export interface GuideLinkProps {
  /** La guía, por su clave de `lib/doc-slugs.ts`. */
  doc: DocKey
  hash?: GuideHash
  /** Sin él, el idioma de la interfaz. */
  lang?: DocLang
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  children: ReactNode
}

const hashFor = (hash: GuideHash | undefined, lang: DocLang) =>
  typeof hash === 'string' ? hash : hash?.[lang]

/**
 * Enlace a una guía de la ayuda desde cualquier pantalla (ADR-0077): la abre en el idioma de la interfaz
 * (`/docs/…` o `/es/docs/…`) sin cargar el texto de las guías.
 */
export function GuideLink({ doc, hash, lang, className, onClick, children }: GuideLinkProps) {
  const { i18n } = useTranslation()
  const l = lang ?? docLangFor(i18n.resolvedLanguage)
  return (
    <Link
      to={l === 'es' ? '/es/docs/$pagina' : '/docs/$pagina'}
      params={{ pagina: docSlug(doc, l) }}
      hash={hashFor(hash, l)}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

/** Enlace a la portada de la ayuda en el idioma de la interfaz. */
export function GuidesLink({
  className,
  onClick,
  children,
}: Pick<GuideLinkProps, 'className' | 'onClick' | 'children'>) {
  const { i18n } = useTranslation()
  const es = docLangFor(i18n.resolvedLanguage) === 'es'
  return (
    <Link to={es ? '/es/docs' : '/docs'} className={className} onClick={onClick}>
      {children}
    </Link>
  )
}
