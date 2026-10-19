/**
 * Casillas de tarea de un texto en Markdown (`- [ ] algo`). Las usa la vista (marcar sin editar) y la
 * comprobación de que la vista y el texto cuentan las mismas casillas.
 */

// Lista (con o sin citas delante), espacio y `[ ]`/`[x]`. El grupo 2 es el carácter de la casilla.
const TASK_LINE = /^(\s*(?:>\s*)*(?:[-*+]|\d{1,9}[.)])\s+\[)([ xX])(\])/
const FENCE = /^\s{0,3}(`{3,}|~{3,})/

/** Posición (índice de carácter) de cada casilla de tarea, en orden, ignorando los bloques de código. */
function taskOffsets(source: string): number[] {
  const out: number[] = []
  let offset = 0
  let fence: string | null = null
  for (const line of source.split('\n')) {
    const f = FENCE.exec(line)?.[1]
    if (f) {
      if (!fence) fence = f
      else if (f[0] === fence[0] && f.length >= fence.length) fence = null
    } else if (!fence) {
      const m = TASK_LINE.exec(line)
      if (m) out.push(offset + (m[1]?.length ?? 0))
    }
    offset += line.length + 1
  }
  return out
}

export const countTasks = (source: string) => taskOffsets(source).length

/** El texto con la casilla número `index` marcada (o desmarcada), o `null` si no existe. */
export function toggleTask(source: string, index: number): string | null {
  const at = taskOffsets(source)[index]
  if (at === undefined) return null
  const done = source[at] === ' '
  return `${source.slice(0, at)}${done ? 'x' : ' '}${source.slice(at + 1)}`
}
