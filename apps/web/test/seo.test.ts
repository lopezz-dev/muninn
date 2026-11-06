// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyNoIndex, applyPageMeta } from '../src/lib/seo'

const meta = (sel: string) => document.head.querySelector<HTMLMetaElement>(sel)?.content
const canonicals = () => document.head.querySelectorAll('link[rel="canonical"]')

describe('applyPageMeta', () => {
  beforeEach(() => {
    // `innerHTML` también se lleva el <title>: el título va después.
    document.head.innerHTML =
      '<meta name="description" content="General"><meta property="og:title" content="Muninn">'
    document.title = 'Muninn · Tu sistema operativo personal'
    history.replaceState(null, '', '/docs/notas?q=x#archivar')
  })

  it('pone título, descripción y canónica sin búsqueda ni ancla', () => {
    applyPageMeta(document, { title: 'Notas', description: 'Apuntes en Markdown.' })
    expect(document.title).toBe('Notas · Muninn')
    expect(meta('meta[name="description"]')).toBe('Apuntes en Markdown.')
    expect(meta('meta[property="og:title"]')).toBe('Notas · Muninn')
    expect(meta('meta[name="twitter:description"]')).toBe('Apuntes en Markdown.')
    const url = `${location.origin}/docs/notas`
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

describe('applyNoIndex', () => {
  it('pone robots=noindex y lo quita al salir', () => {
    const undo = applyNoIndex(document)
    expect(meta('meta[name="robots"]')).toBe('noindex')
    undo()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })
})

describe('applyPageMeta en una página prerenderizada', () => {
  it('sustituye la canónica que ya traía el HTML', () => {
    document.head.innerHTML = '<link rel="canonical" href="https://muninn.test/docs/notas">'
    history.replaceState(null, '', '/docs/tareas')
    applyPageMeta(document, { title: 'Tareas' })
    expect(canonicals()).toHaveLength(1)
    expect((canonicals()[0] as HTMLLinkElement).href).toBe(`${location.origin}/docs/tareas`)
  })
})
