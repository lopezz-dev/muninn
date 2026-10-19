/**
 * Edición de Markdown sobre un `<textarea>`: la barra de formato y el Enter dentro de una lista.
 * Todo son funciones puras: reciben el texto y la selección y devuelven el cambio (`Edit`), que
 * `applyEdit` (en `edit.ts`) aplica al campo sin romper su historial de deshacer.
 */

export interface Edit {
  /** Tramo del texto actual que se sustituye. */
  from: number
  to: number
  insert: string
  /** Selección tras el cambio, en el texto nuevo. */
  selStart: number
  selEnd: number
}

export type FormatCommand = 'heading' | 'bold' | 'italic' | 'bullet' | 'task' | 'code' | 'link'

// ─── Marcas en línea (negrita, cursiva, código) ──────────────────────────────

/** Cuántos `ch` seguidos hay antes (`dir = -1`) o desde (`dir = 1`) de una posición. */
function run(text: string, pos: number, ch: string, dir: 1 | -1) {
  let n = 0
  for (let i = dir === 1 ? pos : pos - 1; text[i] === ch; i += dir) n++
  return n
}

function wrap(text: string, start: number, end: number, mark: string): Edit {
  const ch = mark[0] ?? ''
  const inner = text.slice(start, end)
  // La marca está justo alrededor de la selección: se quita. Para `*` hace falta que sea la
  // marca de ese nivel: `**x**` no es cursiva, `***x***` sí lo es (y negrita).
  const before = run(text, start, ch, -1)
  const after = run(text, end, ch, 1)
  const around = mark.length === 1 ? before % 2 === 1 && after % 2 === 1 : before >= 2 && after >= 2
  if (
    around &&
    text.slice(start - mark.length, start) === mark &&
    text.slice(end, end + mark.length) === mark
  ) {
    return {
      from: start - mark.length,
      to: end + mark.length,
      insert: inner,
      selStart: start - mark.length,
      selEnd: end - mark.length,
    }
  }
  // La selección ya incluye las marcas: también se quitan.
  if (
    inner.length >= mark.length * 2 &&
    inner.startsWith(mark) &&
    inner.endsWith(mark) &&
    (mark.length > 1 ||
      (run(inner, 0, ch, 1) % 2 === 1 && run(inner, inner.length, ch, -1) % 2 === 1))
  ) {
    const bare = inner.slice(mark.length, inner.length - mark.length)
    return { from: start, to: end, insert: bare, selStart: start, selEnd: start + bare.length }
  }
  return {
    from: start,
    to: end,
    insert: `${mark}${inner}${mark}`,
    selStart: start + mark.length,
    selEnd: end + mark.length,
  }
}

// ─── Líneas (título, lista, tareas) ──────────────────────────────────────────

const HEADING = /^(\s*)(#{1,6})\s+/
const BULLET = /^(\s*)(?:[-*+])\s+(?!\[[ xX]\]\s)/
const TASK = /^(\s*)(?:[-*+])\s+\[[ xX]\]\s+/
const ORDERED = /^(\s*)\d{1,9}[.)]\s+/

/** Las líneas completas que toca la selección, sin la última si la selección acaba al empezarla. */
function lineRange(text: string, start: number, end: number) {
  const from = text.lastIndexOf('\n', start - 1) + 1
  let to = end > start && text[end - 1] === '\n' ? end - 1 : end
  const nl = text.indexOf('\n', to)
  to = nl === -1 ? text.length : nl
  return { from, to }
}

function mapLines(
  text: string,
  start: number,
  end: number,
  fn: (lines: string[]) => string[],
): Edit {
  const { from, to } = lineRange(text, start, end)
  const old = text.slice(from, to)
  const next = fn(old.split('\n')).join('\n')
  if (start === end) {
    // Sin selección, el cursor se queda donde estaba aunque el prefijo cambie de ancho.
    const caret = Math.max(from, start + (next.length - old.length))
    return { from, to, insert: next, selStart: caret, selEnd: caret }
  }
  return { from, to, insert: next, selStart: from, selEnd: from + next.length }
}

const stripMarkers = (line: string) =>
  line.replace(HEADING, '$1').replace(TASK, '$1').replace(BULLET, '$1').replace(ORDERED, '$1')

function heading(text: string, start: number, end: number): Edit {
  return mapLines(text, start, end, (lines) => {
    // Ciclo: sin título → ## → ### → sin título (el # lo usa el título de la nota).
    const level = HEADING.exec(lines[0] ?? '')?.[2]?.length ?? 0
    const next = level === 0 ? 2 : level === 2 ? 3 : 0
    return lines.map((l) => {
      if (!l.trim()) return l
      const bare = stripMarkers(l)
      const indent = /^\s*/.exec(bare)?.[0] ?? ''
      return next ? `${indent}${'#'.repeat(next)} ${bare.slice(indent.length)}` : bare
    })
  })
}

function list(text: string, start: number, end: number, kind: 'bullet' | 'task'): Edit {
  const prefix = kind === 'task' ? '- [ ] ' : '- '
  const has = kind === 'task' ? TASK : BULLET
  return mapLines(text, start, end, (lines) => {
    const filled = lines.filter((l) => l.trim())
    const allSet = filled.length > 0 && filled.every((l) => has.test(l))
    return lines.map((l) => {
      if (!l.trim()) return l
      const bare = stripMarkers(l)
      if (allSet) return bare
      const indent = /^\s*/.exec(bare)?.[0] ?? ''
      return `${indent}${prefix}${bare.slice(indent.length)}`
    })
  })
}

// ─── Código y enlace ─────────────────────────────────────────────────────────

function code(text: string, start: number, end: number): Edit {
  const inner = text.slice(start, end)
  if (!inner.includes('\n')) return wrap(text, start, end, '`')
  const fenced = /^```[^\n]*\n[\s\S]*\n```$/.test(inner)
  if (fenced) {
    const bare = inner.replace(/^```[^\n]*\n/, '').replace(/\n```$/, '')
    return { from: start, to: end, insert: bare, selStart: start, selEnd: start + bare.length }
  }
  const body = `\`\`\`\n${inner}\n\`\`\``
  return { from: start, to: end, insert: body, selStart: start, selEnd: start + body.length }
}

function link(text: string, start: number, end: number): Edit {
  const inner = text.slice(start, end)
  if (/^https?:\/\/\S+$/i.test(inner)) {
    // Un enlace pegado o seleccionado: falta el texto.
    const label = 'texto'
    return {
      from: start,
      to: end,
      insert: `[${label}](${inner})`,
      selStart: start + 1,
      selEnd: start + 1 + label.length,
    }
  }
  const label = inner || 'texto'
  const url = 'https://'
  const urlStart = start + label.length + 3
  return {
    from: start,
    to: end,
    insert: `[${label}](${url})`,
    selStart: urlStart,
    selEnd: urlStart + url.length,
  }
}

/** El cambio que hace un botón de la barra de formato sobre la selección `[start, end)`. */
export function applyFormat(
  command: FormatCommand,
  text: string,
  start: number,
  end: number,
): Edit {
  switch (command) {
    case 'bold':
      return wrap(text, start, end, '**')
    case 'italic':
      return wrap(text, start, end, '*')
    case 'heading':
      return heading(text, start, end)
    case 'bullet':
      return list(text, start, end, 'bullet')
    case 'task':
      return list(text, start, end, 'task')
    case 'code':
      return code(text, start, end)
    case 'link':
      return link(text, start, end)
  }
}

// ─── Enter dentro de una lista ───────────────────────────────────────────────

const LIST_LINE = /^(\s*)([-*+]|(\d{1,9})([.)]))\s+(\[[ xX]\]\s+)?/

/**
 * Enter en una lista: sigue con el siguiente elemento (misma sangría, número +1, tarea sin marcar) o,
 * si el elemento está vacío, termina la lista. `null` si el cursor no está en una lista (Enter normal).
 */
export function continueList(text: string, start: number, end: number): Edit | null {
  if (start !== end) return null
  const from = text.lastIndexOf('\n', start - 1) + 1
  const nl = text.indexOf('\n', start)
  const to = nl === -1 ? text.length : nl
  const line = text.slice(from, to)
  const m = LIST_LINE.exec(line)
  if (!m) return null
  // El cursor dentro de la marca (antes del contenido): Enter normal.
  if (start - from < m[0].length) return null

  const [, indent = '', bullet = '', digits, delim, task] = m
  if (line.length === m[0].length) {
    // Elemento vacío: se quita la marca y la lista termina.
    return {
      from,
      to,
      insert: indent,
      selStart: from + indent.length,
      selEnd: from + indent.length,
    }
  }
  const marker = digits ? `${Number(digits) + 1}${delim}` : bullet
  const insert = `\n${indent}${marker} ${task ? '[ ] ' : ''}`
  const caret = start + insert.length
  return { from: start, to: end, insert, selStart: caret, selEnd: caret }
}
