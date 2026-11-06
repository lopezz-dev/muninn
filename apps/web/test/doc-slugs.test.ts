import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DOC_LANGS,
  DOC_SLUGS,
  type DocKey,
  docAlternates,
  docKeyOf,
  docLangFor,
  docLangOf,
  docPath,
  docSlug,
  isDocsPath,
  translatedDocPath,
} from '../src/lib/doc-slugs'
import { sectionOf } from '../src/shell/nav'

describe('doc-slugs', () => {
  it('coincide con los ficheros de docs/user en cada idioma', () => {
    for (const lang of DOC_LANGS) {
      const files = readdirSync(new URL(`../../../docs/user/${lang}/`, import.meta.url))
        .filter((f) => /^\d{2}-/.test(f))
        .sort()
      const expected = (Object.keys(DOC_SLUGS) as DocKey[])
        .map((k) => `${DOC_SLUGS[k].n}-${docSlug(k, lang)}.md`)
        .sort()
      expect(files, lang).toEqual(expected)
    }
  })

  it('rutas: inglés sin prefijo y español con /es', () => {
    expect(docPath('en')).toBe('/docs')
    expect(docPath('es', 'notas')).toBe('/es/docs/notas')
    expect(docAlternates('notes')).toEqual({ en: '/docs/notes', es: '/es/docs/notas' })
    expect(docAlternates()).toEqual({ en: '/docs', es: '/es/docs' })
  })

  it('sabe el idioma de una ruta y si es de la documentación', () => {
    expect(docLangOf('/es/docs/notas')).toBe('es')
    expect(docLangOf('/es/docs')).toBe('es')
    expect(docLangOf('/docs/notes')).toBe('en')
    expect(isDocsPath('/docs')).toBe(true)
    expect(isDocsPath('/es/docs/notas')).toBe(true)
    expect(isDocsPath('/docsx')).toBe(false)
    expect(isDocsPath('/es/otra')).toBe(false)
    expect(sectionOf('/es/docs/notas')).toBe('docs')
    expect(sectionOf('/docs')).toBe('docs')
  })

  it('traduce una guía al otro idioma', () => {
    expect(translatedDocPath('en', 'getting-around')).toBe('/es/docs/moverte-por-muninn')
    expect(translatedDocPath('es', 'notas')).toBe('/docs/notes')
    expect(translatedDocPath('es')).toBe('/docs')
    expect(translatedDocPath('en', 'no-existe')).toBe('/es/docs')
    expect(docKeyOf('notas', 'en')).toBeUndefined()
  })

  it('el idioma de la ayuda sigue al de la interfaz', () => {
    expect(docLangFor('es')).toBe('es')
    expect(docLangFor('es-ES')).toBe('es')
    expect(docLangFor('en')).toBe('en')
    expect(docLangFor(undefined)).toBe('en')
  })
})
