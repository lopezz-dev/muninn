import { describe, expect, it } from 'vitest'
import { allWordsFilter, likeWords } from '../src/supabase-store'

describe('búsqueda por palabras en Supabase', () => {
  it('parte en palabras y quita lo que rompe `or()` o hace de comodín', () => {
    expect(likeWords('  Café, (Madrid)  ')).toEqual(['%Café%', '%Madrid%'])
    expect(likeWords('mi_repo 100%')).toEqual(['%mi%', '%repo%', '%100%'])
    expect(likeWords(' ,() ')).toEqual([])
  })

  it('cada palabra en alguna columna, todas a la vez', () => {
    expect(allWordsFilter('login github', ['title', 'description'])).toBe(
      'and(or(title.ilike.%login%,description.ilike.%login%),or(title.ilike.%github%,description.ilike.%github%))',
    )
    expect(allWordsFilter('docs', ['title'])).toBe('and(or(title.ilike.%docs%))')
    expect(allWordsFilter('"*"', ['title'])).toBeUndefined()
  })
})
