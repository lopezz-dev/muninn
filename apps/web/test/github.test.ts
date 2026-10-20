import { describe, expect, it } from 'vitest'
import { issueNumber } from '../src/components/task-meta'
import { parseRepoInput, repoChoices } from '../src/lib/github'

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

describe('selector de repositorio', () => {
  const repos = [
    { fullName: 'lopezz-dev/huginnDB', private: false, description: null },
    { fullName: 'lopezz-dev/muninn', private: true, description: null },
  ]
  const huginn = { id: 'p1', name: 'Huginn', githubRepo: null as string | null }
  const muninn = { id: 'p2', name: 'Muninn', githubRepo: 'Lopezz-Dev/Muninn' as string | null }

  it('ofrece «Sin repositorio» y los repos; los de otro proyecto, deshabilitados', () => {
    const { value, options } = repoChoices(huginn, [huginn, muninn], repos)
    expect(value).toBe('')
    expect(options.map((o) => [o.value, o.hint, o.disabled ?? false])).toEqual([
      ['', undefined, false],
      ['lopezz-dev/huginnDB', undefined, false],
      ['lopezz-dev/muninn', 'en Muninn', true],
    ])
  })

  it('el vinculado se elige sin distinguir mayúsculas y sigue saliendo aunque el token no llegue', () => {
    const own = repoChoices(muninn, [huginn, muninn], repos)
    expect(own.value).toBe('lopezz-dev/muninn')
    expect(own.options.find((o) => o.value === 'lopezz-dev/muninn')).toMatchObject({
      hint: 'privado',
      disabled: false,
    })
    const gone = repoChoices({ ...huginn, githubRepo: 'lopezz-dev/viejo' }, [huginn], repos)
    expect(gone.value).toBe('lopezz-dev/viejo')
    expect(gone.options.at(-1)).toMatchObject({
      value: 'lopezz-dev/viejo',
      hint: 'sin acceso del token',
    })
  })
})

describe('número de issue', () => {
  it('sale del external_id', () => {
    expect(issueNumber('lopezz-dev/muninn#12')).toBe(12)
    expect(issueNumber(null)).toBeNull()
    expect(issueNumber('sin-numero')).toBeNull()
  })
})
