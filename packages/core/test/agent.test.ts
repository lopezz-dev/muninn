import { beforeEach, describe, expect, it } from 'vitest'
import {
  AGENT_LABEL,
  agentIssueNumber,
  createMemoryStore,
  createMuninn,
  type GithubIssue,
  type GithubPullRequest,
} from '../src'
import {
  createGithubClient,
  drainGithubOutbox,
  type GithubClient,
  handleGithubWebhook,
  syncGithub,
} from '../src/github-sync'

// Columna «Para el agente» (ADR-0032): la etiqueta de la issue sigue a la columna, y los PRs del agente
// mueven la tarea.

let clock = new Date('2026-10-21T10:00:00Z')
const REPO = 'lopezz-dev/huginnDB'

const issue = (over: Partial<GithubIssue> = {}): GithubIssue => ({
  number: 12,
  title: 'Exportar a CSV',
  body: '',
  state: 'open',
  html_url: `https://github.com/${REPO}/issues/12`,
  labels: [],
  ...over,
})

const pr = (over: Partial<GithubPullRequest> = {}): GithubPullRequest => ({
  number: 40,
  html_url: `https://github.com/${REPO}/pull/40`,
  body: 'Closes #12',
  state: 'open',
  merged: false,
  draft: false,
  head: { ref: 'agent/issue-12' },
  ...over,
})

/** GitHub de mentira: una issue por número y lo que se le ha hecho. */
function fakeGithub(issues: GithubIssue[]) {
  const calls: string[] = []
  const find = (n: number) => issues.find((i) => i.number === n) ?? null
  const names = (i: GithubIssue) =>
    (i.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name))
  const client: GithubClient = {
    async listOpenIssues() {
      calls.push('list')
      return issues.filter((i) => i.state === 'open')
    },
    async getIssue(_repo, n) {
      return find(n)
    },
    async setIssueState(_repo, n, state) {
      calls.push(`${state} #${n}`)
      const i = find(n)
      if (i) i.state = state
    },
    async addLabel(_repo, n, label) {
      calls.push(`+${label} #${n}`)
      const i = find(n)
      if (i) i.labels = [...(i.labels ?? []), { name: label }]
    },
    async removeLabel(_repo, n, label) {
      calls.push(`-${label} #${n}`)
      const i = find(n)
      if (i)
        i.labels = (i.labels ?? []).filter((l) => (typeof l === 'string' ? l : l.name) !== label)
    },
    async listRepos() {
      return []
    },
    async canWriteIssues() {
      return true
    },
  }
  return { client, calls, labels: (n: number) => names(find(n) as GithubIssue) }
}

const setup = async () => {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  const opts = { now: () => clock, timeZone: 'UTC' }
  const user = createMuninn(store, opts)
  const github = createMuninn(store, { ...opts, actor: 'github' })
  const agent = createMuninn(store, { ...opts, actor: 'agent' })
  const project = await user.projects.create({ name: 'Huginn', githubRepo: REPO })
  const cols = await user.columns.list(project.id)
  const col = (kind: string) => cols.find((c) => c.kind === kind)?.id as string
  const agentCol = await user.columns.create({
    projectId: project.id,
    name: 'Para el agente',
    kind: 'todo',
    index: 1,
  })
  await user.projects.update(project.id, { agentColumnId: agentCol.id })
  const created = await github.github.applyIssue(REPO, issue())
  if (created.action !== 'created') throw new Error('sin tarea')
  return { store, user, github, agent, project, col, agentCol, task: created.task }
}

const pending = async (m: ReturnType<typeof createMuninn>, kind?: 'state' | 'agent') =>
  (await m.github.outbox.pending(100, kind)).length

beforeEach(() => {
  clock = new Date('2026-10-21T10:00:00Z')
})

describe('agente: la columna', () => {
  it('debe ser del proyecto y no de tipo «Hecho»; no se puede pasar a «Hecho»', async () => {
    const { user, project, col, agentCol } = await setup()
    const other = await user.projects.create({ name: 'Otro' })
    const otherCol = (await user.columns.list(other.id))[0]?.id as string
    await expect(user.projects.update(project.id, { agentColumnId: otherCol })).rejects.toThrow(
      'no pertenece',
    )
    await expect(user.projects.update(project.id, { agentColumnId: col('done') })).rejects.toThrow(
      '«Hecho»',
    )
    await expect(user.columns.update(agentCol.id, { kind: 'done' })).rejects.toThrow('«Hecho»')
    expect((await user.projects.get(project.id)).agentColumnId).toBe(agentCol.id)
    await user.projects.update(project.id, { agentColumnId: null })
    expect((await user.projects.get(project.id)).agentColumnId).toBeNull()
  })

  it('borrarla la quita del proyecto', async () => {
    const { user, project, agentCol } = await setup()
    await user.columns.delete(agentCol.id)
    expect((await user.projects.get(project.id)).agentColumnId).toBeNull()
  })

  it('solo admite tareas de GitHub', async () => {
    const { user, project, agentCol } = await setup()
    const manual = await user.tasks.create({ projectId: project.id, title: 'A mano' })
    await expect(user.tasks.move(manual.id, { columnId: agentCol.id })).rejects.toThrow(
      'Solo las tareas de GitHub',
    )
    await expect(
      user.tasks.create({ projectId: project.id, title: 'Nueva', columnId: agentCol.id }),
    ).rejects.toThrow('Solo las tareas de GitHub')
  })

  it('no es la columna por defecto aunque sea la primera «Por hacer»', async () => {
    const { user, github, project, col, agentCol } = await setup()
    await user.columns.move(agentCol.id, 0)
    const r = await github.github.applyIssue(REPO, issue({ number: 13 }))
    expect(r.action === 'created' && r.task.columnId).toBe(col('todo'))
    const manual = await user.tasks.create({ projectId: project.id, title: 'Sin columna' })
    expect(manual.columnId).toBe(col('todo'))
  })
})

describe('agente: la etiqueta sigue a la columna', () => {
  it('entrar la pone y salir la quita; varias veces seguidas, un solo envío', async () => {
    const { user, col, agentCol, task } = await setup()
    const gh = fakeGithub([issue()])
    await user.tasks.move(task.id, { columnId: agentCol.id })
    expect(await pending(user, 'agent')).toBe(1)
    expect(await user.github.agentStateOf(task.id)).toMatchObject({ number: 12, labeled: true })
    expect(await drainGithubOutbox(user, gh.client)).toEqual({ sent: 1, skipped: 0, failed: 0 })
    expect(gh.labels(12)).toEqual([AGENT_LABEL])

    // Reordenar dentro de la columna no apunta nada; salir y volver a entrar se resuelve con lo de ahora.
    await user.tasks.move(task.id, { columnId: agentCol.id, index: 0 })
    expect(await pending(user, 'agent')).toBe(0)
    await user.tasks.move(task.id, { columnId: col('in_progress') })
    await user.tasks.move(task.id, { columnId: agentCol.id })
    expect(await drainGithubOutbox(user, gh.client)).toEqual({ sent: 0, skipped: 1, failed: 0 })

    await user.tasks.move(task.id, { columnId: col('in_progress') })
    await drainGithubOutbox(user, gh.client)
    expect(gh.labels(12)).toEqual([])
    expect(gh.calls).toEqual([`+${AGENT_LABEL} #12`, `-${AGENT_LABEL} #12`])
  })

  it('archivarla en la columna quita la etiqueta', async () => {
    const { user, agentCol, task } = await setup()
    await user.tasks.move(task.id, { columnId: agentCol.id })
    await user.tasks.archive(task.id)
    expect(await user.github.agentStateOf(task.id)).toMatchObject({ labeled: false })
  })

  it('lo que mueven la sincronización o el agente no se apunta', async () => {
    const { github, agent, col, agentCol, task } = await setup()
    await github.tasks.move(task.id, { columnId: agentCol.id })
    await agent.tasks.move(task.id, { columnId: col('review') })
    expect(await pending(github, 'agent')).toBe(0)
  })
})

describe('agente: PRs', () => {
  it('reconoce los PRs del agente por la rama o, en una rama agent/, por «Closes #n»', () => {
    expect(agentIssueNumber({ head: { ref: 'agent/issue-12' } })).toBe(12)
    expect(agentIssueNumber({ head: { ref: 'agent/issue-12-20261021' } })).toBe(12)
    expect(agentIssueNumber({ head: { ref: 'agent/csv' }, body: 'Fixes #7 y más' })).toBe(7)
    expect(agentIssueNumber({ head: { ref: 'agent/csv' }, body: 'sin referencia' })).toBeNull()
    expect(agentIssueNumber({ head: { ref: 'feat/csv' }, body: 'Closes #12' })).toBeNull()
  })

  it('abierto → «Revisión» con el enlace; fusionado → «Hecho» y apunta cerrar la issue', async () => {
    const { user, agent, col, agentCol, task } = await setup()
    await user.tasks.move(task.id, { columnId: agentCol.id })

    expect((await agent.github.applyPullRequest(REPO, 'opened', pr({ draft: true }))).action).toBe(
      'unchanged',
    )
    const opened = await agent.github.applyPullRequest(REPO, 'opened', pr())
    expect(opened.action === 'review' && opened.task.columnId).toBe(col('review'))
    expect((await agent.github.applyPullRequest(REPO, 'reopened', pr())).action).toBe('unchanged')
    const [log] = await user.recentActivity({ entityId: task.id, limit: 1 })
    expect(log).toMatchObject({
      action: 'agent_pr_opened',
      actor: 'agent',
      payload: { number: 40, url: `https://github.com/${REPO}/pull/40` },
    })

    const before = await pending(user, 'state')
    const merged = await agent.github.applyPullRequest(
      REPO,
      'closed',
      pr({ state: 'closed', merged: true }),
    )
    expect(merged.action === 'completed' && merged.task.columnId).toBe(col('done'))
    expect(await pending(user, 'state')).toBe(before + 1)
    expect(await user.github.stateOf(task.id)).toMatchObject({ state: 'closed' })
  })

  it('cerrado sin fusionar → vuelve a «Por hacer», para reintentarlo', async () => {
    const { user, agent, col, agentCol, task } = await setup()
    await user.tasks.move(task.id, { columnId: agentCol.id })
    await agent.github.applyPullRequest(REPO, 'opened', pr())
    const closed = await agent.github.applyPullRequest(REPO, 'closed', pr({ state: 'closed' }))
    expect(closed.action === 'returned' && closed.task.columnId).toBe(col('todo'))
    const [log] = await user.recentActivity({ entityId: task.id, limit: 1 })
    expect(log?.action).toBe('agent_pr_closed')
  })

  it('ignora los PRs que no son del agente o sin tarea', async () => {
    const { agent } = await setup()
    expect(
      await agent.github.applyPullRequest(REPO, 'opened', pr({ head: { ref: 'feat/x' } })),
    ).toEqual({ action: 'ignored', reason: 'not-agent' })
    expect(
      await agent.github.applyPullRequest(REPO, 'opened', pr({ head: { ref: 'agent/issue-99' } })),
    ).toEqual({ action: 'ignored', reason: 'no-task' })
  })
})

describe('agente: webhook', () => {
  it('pull_request va con el actor del agente', async () => {
    const { user, github, agent, col, agentCol, task } = await setup()
    await user.tasks.move(task.id, { columnId: agentCol.id })
    const r = await handleGithubWebhook(
      github,
      'pull_request',
      { action: 'opened', pull_request: pr(), repository: { full_name: REPO } },
      { agent },
    )
    expect(r).toEqual({ status: 200, body: { action: 'review', taskId: task.id } })
    expect((await user.tasks.get(task.id)).columnId).toBe(col('review'))
    const [log] = await user.recentActivity({ entityId: task.id, limit: 1 })
    expect(log?.actor).toBe('agent')
    expect((await handleGithubWebhook(github, 'pull_request', { action: 'opened' })).status).toBe(
      400,
    )
  })

  it('quitar la etiqueta sin PR saca la tarea de la columna y lo anota', async () => {
    const { user, github, col, agentCol, task } = await setup()
    const gh = fakeGithub([issue()])
    const unlabeled = {
      action: 'unlabeled',
      label: { name: AGENT_LABEL },
      issue: issue(),
      repository: { full_name: REPO },
    }
    await user.tasks.move(task.id, { columnId: agentCol.id })
    // Con la etiqueta aún por poner, el aviso es viejo: manda Muninn.
    expect((await handleGithubWebhook(github, 'issues', unlabeled)).body.action).toBe('unchanged')
    expect((await user.tasks.get(task.id)).columnId).toBe(agentCol.id)

    await drainGithubOutbox(user, gh.client)
    const r = await handleGithubWebhook(github, 'issues', unlabeled)
    expect(r.body).toEqual({ action: 'agent-stopped', taskId: task.id })
    expect((await user.tasks.get(task.id)).columnId).toBe(col('todo'))
    const [log] = await user.recentActivity({ entityId: task.id, limit: 1 })
    expect(log).toMatchObject({ action: 'agent_stopped', actor: 'github' })
    // Fuera de la columna no hace nada más (y no se apunta quitar una etiqueta que ya no está).
    expect((await handleGithubWebhook(github, 'issues', unlabeled)).body.action).toBe('unchanged')
    expect(await pending(user, 'agent')).toBe(0)
  })
})

describe('agente: sincronizar ahora', () => {
  it('con «outbox» solo vacía la cola; con «all» repasa los repos', async () => {
    const { user, agentCol, task } = await setup()
    const gh = fakeGithub([issue()])
    await user.tasks.move(task.id, { columnId: agentCol.id })
    const quick = await syncGithub(user, gh.client, 'outbox')
    expect(quick).toEqual({ outbox: { sent: 1, skipped: 0, failed: 0 } })
    expect(gh.calls).not.toContain('list')
    const full = await syncGithub(user, gh.client, 'all')
    expect(full.repos?.[0]?.repo).toBe(REPO)
    expect(gh.calls).toContain('list')
  })

  it('el servicio lo pide al store; null si no sabe', async () => {
    const { user, store } = await setup()
    expect(await user.github.syncNow('outbox')).toBeNull()
    const asked: string[] = []
    const withSync = createMuninn(
      {
        ...store,
        githubRepos: {
          list: async () => [],
          canWrite: async () => true,
          sync: async (scope) => {
            asked.push(scope)
            return { ok: true }
          },
        },
      },
      { timeZone: 'UTC' },
    )
    expect(await withSync.github.syncNow('outbox')).toEqual({ ok: true })
    expect(await withSync.github.syncNow()).toEqual({ ok: true })
    await expect(withSync.github.syncNow('todo' as never)).rejects.toThrow()
    expect(asked).toEqual(['outbox', 'all'])
  })
})

describe('agente: cliente REST', () => {
  it('pone y quita la etiqueta; quitar una que no está no es error', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    let next = () => new Response('[]', { status: 200 })
    const fetchFake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return next()
    }) as unknown as typeof fetch
    const gh = createGithubClient({ token: 't', fetch: fetchFake })
    await gh.addLabel(REPO, 12, AGENT_LABEL)
    expect(calls.at(-1)?.url).toBe(`https://api.github.com/repos/${REPO}/issues/12/labels`)
    expect(calls.at(-1)?.init?.method).toBe('POST')
    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({ labels: [AGENT_LABEL] })
    await gh.removeLabel(REPO, 12, AGENT_LABEL)
    expect(calls.at(-1)?.url).toBe(
      `https://api.github.com/repos/${REPO}/issues/12/labels/muninn%3Aagent`,
    )
    expect(calls.at(-1)?.init?.method).toBe('DELETE')
    next = () => new Response('', { status: 404 })
    await gh.removeLabel(REPO, 12, AGENT_LABEL)
    next = () => new Response('Forbidden', { status: 403 })
    await expect(gh.addLabel(REPO, 12, AGENT_LABEL)).rejects.toThrow('403')
  })
})
