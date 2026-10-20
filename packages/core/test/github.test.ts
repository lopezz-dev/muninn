import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMemoryStore,
  createMuninn,
  type GithubIssue,
  githubExternalId,
  parseGithubExternalId,
} from '../src'
import {
  bearerToken,
  createGithubClient,
  drainGithubOutbox,
  type GithubClient,
  handleGithubWebhook,
  reconcileGithub,
  sameSecret,
  verifyGithubSignature,
} from '../src/github-sync'

let clock = new Date('2026-10-19T10:00:00Z')
const REPO = 'lopezz-dev/muninn'

const setup = async () => {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  const opts = { now: () => clock, timeZone: 'UTC' }
  const user = createMuninn(store, opts)
  const github = createMuninn(store, { ...opts, actor: 'github' })
  const project = await user.projects.create({ name: 'Muninn', githubRepo: 'Lopezz-Dev/Muninn' })
  return { store, user, github, project }
}

const issue = (over: Partial<GithubIssue> = {}): GithubIssue => ({
  number: 7,
  title: 'Sincronizar issues como tareas',
  body: 'Con **Markdown**',
  state: 'open',
  html_url: `https://github.com/${REPO}/issues/7`,
  labels: [{ name: 'github' }, 'sync', { name: ' github ' }],
  ...over,
})

/** GitHub de mentira: issues por repo y registro de los cambios de estado. */
function fakeGithub(issues: Record<string, GithubIssue[]> = {}) {
  const changes: { repo: string; number: number; state: string }[] = []
  const find = (repo: string, n: number) =>
    issues[repo.toLowerCase()]?.find((i) => i.number === n) ?? null
  const client: GithubClient = {
    async listOpenIssues(repo) {
      return (issues[repo.toLowerCase()] ?? []).filter((i) => i.state === 'open')
    },
    async getIssue(repo, n) {
      return find(repo, n)
    },
    async setIssueState(repo, n, state) {
      changes.push({ repo, number: n, state })
      const i = find(repo, n)
      if (i) i.state = state
    },
    async listRepos() {
      return []
    },
  }
  return { client, changes, issues }
}

beforeEach(() => {
  clock = new Date('2026-10-19T10:00:00Z')
})

describe('github: ids externos', () => {
  it('repo en minúsculas y vuelta atrás', () => {
    expect(githubExternalId('Lopezz-Dev/Muninn', 12)).toBe('lopezz-dev/muninn#12')
    expect(parseGithubExternalId('lopezz-dev/muninn#12')).toEqual({ repo: REPO, number: 12 })
    expect(parseGithubExternalId('sin almohadilla')).toBeNull()
  })
})

describe('github: issue → tarea', () => {
  it('importa una issue abierta en la columna por defecto, con origen y enlace', async () => {
    const { github, user, project } = await setup()
    const r = await github.github.applyIssue(REPO, issue())
    expect(r.action).toBe('created')
    if (r.action !== 'created') return
    const todo = (await user.columns.list(project.id)).find((c) => c.kind === 'todo')
    expect(r.task).toMatchObject({
      projectId: project.id,
      columnId: todo?.id,
      title: 'Sincronizar issues como tareas',
      description: 'Con **Markdown**',
      labels: ['github', 'sync'],
      source: 'github',
      externalId: `${REPO}#7`,
      externalUrl: `https://github.com/${REPO}/issues/7`,
    })
    const [created] = await user.recentActivity({ entityId: r.task.id })
    expect(created).toMatchObject({ action: 'created', actor: 'github' })
  })

  it('es idempotente: aplicar dos veces no duplica ni cambia nada', async () => {
    const { github, user, project } = await setup()
    await github.github.applyIssue(REPO, issue())
    const again = await github.github.applyIssue('LOPEZZ-DEV/MUNINN', issue())
    expect(again.action).toBe('unchanged')
    expect(await user.tasks.list({ projectId: project.id })).toHaveLength(1)
  })

  it('GitHub manda en el título y la descripción; Muninn, en lo demás', async () => {
    const { github, user } = await setup()
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    await user.tasks.update(r.task.id, { priority: 'high', labels: ['mía'], title: 'Otro título' })
    const u = await github.github.applyIssue(REPO, issue({ title: 'Título nuevo', labels: [] }))
    expect(u.action).toBe('updated')
    const t = await user.tasks.get(r.task.id)
    expect(t).toMatchObject({ title: 'Título nuevo', priority: 'high', labels: ['mía'] })
  })

  it('cerrar la issue completa la tarea y reabrirla la devuelve', async () => {
    const { github, user, project } = await setup()
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    const closed = await github.github.applyIssue(REPO, issue({ state: 'closed' }))
    expect(closed.action).toBe('updated')
    const cols = await user.columns.list(project.id)
    const done = cols.find((c) => c.kind === 'done')
    let t = await user.tasks.get(r.task.id)
    expect(t?.columnId).toBe(done?.id)
    expect(t?.completedAt).not.toBeNull()
    await github.github.applyIssue(REPO, issue({ state: 'open' }))
    t = await user.tasks.get(r.task.id)
    expect(t?.columnId).toBe(cols.find((c) => c.kind === 'todo')?.id)
    expect(t?.completedAt).toBeNull()
  })

  it('no importa issues cerradas nuevas, PRs, repos sin proyecto ni tareas archivadas', async () => {
    const { github, user, project } = await setup()
    expect(await github.github.applyIssue(REPO, issue({ state: 'closed' }))).toEqual({
      action: 'ignored',
      reason: 'closed',
    })
    expect(
      await github.github.applyIssue(REPO, issue({ pull_request: { url: 'x' } })),
    ).toMatchObject({ reason: 'pull-request' })
    expect(await github.github.applyIssue('otro/repo', issue())).toMatchObject({
      reason: 'no-project',
    })
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    await user.tasks.archive(r.task.id)
    expect(await github.github.applyIssue(REPO, issue({ title: 'cambio' }))).toMatchObject({
      reason: 'archived',
    })
    await user.projects.archive(project.id)
    expect(await github.github.applyIssue(REPO, issue({ number: 8 }))).toMatchObject({
      reason: 'no-project',
    })
  })

  it('una issue borrada o transferida archiva la tarea (no la borra)', async () => {
    const { github, user } = await setup()
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    const archived = await github.github.removeIssue(REPO, 7)
    expect(archived?.archivedAt).not.toBeNull()
    expect(await github.github.removeIssue(REPO, 7)).toBeNull()
    expect(await user.tasks.get(r.task.id)).not.toBeNull()
  })

  it('valida el repo y la issue', async () => {
    const { github } = await setup()
    await expect(github.github.applyIssue('no-valido', issue())).rejects.toThrow('owner/repo')
    await expect(
      github.github.applyIssue(REPO, { ...issue(), number: -1 } as GithubIssue),
    ).rejects.toThrow()
  })
})

describe('github: tarea → issue (cola de salida)', () => {
  it('completar o reabrir en Muninn se apunta; lo que hace la sincronización, no', async () => {
    const { github, user, store } = await setup()
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    await github.github.applyIssue(REPO, issue({ state: 'closed' }))
    expect(await user.github.outbox.pending()).toHaveLength(0)
    await user.tasks.reopen(r.task.id)
    await user.tasks.complete(r.task.id)
    expect((await user.github.outbox.pending()).map((e) => e.taskId)).toEqual([
      r.task.id,
      r.task.id,
    ])
    // Una tarea manual no se apunta nunca.
    const manual = await user.tasks.create({ projectId: r.task.projectId, title: 'manual' })
    await user.tasks.complete(manual.id)
    expect(await store.githubOutbox.pending({ maxAttempts: 5 })).toHaveLength(2)
  })

  it('con un envío pendiente, un evento de la issue no deshace lo de Muninn', async () => {
    const { github, user } = await setup()
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    await user.tasks.complete(r.task.id)
    // Alguien edita la issue (sigue abierta en GitHub) antes de que salga el cierre.
    const u = await github.github.applyIssue(REPO, issue({ title: 'Editada' }))
    expect(u.action).toBe('updated')
    const t = await user.tasks.get(r.task.id)
    expect(t).toMatchObject({ title: 'Editada' })
    expect(t?.completedAt).not.toBeNull()
  })

  it('cambiar el tipo de una columna a «hecho» también se apunta', async () => {
    const { github, user, project } = await setup()
    await github.github.applyIssue(REPO, issue())
    const todo = (await user.columns.list(project.id)).find((c) => c.kind === 'todo')
    await user.columns.update(todo?.id as string, { kind: 'done' })
    expect(await user.github.outbox.pending()).toHaveLength(1)
  })

  it('stateOf: cerrada si está en «hecho»; null si no viene de GitHub', async () => {
    const { github, user, project } = await setup()
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    expect(await user.github.stateOf(r.task.id)).toEqual({
      repo: REPO,
      number: 7,
      state: 'open',
      archived: false,
    })
    await user.tasks.complete(r.task.id)
    expect((await user.github.stateOf(r.task.id))?.state).toBe('closed')
    const manual = await user.tasks.create({ projectId: project.id, title: 'x' })
    expect(await user.github.stateOf(manual.id)).toBeNull()
  })

  it('drain cambia la issue solo si hace falta y vacía la cola', async () => {
    const { github, user } = await setup()
    const gh = fakeGithub({ [REPO]: [issue()] })
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    await user.tasks.complete(r.task.id)
    await user.tasks.reopen(r.task.id)
    await user.tasks.complete(r.task.id)
    const s = await drainGithubOutbox(github, gh.client)
    // Tres anotaciones de la misma tarea: un solo cambio, con el estado de ahora.
    expect(s).toEqual({ sent: 1, skipped: 0, failed: 0 })
    expect(gh.changes).toEqual([{ repo: REPO, number: 7, state: 'closed' }])
    expect(await user.github.outbox.pending()).toHaveLength(0)
    // Ya está cerrada: otra vuelta no hace nada.
    await user.tasks.reopen(r.task.id)
    await user.tasks.complete(r.task.id)
    expect(await drainGithubOutbox(github, gh.client)).toEqual({ sent: 0, skipped: 1, failed: 0 })
  })

  it('un fallo se reintenta hasta 5 veces y guarda el error', async () => {
    const { github, user, store } = await setup()
    const r = await github.github.applyIssue(REPO, issue())
    if (r.action !== 'created') throw new Error('debía crearse')
    await user.tasks.complete(r.task.id)
    const broken: GithubClient = {
      ...fakeGithub().client,
      async getIssue() {
        throw new Error('401 Bad credentials')
      },
    }
    for (let i = 0; i < 5; i++) {
      expect((await drainGithubOutbox(github, broken)).failed).toBe(1)
    }
    expect(await drainGithubOutbox(github, broken)).toEqual({ sent: 0, skipped: 0, failed: 0 })
    const [entry] = store.snapshot().githubOutbox
    expect(entry).toMatchObject({
      attempts: 5,
      lastError: '401 Bad credentials',
      processedAt: null,
    })
  })
})

describe('github: reconciliar', () => {
  it('importa lo abierto, completa lo cerrado y archiva lo que ya no existe', async () => {
    const { github, user, project } = await setup()
    const gh = fakeGithub({
      [REPO]: [issue(), issue({ number: 8, title: 'Otra' }), issue({ number: 9, title: 'Se va' })],
    })
    let s = await reconcileGithub(github, gh.client)
    expect(s.repos).toEqual([{ repo: 'Lopezz-Dev/Muninn', created: 3, updated: 0, archived: 0 }])

    const list = gh.issues[REPO] ?? []
    list[1] = { ...(list[1] as GithubIssue), state: 'closed' }
    gh.issues[REPO] = list.filter((i) => i.number !== 9)
    s = await reconcileGithub(github, gh.client)
    expect(s.repos[0]).toMatchObject({ created: 0, updated: 1, archived: 1 })
    const tasks = await user.tasks.list({ projectId: project.id, includeArchived: true })
    const byNumber = (n: number) => tasks.find((t) => t.externalId === `${REPO}#${n}`)
    expect(byNumber(8)?.column.kind).toBe('done')
    expect(byNumber(9)?.archivedAt).not.toBeNull()
    expect(byNumber(7)?.column.kind).toBe('todo')
  })

  it('lo completado en Muninn se envía antes y no se deshace', async () => {
    const { github, user } = await setup()
    const gh = fakeGithub({ [REPO]: [issue()] })
    await reconcileGithub(github, gh.client)
    const [task] = await user.tasks.list({ source: 'github' })
    await user.tasks.complete(task?.id as string)
    await reconcileGithub(github, gh.client)
    expect(gh.changes).toEqual([{ repo: REPO, number: 7, state: 'closed' }])
    expect((await user.tasks.get(task?.id as string))?.completedAt).not.toBeNull()
  })

  it('si no se pudo enviar, la reconciliación no la reabre', async () => {
    const { github, user } = await setup()
    const gh = fakeGithub({ [REPO]: [issue()] })
    await reconcileGithub(github, gh.client)
    const [task] = await user.tasks.list({ source: 'github' })
    await user.tasks.complete(task?.id as string)
    const readOnly: GithubClient = {
      ...gh.client,
      async setIssueState() {
        throw new Error('403 Resource not accessible by personal access token')
      },
    }
    const s = await reconcileGithub(github, readOnly)
    expect(s.outbox.failed).toBe(1)
    expect((await user.tasks.get(task?.id as string))?.completedAt).not.toBeNull()
  })

  it('un error en un repo no para los demás', async () => {
    const { github, user } = await setup()
    await user.projects.create({ name: 'Otro', githubRepo: 'lopezz-dev/otro' })
    const gh = fakeGithub({ 'lopezz-dev/otro': [issue({ number: 1 })] })
    const flaky: GithubClient = {
      ...gh.client,
      async listOpenIssues(repo) {
        if (repo.toLowerCase() === REPO) throw new Error('500')
        return gh.client.listOpenIssues(repo)
      },
    }
    const s = await reconcileGithub(github, flaky)
    expect(s.repos).toEqual([
      { repo: 'Lopezz-Dev/Muninn', created: 0, updated: 0, archived: 0, error: '500' },
      { repo: 'lopezz-dev/otro', created: 1, updated: 0, archived: 0 },
    ])
  })
})

describe('github: webhook', () => {
  it('verifica la firma HMAC del cuerpo', async () => {
    const body = '{"zen":"Keep it logically awesome."}'
    // Firma calculada aparte con: echo -n "$body" | openssl dgst -sha256 -hmac secreto
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('secreto'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const mac = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)),
    )
    const sig = `sha256=${[...mac].map((b) => b.toString(16).padStart(2, '0')).join('')}`
    expect(await verifyGithubSignature('secreto', body, sig)).toBe(true)
    expect(await verifyGithubSignature('otro', body, sig)).toBe(false)
    expect(await verifyGithubSignature('secreto', `${body} `, sig)).toBe(false)
    expect(await verifyGithubSignature('secreto', body, null)).toBe(false)
    expect(await verifyGithubSignature('', body, sig)).toBe(false)
    expect(sameSecret('abc', 'abc')).toBe(true)
    expect(sameSecret('abc', 'abd')).toBe(false)
    expect(sameSecret('', '')).toBe(false)
  })

  it('aplica los eventos de issues e ignora el resto', async () => {
    const { github, user } = await setup()
    const repository = { full_name: REPO }
    expect(await handleGithubWebhook(github, 'ping', {})).toEqual({
      status: 200,
      body: { ok: true },
    })
    expect((await handleGithubWebhook(github, 'push', {})).status).toBe(202)
    expect((await handleGithubWebhook(github, 'issues', { action: 'opened' })).status).toBe(400)
    const opened = await handleGithubWebhook(github, 'issues', {
      action: 'opened',
      issue: issue(),
      repository,
    })
    expect(opened.body.action).toBe('created')
    await handleGithubWebhook(github, 'issues', {
      action: 'closed',
      issue: issue({ state: 'closed' }),
      repository,
    })
    const [task] = await user.tasks.list({ source: 'github' })
    expect(task?.column.kind).toBe('done')
    const deleted = await handleGithubWebhook(github, 'issues', {
      action: 'deleted',
      issue: issue(),
      repository,
    })
    expect(deleted.body).toEqual({ action: 'archived' })
  })
})

describe('github: cliente REST', () => {
  it('pagina, salta los PRs y manda el token', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const page = (n: number, count: number) =>
      Array.from({ length: count }, (_, i) =>
        issue({ number: n * 1000 + i, ...(i === 0 ? { pull_request: {} } : {}) }),
      )
    const fetchFake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      const p = Number(new URL(url).searchParams.get('page'))
      return new Response(JSON.stringify(p === 1 ? page(1, 100) : page(2, 3)))
    }) as unknown as typeof fetch
    const gh = createGithubClient({ token: 't0k3n', fetch: fetchFake })
    const issues = await gh.listOpenIssues(REPO)
    expect(issues).toHaveLength(99 + 2)
    expect(calls).toHaveLength(2)
    expect(calls[0]?.url).toBe(
      `https://api.github.com/repos/${REPO}/issues?state=open&per_page=100&page=1`,
    )
    const headers = (calls[0]?.init?.headers ?? {}) as Record<string, string>
    expect(headers.authorization).toBe('Bearer t0k3n')
  })

  it('404, 410 y transferidas son «no existe»; cerrar manda state_reason', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    let next: Response = new Response('', { status: 404 })
    const fetchFake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return next
    }) as unknown as typeof fetch
    const gh = createGithubClient({ token: 't', fetch: fetchFake })
    expect(await gh.getIssue(REPO, 1)).toBeNull()
    next = new Response('', { status: 410 })
    expect(await gh.getIssue(REPO, 1)).toBeNull()
    next = new Response(
      JSON.stringify({ ...issue(), repository_url: 'https://api.github.com/repos/otro/sitio' }),
    )
    expect(await gh.getIssue(REPO, 1)).toBeNull()
    next = new Response(
      JSON.stringify({ ...issue(), repository_url: `https://api.github.com/repos/${REPO}` }),
    )
    expect((await gh.getIssue(REPO, 1))?.number).toBe(7)
    next = new Response('', { status: 200 })
    await gh.setIssueState(REPO, 7, 'closed')
    expect(calls.at(-1)?.init?.method).toBe('PATCH')
    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({
      state: 'closed',
      state_reason: 'completed',
    })
    next = new Response('Bad credentials', { status: 401 })
    await expect(gh.setIssueState(REPO, 7, 'open')).rejects.toThrow('401')
  })
})

describe('github: repos para vincular', () => {
  const repo = (full_name: string, over: Record<string, unknown> = {}) => ({
    full_name,
    private: true,
    description: null,
    archived: false,
    has_issues: true,
    ...over,
  })

  it('el cliente pagina, deja fuera los archivados y los que no tienen issues, y ordena', async () => {
    const urls: string[] = []
    const fetchFake = (async (url: string) => {
      urls.push(url)
      const p = Number(new URL(url).searchParams.get('page'))
      const first = Array.from({ length: 100 }, (_, i) =>
        repo(`lopezz-dev/r${String(i).padStart(3, '0')}`, { archived: i > 0 }),
      )
      return new Response(
        JSON.stringify(
          p === 1
            ? first
            : [
                repo('lopezz-dev/huginnDB', { private: false, description: 'Base de datos' }),
                repo('Lopezz-Dev/Alfa'),
                repo('lopezz-dev/sin-issues', { has_issues: false }),
              ],
        ),
      )
    }) as unknown as typeof fetch
    const gh = createGithubClient({ token: 't', fetch: fetchFake })
    expect(await gh.listRepos()).toEqual([
      { fullName: 'Lopezz-Dev/Alfa', private: true, description: null },
      { fullName: 'lopezz-dev/huginnDB', private: false, description: 'Base de datos' },
      { fullName: 'lopezz-dev/r000', private: true, description: null },
    ])
    expect(urls).toEqual([
      'https://api.github.com/user/repos?per_page=100&page=1',
      'https://api.github.com/user/repos?per_page=100&page=2',
    ])
  })

  it('el servicio devuelve null si el store no sabe preguntarlo y valida lo que llega', async () => {
    const { user, store } = await setup()
    expect(await user.github.repos()).toBeNull()
    let answer: unknown[] = [{ fullName: 'lopezz-dev/huginnDB', private: false, description: null }]
    const withRepos = createMuninn(
      { ...store, githubRepos: { list: async () => answer as never } },
      { timeZone: 'UTC' },
    )
    expect(await withRepos.github.repos()).toEqual(answer)
    answer = [{ fullName: 'no es un repo', private: false, description: null }]
    await expect(withRepos.github.repos()).rejects.toThrow('owner/repo')
  })

  it('lee el token de la cabecera Authorization', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def')
    expect(bearerToken('bearer abc')).toBe('abc')
    expect(bearerToken('Basic abc')).toBeNull()
    expect(bearerToken('Bearer ')).toBeNull()
    expect(bearerToken(null)).toBeNull()
  })
})
