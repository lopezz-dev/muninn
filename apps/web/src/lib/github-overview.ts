import type {
  Activity,
  AgentAction,
  GithubRepoSummary,
  Project,
  TaskWithColumn,
} from '@muninn/core'
import { issueNumber } from '../components/task-meta'
import { sameRepo } from './text'

/**
 * Lo que pinta la pantalla GitHub a partir de los datos que ya hay: proyectos con repo, tareas de GitHub,
 * repos a los que llega el token y la actividad del agente (ADR-0031, ADR-0032).
 */

type ProjectLink = Pick<Project, 'id' | 'name' | 'color' | 'githubRepo' | 'agentColumnId'>
type GithubTask = Pick<
  TaskWithColumn,
  'id' | 'title' | 'projectId' | 'columnId' | 'externalId' | 'archivedAt' | 'updatedAt' | 'column'
>

export interface RepoRow {
  repo: string
  /** El proyecto vinculado, o `null` si el token llega al repo pero no está vinculado. */
  project: ProjectLink | null
  /** Tareas de la issue sin completar ni archivar: las issues abiertas que ve Muninn. */
  open: number
  /** El último cambio de una tarea de este repo, o `null` si aún no ha llegado ninguna. */
  last: string | null
  private?: boolean
}

/**
 * Filas de la tabla: primero los repos vinculados (por nombre), luego los que ve el token sin vincular.
 * `repos` es `null` si este modo no puede preguntar al token (demo): entonces solo salen los vinculados.
 */
export function repoRows(
  projects: ProjectLink[],
  tasks: GithubTask[],
  repos: GithubRepoSummary[] | null,
): RepoRow[] {
  const linked = projects
    .filter((p): p is ProjectLink & { githubRepo: string } => Boolean(p.githubRepo))
    .map((p): RepoRow => {
      const own = tasks.filter((t) => t.projectId === p.id)
      const listed = repos?.find((r) => sameRepo(r.fullName, p.githubRepo))
      return {
        repo: listed?.fullName ?? p.githubRepo,
        project: p,
        open: own.filter((t) => !t.archivedAt && t.column.kind !== 'done').length,
        last: own.reduce<string | null>(
          (max, t) => (!max || t.updatedAt > max ? t.updatedAt : max),
          null,
        ),
        private: listed?.private,
      }
    })
    .sort((a, b) => a.repo.localeCompare(b.repo))
  const free = (repos ?? [])
    .filter((r) => !linked.some((l) => sameRepo(l.repo, r.fullName)))
    .map(
      (r): RepoRow => ({
        repo: r.fullName,
        project: null,
        open: 0,
        last: null,
        private: r.private,
      }),
    )
    .sort((a, b) => a.repo.localeCompare(b.repo))
  return [...linked, ...free]
}

export interface ProjectChoice {
  value: string
  label: string
  dot?: string
  hint?: string
  disabled?: boolean
  tone?: string
}

/**
 * Proyectos que se pueden elegir para `repo`: «Sin vincular» (`''`) y los proyectos. Uno que ya va con otro
 * repo sale deshabilitado (un repo por proyecto): primero hay que desvincularlo.
 */
export function projectChoices(
  repo: string,
  projects: ProjectLink[],
): { value: string; options: ProjectChoice[] } {
  const current = projects.find((p) => p.githubRepo && sameRepo(p.githubRepo, repo))
  const options: ProjectChoice[] = [{ value: '', label: 'Sin vincular', tone: 'text-fg-muted' }]
  for (const p of projects) {
    const other = p.githubRepo && !sameRepo(p.githubRepo, repo) ? p.githubRepo : null
    options.push({
      value: p.id,
      label: p.name,
      dot: p.color,
      hint: other ? `con ${other}` : undefined,
      disabled: Boolean(other),
    })
  }
  return { value: current?.id ?? '', options }
}

export type RunState = 'working' | 'review' | 'merged' | 'closed' | 'stopped'

export interface AgentRun {
  taskId: string
  title: string
  state: RunState
  /** `owner/repo #n` de la issue. */
  repo: string | null
  issue: number | null
  /** El PR, si lo hubo. */
  pr: { number: number; url: string | null } | null
  /** Cuándo pasó (para «Trabajando», cuándo entró en la columna; aproximado con el último cambio). */
  at: string
}

const STATE_OF: Record<AgentAction, RunState> = {
  agent_pr_opened: 'review',
  agent_pr_merged: 'merged',
  agent_pr_closed: 'closed',
  agent_stopped: 'stopped',
}

/** Las acciones del agente que se piden a la actividad (`AGENT_ACTIONS` del core, sin importarlo como valor). */
export const RUN_ACTIONS = Object.keys(STATE_OF) as AgentAction[]

/**
 * «Ejecuciones recientes»: las tareas que están ahora en la columna del agente («Trabajando») y, del resto,
 * el último paso del agente de cada tarea (PR abierto, fusionado, cerrado o sin PR). Lo más reciente arriba.
 * `activity` son los eventos del agente (más recientes primero), como los da `recentActivity`.
 */
export function agentRuns(
  activity: Pick<Activity, 'entityId' | 'action' | 'payload' | 'createdAt'>[],
  tasks: GithubTask[],
  projects: ProjectLink[],
  limit = 6,
): AgentRun[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  // El repo sale de la issue (`owner/repo#n`, en minúsculas), no del proyecto: el repo pudo cambiar de
  // proyecto después. Con las mayúsculas de GitHub si es el de algún proyecto.
  const repoOf = (t: GithubTask) => {
    const repo = t.externalId?.replace(/#\d+$/, '') || null
    const linked = projects.find((p) => p.githubRepo && repo && sameRepo(p.githubRepo, repo))
    return linked?.githubRepo ?? repo
  }
  const base = (t: GithubTask) => ({
    taskId: t.id,
    title: t.title,
    repo: repoOf(t),
    issue: issueNumber(t.externalId),
  })
  const runs: AgentRun[] = []
  const seen = new Set<string>()

  for (const p of projects) {
    if (!p.githubRepo || !p.agentColumnId) continue
    for (const t of tasks) {
      if (t.projectId !== p.id || t.columnId !== p.agentColumnId || t.archivedAt) continue
      seen.add(t.id)
      runs.push({ ...base(t), state: 'working', pr: null, at: t.updatedAt })
    }
  }
  for (const a of activity) {
    const state = STATE_OF[a.action as AgentAction]
    const t = byId.get(a.entityId)
    if (!state || !t || seen.has(t.id)) continue
    seen.add(t.id)
    const p = a.payload as { number?: unknown; url?: unknown }
    const pr =
      typeof p.number === 'number'
        ? {
            number: p.number,
            url:
              typeof p.url === 'string' && p.url.startsWith('https://github.com/') ? p.url : null,
          }
        : null
    runs.push({ ...base(t), state, pr, at: a.createdAt })
  }
  return runs.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

/** Lo que devuelve «Sincronizar ahora» (`POST /github/sync` con `all`), leído con cuidado: viene del servidor. */
export interface SyncResult {
  created: number
  updated: number
  archived: number
  /** Repos que fallaron, con su error. */
  errors: { repo: string; error: string }[]
}

export function readSyncResult(data: unknown): SyncResult | null {
  const repos = (data as { repos?: unknown } | null)?.repos
  if (!Array.isArray(repos)) return null
  const result: SyncResult = { created: 0, updated: 0, archived: 0, errors: [] }
  for (const r of repos as Record<string, unknown>[]) {
    const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : 0)
    result.created += n('created')
    result.updated += n('updated')
    result.archived += n('archived')
    if (typeof r.error === 'string' && typeof r.repo === 'string') {
      result.errors.push({ repo: r.repo, error: r.error })
    }
  }
  return result
}

/** «2 issues nuevas y 1 cambiada», o «Todo estaba al día». */
export function describeSync(r: SyncResult): string {
  const parts: string[] = []
  if (r.created) parts.push(`${r.created} ${r.created === 1 ? 'issue nueva' : 'issues nuevas'}`)
  if (r.updated) parts.push(`${r.updated} ${r.updated === 1 ? 'cambiada' : 'cambiadas'}`)
  if (r.archived) parts.push(`${r.archived} ${r.archived === 1 ? 'archivada' : 'archivadas'}`)
  if (parts.length === 0) return 'Todo estaba al día'
  return parts.length === 1
    ? (parts[0] as string)
    : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`
}
