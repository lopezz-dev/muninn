// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyPageMeta } from '../src/lib/seo'

const meta = (sel: string) => document.head.querySelector<HTMLMetaElement>(sel)?.content
const canonicals = () => document.head.querySelectorAll('link[rel="canonical"]')

describe('applyPageMeta', () => {
  beforeEach(() => {
    // `innerHTML` también se lleva el <title>: el título va después.
    document.head.innerHTML =
      '<meta name="description" content="General"><meta property="og:title" content="Muninn">'
    document.title = 'Muninn · Tu sistema operativo personal'
    history.replaceState(null, '', '/documentacion/notas?q=x#archivar')
  })

  it('pone título, descripción y canónica sin búsqueda ni ancla', () => {
    applyPageMeta(document, { title: 'Notas', description: 'Apuntes en Markdown.' })
    expect(document.title).toBe('Notas · Muninn')
    expect(meta('meta[name="description"]')).toBe('Apuntes en Markdown.')
    expect(meta('meta[property="og:title"]')).toBe('Notas · Muninn')
    expect(meta('meta[name="twitter:description"]')).toBe('Apuntes en Markdown.')
    const url = `${location.origin}/documentacion/notas`
    expect(meta('meta[property="og:url"]')).toBe(url)
    expect(canonicals()).toHaveLength(1)
    expect((canonicals()[0] as HTMLLinkElement).href).toBe(url)
  })

  it('sin descripción, se queda la general', () => {
    applyPageMeta(document, { title: 'Iniciar sesión' })
    expect(meta('meta[name="description"]')).toBe('General')
    expect(meta('meta[property="og:description"]')).toBe('General')
  })

  it('al salir lo deja como estaba, sin pisar el título de la pantalla siguiente', () => {
    const undo = applyPageMeta(document, { title: 'Notas', description: 'Apuntes.' })
    undo()
    expect(document.title).toBe('Muninn · Tu sistema operativo personal')
    expect(meta('meta[name="description"]')).toBe('General')
    expect(meta('meta[property="og:title"]')).toBe('Muninn')
    expect(canonicals()).toHaveLength(0)

    const again = applyPageMeta(document, { title: 'Notas' })
    document.title = 'Proyectos · Muninn'
    again()
    expect(document.title).toBe('Proyectos · Muninn')
  })
})
