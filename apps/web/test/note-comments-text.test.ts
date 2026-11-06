// @vitest-environment jsdom
import { locateQuote, noteText } from '@muninn/core'
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { textMap, toDocRange, toTextRange } from '../src/screens/notas/comments/text-map'
import { noteExtensions } from '../src/screens/notas/rich/extensions'
import { leafText } from '../src/screens/notas/rich/raw-nodes'
import { NOTES_CORPUS } from './fixtures/notes-corpus'

const docOf = (md: string) =>
  new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' }).state.doc

describe('texto visible del editor (ADR-0079)', () => {
  for (const [name, md] of Object.entries(NOTES_CORPUS)) {
    it(`${name}: igual que textBetween y que noteText del core`, () => {
      const doc = docOf(md)
      const map = textMap(doc)
      expect(map.text).toBe(doc.textBetween(0, doc.content.size, '\n', (n) => leafText(n)))
      expect(map.starts).toHaveLength(map.text.length)
      // El core busca la cita en su proyección: tiene que coincidir con la del editor. Única diferencia conocida: el HTML
      // en línea que el esquema entiende (`<b>`) el editor lo pasa a su marca, y el core lo deja como texto.
      expect(noteText(md).replace(/<\/?b>/g, '')).toBe(map.text)
    })
  }

  it('cada tramo del texto vuelve a sí mismo por las posiciones del documento', () => {
    const doc = docOf(NOTES_CORPUS.planificacion as string)
    const map = textMap(doc)
    for (const [start, end] of [
      [0, 9],
      [30, 80],
      [map.text.indexOf('Corte 0.9.0'), map.text.indexOf('Corte 0.9.0') + 11],
      [map.text.indexOf('aviso'), map.text.indexOf('aviso') + 5],
    ] as const) {
      const r = toDocRange(map, start, end)
      expect(r).not.toBeNull()
      if (!r) continue
      expect(doc.textBetween(r.from, r.to, '\n', (n) => leafText(n))).toBe(
        map.text.slice(start, end),
      )
      expect(toTextRange(map, r.from, r.to)).toEqual({ start, end })
    }
  })

  it('una cita del editor se encuentra en el core, también repetida', () => {
    const md = 'Hola mundo.\n\nOtro párrafo con mundo dentro.\n\n- mundo en una lista'
    const map = textMap(docOf(md))
    const at = map.text.lastIndexOf('mundo')
    const found = locateQuote(noteText(md), {
      quote: 'mundo',
      prefix: map.text.slice(at - 10, at),
      suffix: map.text.slice(at + 5, at + 15),
    })
    expect(found).toEqual({ start: at, end: at + 5 })
  })
})
