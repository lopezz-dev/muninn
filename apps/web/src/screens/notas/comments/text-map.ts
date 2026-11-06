import type { Node as PMNode } from '@tiptap/pm/model'
import { leafText } from '../rich/raw-nodes'

/**
 * El texto visible del editor y de dónde sale cada carácter (ADR-0079). Es lo mismo que
 * `doc.textBetween(0, size, '\n', leafText)` (la proyección que reproduce `noteText` del core), más el camino de vuelta:
 * de una posición en el texto a una posición de ProseMirror, para pintar el subrayado de una cita, y al revés, para
 * sacar la cita de una selección.
 */
export interface TextMap {
  text: string
  /** Posición de ProseMirror donde empieza cada carácter del texto. */
  starts: number[]
  /** Posición de ProseMirror donde acaba cada carácter (para un nodo atómico, después del nodo). */
  ends: number[]
}

export function textMap(doc: PMNode): TextMap {
  let text = ''
  const starts: number[] = []
  const ends: number[] = []
  let first = true
  const push = (s: string, start: (i: number) => number, end: (i: number) => number) => {
    for (let i = 0; i < s.length; i++) {
      starts.push(start(i))
      ends.push(end(i))
    }
    text += s
  }
  // Mismo recorrido que `Node.textBetween` de ProseMirror.
  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    const own = node.isText ? (node.text ?? '') : node.isLeaf ? leafText(node) : ''
    if (node.isBlock && ((node.isLeaf && own) || node.isTextblock)) {
      if (first) first = false
      else
        push(
          '\n',
          () => pos,
          () => pos,
        )
    }
    if (node.isText)
      push(
        own,
        (i) => pos + i,
        (i) => pos + i + 1,
      )
    else if (own)
      push(
        own,
        () => pos,
        () => pos + node.nodeSize,
      )
  })
  return { text, starts, ends }
}

/** De un tramo del texto a posiciones de ProseMirror; `null` si queda vacío. */
export function toDocRange(map: TextMap, start: number, end: number) {
  if (end <= start || start < 0 || end > map.text.length) return null
  const from = map.starts[start] as number
  const to = map.ends[end - 1] as number
  return to > from ? { from, to } : null
}

/** De posiciones de ProseMirror a un tramo del texto (lo que queda dentro de la selección). */
export function toTextRange(map: TextMap, from: number, to: number) {
  let start = -1
  let end = -1
  for (let i = 0; i < map.text.length; i++) {
    if ((map.starts[i] as number) >= from && (map.ends[i] as number) <= to) {
      if (start === -1) start = i
      end = i + 1
    }
  }
  if (start === -1) return null
  // Sin saltos de bloque en los bordes: una selección de una línea entera no se lleva el `\n` de al lado.
  while (start < end && map.text[start] === '\n') start++
  while (end > start && map.text[end - 1] === '\n') end--
  return end > start ? { start, end } : null
}
