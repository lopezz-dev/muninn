import { describe, expect, it } from 'vitest'
import { issueNumber } from '../src/components/task-meta'
import { parseRepoInput } from '../src/lib/github'

describe('repositorio de un proyecto', () => {
  it('acepta owner/repo y la dirección que se copia de GitHub', () => {
    expect(parseRepoInput('lopezz-dev/muninn')).toBe('lopezz-dev/muninn')
    expect(parseRepoInput('  lopezz-dev/muninn  ')).toBe('lopezz-dev/muninn')
    expect(parseRepoInput('https://github.com/lopezz-dev/muninn')).toBe('lopezz-dev/muninn')
    expect(parseRepoInput('github.com/lopezz-dev/muninn.git')).toBe('lopezz-dev/muninn')
    expect(parseRepoInput('https://www.github.com/lopezz-dev/muninn/issues/7')).toBe(
      'lopezz-dev/muninn',
    )
    expect(parseRepoInput('git@github.com:lopezz-dev/muninn.git')).toBe('lopezz-dev/muninn')
  })

  it('vacío desvincula; lo que no se entiende es undefined', () => {
    expect(parseRepoInput('')).toBeNull()
    expect(parseRepoInput('   ')).toBeNull()
    expect(parseRepoInput('muninn')).toBeUndefined()
    expect(parseRepoInput('a b/c')).toBeUndefined()
    expect(parseRepoInput('https://gitlab.com/x/y')).toBeUndefined()
  })
})

describe('número de issue', () => {
  it('sale del external_id', () => {
    expect(issueNumber('lopezz-dev/muninn#12')).toBe(12)
    expect(issueNumber(null)).toBeNull()
    expect(issueNumber('sin-numero')).toBeNull()
  })
})
