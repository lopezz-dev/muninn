/** Abre o cierra un bloque de código (``` o ~~~, con la sangría de una lista delante). */
const FENCE = /^\s*(```|~~~)/

/**
 * Deja limpio el Markdown que sale del editor (ADR-0078). TipTap marca los párrafos vacíos seguidos con `&nbsp;` para
 * conservarlos, y deja líneas en blanco de más alrededor de las tablas. En una nota eso solo ensucia lo que leen el MCP
 * y los asistentes: fuera de los bloques de código, cada hueco queda en una sola línea en blanco y el final, sin huecos.
 * Dentro de un bloque de código no se toca nada.
 */
export function tidyMarkdown(md: string): string {
  const out: string[] = []
  let fence: string | null = null
  for (const line of md.split('\n')) {
    const mark = FENCE.exec(line)?.[1]
    if (fence) {
      if (mark === fence) fence = null
      out.push(line)
      continue
    }
    if (mark) fence = mark
    const blank = line.trim() === '' || line.trim() === '&nbsp;'
    if (blank) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      continue
    }
    out.push(line)
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}
