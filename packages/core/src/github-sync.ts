import type { GithubIssue, GithubIssueState, GithubRepoSummary } from './schemas'
import type { Muninn } from './service'
import { NotFoundError } from './store'

/**
 * Sincronización issues ↔ tareas (ADR-0031). Todo lo que no necesita secretos ni red real vive aquí,
 * con tests: la Edge Function (`supabase/functions/github`) solo lee sus variables de entorno y
 * llama a estas funciones. Usa `fetch` y `crypto.subtle`, que existen en Deno, Node y el navegador.
 */

const API = 'https://api.github.com'

export interface GithubClient {
  /** Issues abiertas del repo (sin PRs), todas las páginas. */
  listOpenIssues(repo: string): Promise<GithubIssue[]>
  /** La issue, o `null` si ya no existe (borrada o transferida: 404/410). */
  getIssue(repo: string, issueNumber: number): Promise<GithubIssue | null>
  setIssueState(repo: string, issueNumber: number, state: GithubIssueState): Promise<void>
  /**
   * Repos que ve el token y que se pueden sincronizar (sin archivar y con issues), por nombre. Ojo: incluye
   * todos los públicos de la cuenta, aunque el token no pueda escribir en ellos (ver `canWriteIssues`).
   */
  listRepos(): Promise<GithubRepoSummary[]>
  /** Si el token puede crear y cerrar issues en el repo (lo que necesita la sincronización). */
  canWriteIssues(repo: string): Promise<boolean>
}

/** Lo que usa `listRepos` de cada repo de `GET /user/repos`. */
interface ApiRepo {
  full_name: string
  private: boolean
  description: string | null
  archived?: boolean
  has_issues?: boolean
}

export class GithubApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'GithubApiError'
  }
}

/** Cliente mínimo de la API REST de GitHub con un token (fine-grained: Issues lectura y escritura). */
export function createGithubClient(options: {
  token: string
  fetch?: typeof fetch
  /** Tope de páginas de 100 issues por repo (por si un repo tiene miles). */
  maxPages?: number
}): GithubClient {
  const http = options.fetch ?? globalThis.fetch
  const maxPages = options.maxPages ?? 10
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await http(`${API}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${options.token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'muninn-sync',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    })
    return res
  }
  const fail = async (res: Response, what: string) => {
    const text = await res.text().catch(() => '')
    return new GithubApiError(res.status, `${what}: ${res.status} ${text.slice(0, 200)}`.trim())
  }

  return {
    async listOpenIssues(repo) {
      const out: GithubIssue[] = []
      for (let page = 1; page <= maxPages; page++) {
        const res = await call(`/repos/${repo}/issues?state=open&per_page=100&page=${page}`)
        if (!res.ok) throw await fail(res, `Listar issues de ${repo}`)
        const batch = (await res.json()) as GithubIssue[]
        out.push(...batch.filter((i) => i.pull_request === undefined))
        if (batch.length < 100) break
      }
      return out
    },
    async getIssue(repo, issueNumber) {
      const res = await call(`/repos/${repo}/issues/${issueNumber}`)
      if (res.status === 404 || res.status === 410) return null
      if (!res.ok) throw await fail(res, `Leer ${repo}#${issueNumber}`)
      const issue = (await res.json()) as GithubIssue & { repository_url?: string }
      // Una issue transferida responde con la de su repo nuevo: para este repo ya no existe.
      if (
        issue.repository_url &&
        !issue.repository_url.toLowerCase().endsWith(`/repos/${repo.toLowerCase()}`)
      ) {
        return null
      }
      return issue
    },
    async setIssueState(repo, issueNumber, state) {
      const res = await call(`/repos/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        body: JSON.stringify(
          state === 'closed'
            ? { state, state_reason: 'completed' }
            : { state, state_reason: 'reopened' },
        ),
      })
      if (!res.ok) throw await fail(res, `Cambiar el estado de ${repo}#${issueNumber}`)
    },
    async listRepos() {
      // Todo token lee los repos públicos: `/user/repos` los da aunque no sean de los que se le dieron. Un privado
      // que sale sí es del token; un público se comprueba con `canWriteIssues` al elegirlo (ADR-0035).
      const out: GithubRepoSummary[] = []
      for (let page = 1; page <= maxPages; page++) {
        const res = await call(`/user/repos?per_page=100&page=${page}`)
        if (!res.ok) throw await fail(res, 'Listar repositorios')
        const batch = (await res.json()) as ApiRepo[]
        for (const r of batch) {
          // En un repo archivado no se puede cerrar una issue; sin issues no hay nada que traer.
          if (r.archived || r.has_issues === false) continue
          out.push({ fullName: r.full_name, private: r.private, description: r.description })
        }
        if (batch.length < 100) break
      }
      return out.sort((a, b) => (a.fullName.toLowerCase() < b.fullName.toLowerCase() ? -1 : 1))
    },
    async canWriteIssues(repo) {
      // Se pide crear una issue sin título: con permiso, GitHub responde 422 (falta el título); sin él, 403 o
      // 404 (410: el repo tiene las issues desactivadas). En ningún caso se crea nada.
      const res = await call(`/repos/${repo}/issues`, { method: 'POST', body: '{}' })
      if (res.status === 422) return true
      if (res.status === 403 || res.status === 404 || res.status === 410) return false
      throw await fail(res, `Comprobar el acceso a ${repo}`)
    },
  }
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Compara sin cortar en el primer carácter distinto (no da pistas por tiempo). */
function sameText(a: string, b: string) {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

/** Comprueba `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo tal cual llegó, con el secreto del webhook). */
export async function verifyGithubSignature(
  secret: string,
  body: string,
  header: string | null | undefined,
) {
  if (!secret || !header?.startsWith('sha256=')) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return sameText(`sha256=${hex(mac)}`, header)
}

/** También para el secreto de `/sync`: comparación de tiempo constante. */
export const sameSecret = (expected: string, given: string | null | undefined) =>
  Boolean(expected) && typeof given === 'string' && sameText(expected, given)

/** El JWT de `Authorization: Bearer …` (la sesión del usuario, para `/repos`), o `null`. */
export function bearerToken(header: string | null | undefined) {
  return header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null
}

export interface WebhookResult {
  status: number
  body: Record<string, unknown>
}

interface IssuesPayload {
  action?: string
  issue?: GithubIssue
  repository?: { full_name?: string }
}

/**
 * Atiende un evento de GitHub ya verificado. Solo `issues` (y `ping`); lo demás se acepta y se ignora
 * (202), para que GitHub no lo marque como fallo.
 */
export async function handleGithubWebhook(
  m: Muninn,
  event: string | null,
  payload: unknown,
): Promise<WebhookResult> {
  if (event === 'ping') return { status: 200, body: { ok: true } }
  if (event !== 'issues') return { status: 202, body: { ignored: event ?? 'sin evento' } }
  const p = (payload ?? {}) as IssuesPayload
  const repo = p.repository?.full_name
  if (!repo || !p.issue) return { status: 400, body: { error: 'Falta la issue o el repositorio' } }
  if (p.action === 'deleted' || p.action === 'transferred') {
    const task = await m.github.removeIssue(repo, p.issue.number)
    return { status: 200, body: { action: task ? 'archived' : 'unchanged' } }
  }
  const result = await m.github.applyIssue(repo, p.issue)
  return {
    status: 200,
    body: result.action === 'ignored' ? result : { action: result.action, taskId: result.task.id },
  }
}

// ─── Cola de salida y reconciliación ─────────────────────────────────────────

export interface DrainSummary {
  /** Issues cuyo estado se cambió en GitHub. */
  sent: number
  /** Ya estaban como debían, o la tarea/issue ya no existe. */
  skipped: number
  failed: number
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * Lleva a GitHub lo que se completó o reabrió en Muninn. Relee cada tarea (si se completó y reabrió
 * varias veces, cuenta el estado de ahora) y solo cambia la issue si no está ya así.
 */
export async function drainGithubOutbox(m: Muninn, gh: GithubClient, limit = 50) {
  const summary: DrainSummary = { sent: 0, skipped: 0, failed: 0 }
  const entries = await m.github.outbox.pending(limit)
  const byTask = new Map<string, typeof entries>()
  for (const e of entries) byTask.set(e.taskId, [...(byTask.get(e.taskId) ?? []), e])
  for (const [taskId, group] of byTask) {
    try {
      const want = await m.github.stateOf(taskId).catch((err) => {
        if (err instanceof NotFoundError) return null
        throw err
      })
      const issue = want && !want.archived ? await gh.getIssue(want.repo, want.number) : null
      if (want && issue && issue.state !== want.state) {
        await gh.setIssueState(want.repo, want.number, want.state)
        summary.sent++
      } else summary.skipped++
      await m.github.outbox.settle(group)
    } catch (err) {
      summary.failed++
      await m.github.outbox.settle(group, message(err))
    }
  }
  return summary
}

export interface ReconcileSummary {
  outbox: DrainSummary
  repos: {
    repo: string
    created: number
    updated: number
    archived: number
    error?: string
  }[]
}

/**
 * Sincronización completa (la de «cada pocos minutos», por si se perdió algún webhook):
 * 1. vacía la cola de salida (lo de Muninn va primero, para no deshacerlo);
 * 2. aplica todas las issues abiertas de cada repo vinculado;
 * 3. las tareas abiertas en Muninn cuya issue ya no está abierta se consultan una a una: si se cerró, se
 *    completan; si ya no existe, se archivan. Las que aún tienen un cambio pendiente de enviar no se tocan.
 */
export async function reconcileGithub(
  m: Muninn,
  gh: GithubClient,
  options: { maxLookups?: number } = {},
): Promise<ReconcileSummary> {
  const outbox = await drainGithubOutbox(m, gh)
  const pending = new Set((await m.github.outbox.pending(500)).map((e) => e.taskId))
  let lookups = options.maxLookups ?? 50
  const repos: ReconcileSummary['repos'] = []

  for (const project of await m.github.linkedProjects()) {
    const repo = project.githubRepo as string
    const row = { repo, created: 0, updated: 0, archived: 0 } as ReconcileSummary['repos'][number]
    repos.push(row)
    try {
      const open = await gh.listOpenIssues(repo)
      const openNumbers = new Set(open.map((i) => i.number))
      for (const issue of open) {
        const r = await m.github.applyIssue(repo, issue)
        if (r.action === 'created') row.created++
        if (r.action === 'updated') row.updated++
      }
      for (const task of await m.github.openTasks(project.id)) {
        if (pending.has(task.id)) continue
        const ref = await m.github.stateOf(task.id)
        if (!ref || ref.repo !== repo.toLowerCase() || openNumbers.has(ref.number)) continue
        if (lookups-- <= 0) break
        const issue = await gh.getIssue(repo, ref.number)
        if (!issue) {
          if (await m.github.removeIssue(repo, ref.number)) row.archived++
        } else if ((await m.github.applyIssue(repo, issue)).action === 'updated') row.updated++
      }
    } catch (err) {
      row.error = message(err)
    }
  }
  return { outbox, repos }
}
