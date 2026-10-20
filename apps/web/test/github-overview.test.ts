import { describe, expect, it } from 'vitest'
import {
  agentRuns,
  describeSync,
  projectChoices,
  readSyncResult,
  repoRows,
} from '../src/lib/github-overview'

const project = (id: string, githubRepo: string | null, agentColumnId: string | null = null) => ({
  id,
  name: id,
  color: 'blue',
  githubRepo,
  agentColumnId,
})

const task = (
  id: string,
  projectId: string,
  over: Partial<{
    columnId: string
    kind: 'todo' | 'doing' | 'review' | 'done'
    archivedAt: string | null
    updatedAt: string
    externalId: string
  }> = {},
) => ({
  id,
  title: `Tarea ${id}`,
  projectId,
  columnId: over.columnId ?? 'todo',
  externalId: over.externalId ?? `o/r#${id}`,
  archivedAt: over.archivedAt ?? null,
  updatedAt: over.updatedAt ?? '2026-10-20T10:00:00Z',
  column: { kind: over.kind ?? 'todo' } as never,
})

describe('repoRows', () => {
  const projects = [
    project('Muninn', 'lopezz-dev/muninn'),
    project('Huginn', 'lopezz-dev/huginndb'),
  ]

  it('cuenta las abiertas y el último cambio de cada repo vinculado', () => {
    const tasks = [
      task('1', 'Muninn', { updatedAt: '2026-10-20T09:00:00Z' }),
      task('2', 'Muninn', { kind: 'done', updatedAt: '2026-10-20T11:00:00Z' }),
      task('3', 'Muninn', { archivedAt: '2026-10-20T08:00:00Z' }),
    ]
    const rows = repoRows(projects, tasks, null)
    expect(rows.map((r) => [r.repo, r.open, r.last])).toEqual([
      ['lopezz-dev/huginndb', 0, null],
      ['lopezz-dev/muninn', 1, '2026-10-20T11:00:00Z'],
    ])
  })

  it('añade al final los repos del token sin vincular, con las mayúsculas de GitHub', () => {
    const repos = [
      { fullName: 'lopezz-dev/huginnDB', private: true, description: null },
      { fullName: 'lopezz-dev/portfolio', private: false, description: null },
    ]
    const rows = repoRows(projects, [], repos)
    expect(rows.map((r) => [r.repo, r.project?.id ?? null])).toEqual([
      ['lopezz-dev/huginnDB', 'Huginn'],
      ['lopezz-dev/muninn', 'Muninn'],
      ['lopezz-dev/portfolio', null],
    ])
    expect(rows[0]?.private).toBe(true)
  })
})

describe('projectChoices', () => {
  it('marca el vinculado y deshabilita los que van con otro repo', () => {
    const projects = [
      project('Muninn', 'lopezz-dev/muninn'),
      project('Huginn', null),
      project('Web', 'lopezz-dev/web'),
    ]
    const { value, options } = projectChoices('lopezz-dev/Muninn', projects)
    expect(value).toBe('Muninn')
    expect(options.map((o) => [o.value, o.disabled ?? false, o.hint])).toEqual([
      ['', false, undefined],
      ['Muninn', false, undefined],
      ['Huginn', false, undefined],
      ['Web', true, 'con lopezz-dev/web'],
    ])
    expect(projectChoices('lopezz-dev/portfolio', projects).value).toBe('')
  })
})

describe('agentRuns', () => {
  const projects = [project('Huginn', 'lopezz-dev/huginnDB', 'agente')]

  it('lo que está en la columna trabaja; del resto, el último paso de cada tarea', () => {
    const tasks = [
      task('12', 'Huginn', {
        columnId: 'agente',
        updatedAt: '2026-10-20T12:00:00Z',
        externalId: 'lopezz-dev/huginndb#12',
      }),
      task('13', 'Huginn', { kind: 'done' }),
      // Su repo ya no está vinculado: el nombre sale de la issue.
      task('14', 'Huginn', { externalId: 'lopezz-dev/viejo#14' }),
    ]
    const activity = [
      {
        entityId: '13',
        action: 'agent_pr_merged',
        payload: { number: 41, url: 'https://github.com/lopezz-dev/huginnDB/pull/41' },
        createdAt: '2026-10-20T11:00:00Z',
      },
      {
        entityId: '13',
        action: 'agent_pr_opened',
        payload: { number: 41, url: 'https://github.com/lopezz-dev/huginnDB/pull/41' },
        createdAt: '2026-10-20T10:30:00Z',
      },
      // La 12 ya pasó por el agente, pero ahora vuelve a estar en la columna: manda eso.
      { entityId: '12', action: 'agent_stopped', payload: {}, createdAt: '2026-10-20T10:00:00Z' },
      {
        entityId: '14',
        action: 'agent_pr_closed',
        payload: { number: 39, url: 'javascript:alert(1)' },
        createdAt: '2026-10-20T09:00:00Z',
      },
      {
        entityId: 'borrada',
        action: 'agent_stopped',
        payload: {},
        createdAt: '2026-10-20T13:00:00Z',
      },
    ]
    const runs = agentRuns(activity, tasks, projects)
    expect(runs.map((r) => [r.taskId, r.state, r.pr?.number ?? null])).toEqual([
      ['12', 'working', null],
      ['13', 'merged', 41],
      ['14', 'closed', 39],
    ])
    expect(runs[0]).toMatchObject({ repo: 'lopezz-dev/huginnDB', issue: 12 })
    expect(runs[2]).toMatchObject({ repo: 'lopezz-dev/viejo', issue: 14 })
    // Nunca se enlaza algo que no sea de GitHub.
    expect(runs[2]?.pr?.url).toBeNull()
  })

  it('sin repo no hay columna del agente que mirar', () => {
    const runs = agentRuns(
      [],
      [task('1', 'P', { columnId: 'agente' })],
      [project('P', null, 'agente')],
    )
    expect(runs).toEqual([])
  })
})

describe('sincronizar ahora', () => {
  it('suma lo de cada repo y recoge los errores', () => {
    const r = readSyncResult({
      outbox: { sent: 0, skipped: 0, failed: 0 },
      repos: [
        { repo: 'a/b', created: 2, updated: 1, archived: 0 },
        { repo: 'a/c', created: 0, updated: 0, archived: 0, error: 'Not Found' },
      ],
    })
    expect(r).toEqual({
      created: 2,
      updated: 1,
      archived: 0,
      errors: [{ repo: 'a/c', error: 'Not Found' }],
    })
    expect(describeSync(r as NonNullable<typeof r>)).toBe('2 issues nuevas y 1 cambiada')
    expect(describeSync({ created: 0, updated: 0, archived: 0, errors: [] })).toBe(
      'Todo estaba al día',
    )
    expect(readSyncResult(null)).toBeNull()
    expect(readSyncResult({ outbox: {} })).toBeNull()
  })
})
