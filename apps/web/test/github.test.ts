import type { Muninn } from '@muninn/core'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { issueNumber } from '../src/components/task-meta'
import {
  isMfaRequired,
  moveProjectRepo,
  parseRepoInput,
  pickProjectRepo,
  repoChoices,
} from '../src/lib/github'

describe('repositorio de un proyecto', () => {
  it('reconoce el rechazo del servidor por falta de segundo factor (ADR-0062)', () => {
    expect(isMfaRequired(new Error('Conectar GitHub requiere el segundo factor'))).toBe(true)
    expect(isMfaRequired(new Error('duplicate key value violates unique constraint'))).toBe(false)
    expect(isMfaRequired('segundo factor')).toBe(false)
  })

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

describe('elegir un repositorio', () => {
  /** Solo lo que usa `pickProjectRepo`: comprobar el acceso y guardar el repo del proyecto. */
  const fake = (writable: boolean) => {
    const asked: string[] = []
    const saved: (string | null | undefined)[] = []
    const m = {
      github: {
        canWrite: async (repo: string) => {
          asked.push(repo)
          return writable
        },
      },
      projects: {
        update: async (_id: string, patch: { githubRepo?: string | null }) => {
          saved.push(patch.githubRepo)
          return {}
        },
      },
    } as unknown as Muninn
    return { m, asked, saved }
  }
  const project = { id: 'p1', name: 'Muninn', githubRepo: null }
  const pub = { fullName: 'lopezz-dev/huginnDB', private: false, description: null }
  const priv = { fullName: 'lopezz-dev/secreto', private: true, description: null }

  it('un público al que el token no llega no se vincula', async () => {
    const { m, asked, saved } = fake(false)
    expect(await pickProjectRepo(m, new QueryClient(), project, pub)).toBe(false)
    expect(asked).toEqual(['lopezz-dev/huginnDB'])
    expect(saved).toEqual([])
  })

  it('un público con acceso se vincula; un privado y «Sin repositorio» no se comprueban', async () => {
    const { m, asked, saved } = fake(true)
    expect(await pickProjectRepo(m, new QueryClient(), project, pub)).toBe(true)
    expect(await pickProjectRepo(m, new QueryClient(), project, priv)).toBe(true)
    const linked = { ...project, githubRepo: 'lopezz-dev/secreto' }
    expect(await pickProjectRepo(m, new QueryClient(), linked, null)).toBe(true)
    expect(asked).toEqual(['lopezz-dev/huginnDB'])
    expect(saved).toEqual(['lopezz-dev/huginnDB', 'lopezz-dev/secreto', null])
  })
})

describe('mover un repositorio a otro proyecto', () => {
  const from = { id: 'p1', name: 'Muninn' }
  const to = { id: 'p2', name: 'Huginn' }
  const fake = (failOn?: string) => {
    const saved: [string, string | null | undefined][] = []
    const m = {
      projects: {
        update: async (id: string, patch: { githubRepo?: string | null }) => {
          if (id === failOn && patch.githubRepo) throw new Error('duplicate key')
          saved.push([id, patch.githubRepo])
          return {}
        },
      },
    } as unknown as Muninn
    return { m, saved }
  }

  it('desvincula el primero y vincula el segundo', async () => {
    const { m, saved } = fake()
    expect(await moveProjectRepo(m, new QueryClient(), from, to, 'o/r')).toBe(true)
    expect(saved).toEqual([
      ['p1', null],
      ['p2', 'o/r'],
    ])
  })

  it('si el segundo falla, lo devuelve al primero', async () => {
    const { m, saved } = fake('p2')
    expect(await moveProjectRepo(m, new QueryClient(), from, to, 'o/r')).toBe(false)
    expect(saved).toEqual([
      ['p1', null],
      ['p1', 'o/r'],
    ])
  })
})

describe('número de issue', () => {
  it('sale del external_id', () => {
    expect(issueNumber('lopezz-dev/muninn#12')).toBe(12)
    expect(issueNumber(null)).toBeNull()
    expect(issueNumber('sin-numero')).toBeNull()
  })
})
