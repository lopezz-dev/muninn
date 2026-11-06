// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { noteExtensions } from '../src/screens/notas/rich/extensions'
import { leafText } from '../src/screens/notas/rich/raw-nodes'
import { NOTES_CORPUS } from './fixtures/notes-corpus'

const editorWith = (md: string) =>
  new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' })

const textOf = (e: Editor) =>
  e.state.doc.textBetween(0, e.state.doc.content.size, '\n', (n) => leafText(n))

describe('editor de notas: ida y vuelta de Markdown (ADR-0078)', () => {
  for (const [name, md] of Object.entries(NOTES_CORPUS)) {
    it(`${name}: parse → serialize → parse da el mismo documento`, () => {
      const a = editorWith(md)
      const out = a.getMarkdown()
      const b = editorWith(out)
      expect(b.getJSON()).toEqual(a.getJSON())
      // Y el texto que se lee no cambia.
      expect(textOf(b)).toBe(textOf(a))
      // Estable: guardar dos veces no sigue cambiando el texto.
      expect(b.getMarkdown()).toBe(out)
    })
  }

  it('las imágenes y el HTML se guardan tal cual, sin cargar nada', () => {
    const md = NOTES_CORPUS.rara as string
    const out = editorWith(md).getMarkdown()
    expect(out).toContain('![logo de prueba](https://example.com/logo.png "Título")')
    // El HTML en línea que el esquema entiende (`<b>`) pasa a su marca de Markdown; el resto, intacto.
    expect(out).toContain('**HTML en línea**')
    expect(out).toContain('<div align="center">\n  bloque <em>html</em>\n</div>')
    const dom = new DOMParser().parseFromString(editorWith(md).getHTML(), 'text/html')
    expect(dom.querySelector('img')).toBeNull()
    expect(dom.querySelector('[align], b, em')).toBeNull()
    expect(dom.querySelector('.md-raw-block')?.textContent).toContain('<div align="center">')
  })

  it('los caracteres especiales sobreviven', () => {
    const e = editorWith(NOTES_CORPUS.rara as string)
    const text = textOf(editorWith(e.getMarkdown()))
    expect(text).toContain('3 * 4 = 12 €')
    expect(text).toContain('guion_bajo_suelto')
    expect(text).toContain('#hashtag')
  })

  it('los enlaces peligrosos no se convierten en enlace', () => {
    const e = editorWith('[pincha](javascript:alert(1)) y [bien](https://example.com)')
    expect(e.getHTML()).not.toContain('javascript:')
    expect(e.getHTML()).toContain('href="https://example.com"')
  })

  it('una nota vacía se queda vacía', () => {
    expect(editorWith('').getMarkdown()).toBe('')
  })
})

describe('el editor no toca el marked de la app', () => {
  it('después de abrir el editor, el lexer global sigue sin extensiones', async () => {
    const { marked } = await import('marked')
    editorWith(NOTES_CORPUS.compra as string).getMarkdown()
    expect(marked.defaults.extensions).toBeNull()
  })
})
