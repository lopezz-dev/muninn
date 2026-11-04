// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isSelecting } from '../src/screens/notas/NoteEditor'

describe('vista previa de una nota: seleccionar no pasa a editar', () => {
  const setup = () => {
    document.body.innerHTML = '<div id="nota"><p>Hola mundo</p></div><p id="fuera">Otra cosa</p>'
    return document.getElementById('nota') as HTMLElement
  }
  const select = (node: Node, from: number, to: number) => {
    const range = document.createRange()
    range.setStart(node, from)
    range.setEnd(node, to)
    const sel = document.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  it('un clic sin selección sí edita', () => {
    const el = setup()
    document.getSelection()?.removeAllRanges()
    expect(isSelecting(el)).toBe(false)
  })

  it('un texto seleccionado dentro de la nota no edita', () => {
    const el = setup()
    select(el.querySelector('p')?.firstChild as Node, 0, 4)
    expect(isSelecting(el)).toBe(true)
  })

  it('una selección fuera de la nota no cuenta', () => {
    const el = setup()
    select(document.getElementById('fuera')?.firstChild as Node, 0, 4)
    expect(isSelecting(el)).toBe(false)
  })
})
