import { describe, expect, it } from 'vitest'
import { matchesAll, words } from '../src/lib/text'

describe('búsqueda por palabras', () => {
  it('words trocea la consulta sin tildes, mayúsculas ni espacios de sobra', () => {
    expect(words('  Café   MADRID ')).toEqual(['cafe', 'madrid'])
    expect(words('')).toEqual([])
    expect(words('   ')).toEqual([])
  })

  it('matchesAll exige todas las palabras, en cualquier orden', () => {
    const text = 'Reunión con el equipo de Diseño'
    expect(matchesAll(text, words('diseño reunion'))).toBe(true)
    expect(matchesAll(text, words('EQUIPO'))).toBe(true)
    expect(matchesAll(text, words('equi dise'))).toBe(true)
    expect(matchesAll(text, words('reunion ventas'))).toBe(false)
  })

  it('sin palabras, todo coincide', () => {
    expect(matchesAll('lo que sea', [])).toBe(true)
    expect(matchesAll('', words(''))).toBe(true)
  })
})
