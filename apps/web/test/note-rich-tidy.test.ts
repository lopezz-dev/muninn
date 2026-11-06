import { describe, expect, it } from 'vitest'
import { tidyMarkdown } from '../src/screens/notas/rich/tidy'

describe('tidyMarkdown', () => {
  it('quita los &nbsp; de los párrafos vacíos y los huecos del final', () => {
    expect(tidyMarkdown('# A\n\n&nbsp;\n\n&nbsp;\n\nB\n\n\n\n&nbsp;\n')).toBe('# A\n\nB')
  })
  it('deja un solo hueco alrededor de las tablas', () => {
    expect(tidyMarkdown('x\n\n\n| a |\n| --- |\n| 1 |\n\n\ny')).toBe(
      'x\n\n| a |\n| --- |\n| 1 |\n\ny',
    )
  })
  it('no toca los bloques de código', () => {
    const code = '```\nuno\n\n\n&nbsp;\n```'
    expect(tidyMarkdown(`a\n\n${code}\n\n\nb`)).toBe(`a\n\n${code}\n\nb`)
    const tilde = '  ~~~ts\n  a\n\n\n  ~~~'
    expect(tidyMarkdown(`- x\n${tilde}`)).toBe(`- x\n${tilde}`)
  })
  it('una nota vacía sigue vacía', () => {
    expect(tidyMarkdown('')).toBe('')
    expect(tidyMarkdown('&nbsp;\n\n&nbsp;')).toBe('')
  })
})
