import { describe, expect, it } from 'vitest'
import { buildAnchor, locateQuote, noteText, reanchor } from '../src'

// Texto visible y anclaje de comentarios (ADR-0079). Los textos esperados de `noteText` salen de TipTap 3.33 con
// `@tiptap/markdown`, StarterKit, tablas, tareas e imagen en línea: `doc.textBetween(0, size, '\n', leaf)`.

describe('noteText', () => {
  const cases: [string, string, string][] = [
    [
      'título y énfasis',
      '# Título\n\nUn párrafo con **negrita** y _cursiva_.',
      'Título\nUn párrafo con negrita y cursiva.',
    ],
    ['salto suave dentro del párrafo', 'a\nb\n\nc', 'a\nb\nc'],
    ['líneas en blanco de más: párrafos vacíos', 'a\n\n\n\nb', 'a\n\nb'],
    ['aún más líneas en blanco', 'a\n\n\n\n\n\nb', 'a\n\n\nb'],
    ['listas anidadas', '- uno\n- dos\n  - anidado\n- tres', 'uno\ndos\nanidado\ntres'],
    ['tareas', '- [ ] tarea\n- [x] hecha', 'tarea\nhecha'],
    [
      'tareas anidadas con énfasis',
      '- [ ] tarea con **negrita**\n  - [x] sub',
      'tarea con negrita\nsub',
    ],
    ['lista numerada', '1. a\n2. b', 'a\nb'],
    ['tabla con celda vacía', '| A | B |\n| --- | --- |\n| 1 | |\n| x | y |', 'A\nB\n1\n\nx\ny'],
    [
      'bloque de código tal cual',
      '```js\nconst a = 1\n\nfoo()\n```\n\nfin',
      'const a = 1\n\nfoo()\nfin',
    ],
    ['código sangrado', '    indentado\n    código', 'indentado\ncódigo'],
    ['citas', '> cita\n> sigue\n\n> otra', 'cita\nsigue\notra'],
    [
      'enlaces, imagen y autoenlace',
      '[enlace](https://x.com) y ![alt img](a.png) y <https://auto.com>',
      'enlace y alt img y https://auto.com',
    ],
    [
      'escapes y entidades (como el editor: &nbsp; no)',
      '\\*no\\* &amp; &lt;b&gt; &nbsp; &#65;',
      '*no* & <b> &nbsp; A',
    ],
    ['código en línea', 'texto `code  x` fin', 'texto code  x fin'],
    ['HTML en línea como texto', '<b>neg</b> y <span>s</span>', '<b>neg</b> y <span>s</span>'],
    ['HTML de bloque como texto', '<div>bloque</div>\n\npara', '<div>bloque</div>\npara'],
    ['títulos setext', 'Título\n===\n\nSub\n---', 'Título\nSub'],
    ['separador sin texto', '---\n\npara', 'para'],
    ['salto duro', 'línea  \nsalto duro', 'línea\nsalto duro'],
    ['tachado y énfasis anidado', '~~tachado~~ ***fuerte*** **_mix_**', 'tachado fuerte mix'],
    ['elemento con dos párrafos', '- a\n\n  segundo párrafo\n- b', 'a\nsegundo párrafo\nb'],
    ['vacía', '', ''],
    ['solo espacios', '   ', ''],
    [
      'nota completa',
      '# Plan\n\nIntro con **negrita**, _cursiva_ y `código`.\n\n## Lista\n\n- uno\n- dos\n  - anidado con [enlace](https://x.com)\n- tres\n\n- [ ] tarea\n- [x] hecha\n\n| Inicio | Tarjeta |\n| --- | --- |\n| 03-11 | ✅ **Corte** 0.9 |\n| | vacía |\n\n```ts\nconst a = 1\n```\n\n> Una cita\n> de dos líneas\n\n---\n\nFin con ![logo](a.png) y \\*escape\\* &amp; &lt;b&gt;.',
      'Plan\nIntro con negrita, cursiva y código.\nLista\nuno\ndos\nanidado con enlace\ntres\ntarea\nhecha\nInicio\nTarjeta\n03-11\n✅ Corte 0.9\n\nvacía\nconst a = 1\nUna cita\nde dos líneas\nFin con logo y *escape* & <b>.',
    ],
  ]
  it.each(cases)('%s', (_name, md, text) => {
    expect(noteText(md)).toBe(text)
  })

  it('CRLF como LF', () => {
    expect(noteText('a\r\nb\r\n\r\nc')).toBe('a\nb\nc')
  })
})

describe('locateQuote', () => {
  const text = 'el gato come. el gato duerme. el perro come.'

  it('encuentra una cita única', () => {
    expect(locateQuote(text, { quote: 'perro' })).toEqual({ start: 33, end: 38 })
  })

  it('null si no está', () => {
    expect(locateQuote(text, { quote: 'ratón' })).toBeNull()
  })

  it('desempata por contexto', () => {
    const r = locateQuote(text, { quote: 'el gato', prefix: 'come. ', suffix: ' duerme' })
    expect(r).toEqual({ start: 14, end: 21 })
  })

  it('con el mismo contexto, gana la más cercana a start', () => {
    expect(locateQuote(text, { quote: 'el', start: 30 })?.start).toBe(30)
    expect(locateQuote(text, { quote: 'el', start: 12 })?.start).toBe(14)
  })

  it('occurrence manda sobre el contexto', () => {
    expect(locateQuote(text, { quote: 'el gato', occurrence: 1, suffix: ' duerme' })?.start).toBe(0)
    expect(locateQuote(text, { quote: 'el gato', occurrence: 3 })).toBeNull()
  })

  it('sin coincidencia exacta, ignora el espaciado (líneas de continuación de una lista)', () => {
    const t = 'la cita se\nmueve con el texto'
    expect(locateQuote(t, { quote: 'se\n mueve' })).toEqual({ start: 8, end: 16 })
    expect(locateQuote(t, { quote: 'se mueve con' })).toEqual({ start: 8, end: 20 })
  })
})

describe('buildAnchor', () => {
  it('guarda la cita con 32 caracteres de contexto a cada lado', () => {
    const text = `${'x'.repeat(40)}CITA${'y'.repeat(40)}`
    const a = buildAnchor(text, { start: 40, end: 44 })
    expect(a).toEqual({
      quote: 'CITA',
      prefix: 'x'.repeat(32),
      suffix: 'y'.repeat(32),
      start: 40,
      end: 44,
    })
  })

  it('cerca de los bordes, el contexto es más corto', () => {
    expect(buildAnchor('hola mundo', { start: 0, end: 4 })).toEqual({
      quote: 'hola',
      prefix: '',
      suffix: ' mundo',
      start: 0,
      end: 4,
    })
  })
})

describe('reanchor', () => {
  const old = 'Primero.\nLa cita importante está aquí.\nÚltimo párrafo.'
  const anchorOf = (text: string, quote: string) => {
    const r = locateQuote(text, { quote })
    if (!r) throw new Error('no está')
    return buildAnchor(text, r)
  }
  const a = anchorOf(old, 'cita importante')

  it('un cambio después no la mueve', () => {
    const next = `${old}\nOtro más.`
    const r = reanchor(old, next, a)
    expect(r.orphaned).toBe(false)
    if (r.orphaned) return
    // Misma cita y sitio; el contexto se refresca con el texto nuevo.
    expect(r.anchor).toMatchObject({ quote: a.quote, start: a.start, end: a.end, prefix: a.prefix })
    expect(r.anchor.suffix).toBe(next.slice(a.end, a.end + 32))
  })

  it('un cambio antes la desplaza con el texto', () => {
    const next = `Un párrafo nuevo arriba.\n${old}`
    const r = reanchor(old, next, a)
    expect(r.orphaned).toBe(false)
    if (r.orphaned) return
    expect(next.slice(r.anchor.start, r.anchor.end)).toBe('cita importante')
    expect(r.anchor.start).toBe(a.start + 'Un párrafo nuevo arriba.\n'.length)
  })

  it('un cambio pequeño dentro de la cita la reancla de forma aproximada y actualiza la cita', () => {
    // Una errata corregida (1 cambio en 15 caracteres, por debajo del 20 %).
    const next = old.replace('cita importante', 'cita imprtante')
    const r = reanchor(old, next, a)
    expect(r.orphaned).toBe(false)
    if (r.orphaned) return
    expect(r.anchor.quote).toBe('cita imprtante')
    expect(next.slice(r.anchor.start, r.anchor.end)).toBe(r.anchor.quote)
  })

  it('con la cita repetida, gana la que conserva el contexto', () => {
    const text = 'uno: la clave. dos: la clave. tres.'
    const second = buildAnchor(text, { start: 20, end: 28 })
    // Se reescribe el principio y el final: la proyección no sirve y decide el contexto.
    const next = 'UNO: la clave. dos: la clave. TRES!'
    const r = reanchor(text, next, second)
    expect(r.orphaned).toBe(false)
    if (!r.orphaned) expect(r.anchor.start).toBe(20)
  })

  it('si la cita desaparece, queda sin sitio; si vuelve, se reancla', () => {
    const gone = 'Primero.\nÚltimo párrafo.'
    expect(reanchor(old, gone, a)).toEqual({ orphaned: true })
    // El ancla guardada no cambia mientras está huérfana: con el texto de vuelta, encaja otra vez.
    const back = reanchor(gone, old, a)
    expect(back.orphaned).toBe(false)
    if (!back.orphaned) expect(back.anchor.start).toBe(a.start)
  })

  it('un cambio grande dentro de la cita la deja sin sitio', () => {
    const next = old.replace('cita importante', 'frase distinta del todo')
    expect(reanchor(old, next, a)).toEqual({ orphaned: true })
  })

  it('aguanta notas largas', () => {
    const long = Array.from({ length: 2000 }, (_, i) => `Línea ${i} con algo de texto.`).join('\n')
    const anchor = anchorOf(long, 'Línea 1500 con algo')
    const next = long.replace('Línea 1500 con algo', 'Línea 1500 con alg0')
    const t0 = performance.now()
    const r = reanchor(long, next, anchor)
    expect(performance.now() - t0).toBeLessThan(500)
    expect(r.orphaned).toBe(false)
  })
})
