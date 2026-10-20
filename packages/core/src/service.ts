import type { z } from 'zod'
import { DEFAULT_SETTINGS } from './memory-store'
import { positionAt, positionsFor } from './ordering'
import {
  type Activity,
  type ActorKind,
  type BoardColumn,
  type ChecklistItem,
  type ColumnKind,
  type CreateColumnInput,
  type CreateNoteInput,
  type CreateProjectInput,
  type CreateTaskInput,
  createColumnInput,
  createNoteInput,
  createProjectInput,
  createTaskInput,
  type GithubIssue,
  type GithubIssueState,
  type GithubPullRequest,
  type GithubSyncScope,
  githubIssue,
  githubPullRequest,
  githubRepo,
  githubRepoList,
  githubSyncScope,
  type MoveTaskInput,
  moveTaskInput,
  type Note,
  type NoteQuery,
  noteQuery,
  type OutboxKind,
  type Project,
  type Task,
  type TaskQuery,
  type TaskSource,
  taskQuery,
  type UpdateColumnInput,
  type UpdateNoteInput,
  type UpdateProjectInput,
  type UpdateSettingsInput,
  type UpdateTaskInput,
  type UserSettings,
  updateColumnInput,
  updateNoteInput,
  updateProjectInput,
  updateSettingsInput,
  updateTaskInput,
} from './schemas'
import { NotFoundError, type OutboxEntry, type Store } from './store'

export const DEFAULT_COLUMNS: { name: string; kind: ColumnKind }[] = [
  { name: 'Backlog', kind: 'backlog' },
  { name: 'Pendiente', kind: 'todo' },
  { name: 'En curso', kind: 'in_progress' },
  { name: 'Revisión', kind: 'review' },
  { name: 'Hecho', kind: 'done' },
]

const OPEN_ACTIVE_KINDS: ColumnKind[] = ['in_progress', 'review']

const AGENT_ONLY_GITHUB = 'Solo las tareas de GitHub pueden ir al agente'

/** Intentos de llevar un estado a GitHub antes de dejarlo (con su error a la vista). */
export const GITHUB_MAX_ATTEMPTS = 5

/**
 * `external_id` de una tarea que viene de una issue: `owner/repo#123`, con el repo en minúsculas
 * (GitHub no distingue mayúsculas en los nombres; así `Lopezz-Dev/Muninn` es la misma issue).
 */
export const githubExternalId = (repo: string, issueNumber: number) =>
  `${repo.toLowerCase()}#${issueNumber}`

/** Lo contrario de `githubExternalId`; `null` si no tiene esa forma. */
export function parseGithubExternalId(externalId: string) {
  const m = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)$/.exec(externalId)
  return m ? { repo: m[1] as string, number: Number(m[2]) } : null
}

/** Nombres de las etiquetas de una issue, limpios y dentro de los límites de una tarea. */
function issueLabels(issue: GithubIssue): string[] {
  const names = (issue.labels ?? [])
    .map((l) => (typeof l === 'string' ? l : (l.name ?? '')).trim().slice(0, 40))
    .filter(Boolean)
  return [...new Set(names)].slice(0, 20)
}

/**
 * Número de la issue que resuelve un PR del agente: el de su rama `agent/issue-<n>` o, en una rama
 * `agent/…` con otro nombre, el de `Closes|Fixes|Resolves #n` en la descripción. `null` si no es del agente.
 */
export function agentIssueNumber(pr: { head: { ref: string }; body?: string | null }) {
  const branch = /^agent\/issue-(\d+)(?:\D|$)/.exec(pr.head.ref)
  if (branch) return Number(branch[1])
  if (!pr.head.ref.startsWith('agent/')) return null
  const body = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/i.exec(pr.body ?? '')
  return body ? Number(body[1]) : null
}

export type GithubPullResult =
  | { action: 'review' | 'completed' | 'returned' | 'unchanged'; task: Task }
  | { action: 'ignored'; reason: 'not-agent' | 'no-task' | 'archived' }

export type GithubApplyResult =
  | { action: 'created' | 'updated' | 'unchanged'; task: Task }
  | { action: 'ignored'; reason: 'pull-request' | 'no-project' | 'closed' | 'archived' }

export interface MuninnOptions {
  /** Quién actúa: queda registrado en la actividad y decide el `source` por defecto de las tareas. */
  actor?: ActorKind
  /** Reloj inyectable (tests). */
  now?: () => Date
  /** Zona horaria para calcular "hoy" en fechas de vencimiento. Por defecto, la del sistema. */
  timeZone?: string
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export type TaskWithColumn = Task & { column: Pick<BoardColumn, 'id' | 'name' | 'kind'> }

export interface ProjectStatusReport {
  project: Project
  columns: (Pick<BoardColumn, 'id' | 'name' | 'kind' | 'wipLimit'> & { count: number })[]
  counts: {
    open: number
    done: number
    overdue: number
    dueToday: number
    dueThisWeek: number
    completedLast7Days: number
  }
  inProgress: TaskWithColumn[]
  overdue: TaskWithColumn[]
  upcoming: TaskWithColumn[]
  recentActivity: Activity[]
}

export interface OverviewReport {
  today: string
  projects: {
    id: string
    name: string
    color: string
    open: number
    inProgress: number
    overdue: number
    done: number
  }[]
  overdue: (TaskWithColumn & { projectName: string })[]
  dueToday: (TaskWithColumn & { projectName: string })[]
  /** Vencen en los próximos 7 días, sin contar hoy, por fecha. */
  upcoming: (TaskWithColumn & { projectName: string })[]
  inProgress: (TaskWithColumn & { projectName: string })[]
  completedToday: number
  /** Las completadas hoy, la más reciente primero. */
  completedTodayTasks: (TaskWithColumn & { projectName: string })[]
  /** Completadas por día en los últimos 7 días (el último es hoy). */
  completedByDay: { date: string; count: number }[]
}

export type Muninn = ReturnType<typeof createMuninn>

/**
 * API de dominio de Muninn. Todo cliente (UI, MCP, agentes, sync de GitHub) pasa por aquí:
 * valida entradas, mantiene el orden del tablero, la semántica de "hecho" y el log de actividad.
 */
export function createMuninn(store: Store, options: MuninnOptions = {}) {
  const actor = options.actor ?? 'user'
  const clock = options.now ?? (() => new Date())
  const nowIso = () => clock().toISOString()
  const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: options.timeZone })
  const today = () => dateFmt.format(clock())
  const addDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const defaultSource: TaskSource =
    actor === 'mcp' ? 'mcp' : actor === 'agent' ? 'agent' : actor === 'github' ? 'github' : 'manual'

  const log = (
    entityType: Activity['entityType'],
    entityId: string,
    action: string,
    projectId: string | null,
    payload: Record<string, unknown> = {},
  ) => store.activity.insert({ entityType, entityId, action, projectId, actor, payload })

  const parse = <S extends z.ZodType>(schema: S, value: unknown): z.output<S> => {
    const r = schema.safeParse(value)
    if (!r.success) {
      const msg = r.error.issues
        .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
        .join('; ')
      throw new ValidationError(msg)
    }
    return r.data
  }

  const must = async <T>(p: Promise<T | null>, entity: string, id: string) => {
    const v = await p
    if (!v) throw new NotFoundError(entity, id)
    return v
  }

  /** Inserta/mueve con clave de orden; persiste el rebalanceo si hubo colisión. */
  async function place(
    collection: 'projects' | 'columns' | 'tasks' | 'checklist',
    siblings: { id: string; position: string }[],
    index?: number,
  ) {
    const { position, rebalance } = positionAt(siblings, index)
    if (rebalance) {
      for (const r of rebalance) await store[collection].update(r.id, { position: r.position })
    }
    return position
  }

  // ─── Proyectos ─────────────────────────────────────────────────────────────

  async function getProject(id: string) {
    return must(store.projects.get(id), 'Proyecto', id)
  }

  async function listProjects(opts: { includeArchived?: boolean } = {}) {
    return store.projects.list({
      statuses: opts.includeArchived ? undefined : ['active', 'paused'],
    })
  }

  async function createProject(input: CreateProjectInput) {
    const data = parse(createProjectInput, input)
    const siblings = await store.projects.list({})
    const project = await store.projects.insert({
      name: data.name,
      description: data.description ?? '',
      color: data.color ?? 'blue',
      icon: data.icon ?? null,
      githubRepo: data.githubRepo ?? null,
      agentColumnId: null,
      status: 'active',
      position: await place('projects', siblings),
    })
    const positions = positionsFor(DEFAULT_COLUMNS.length)
    for (const [i, c] of DEFAULT_COLUMNS.entries()) {
      await store.columns.insert({
        projectId: project.id,
        name: c.name,
        kind: c.kind,
        color: null,
        wipLimit: null,
        position: positions[i] as string,
      })
    }
    await log('project', project.id, 'created', project.id, { name: project.name })
    return project
  }

  async function updateProject(id: string, input: UpdateProjectInput) {
    const patch = parse(updateProjectInput, input)
    await getProject(id)
    if (patch.agentColumnId) {
      const column = await must(
        store.columns.get(patch.agentColumnId),
        'Columna',
        patch.agentColumnId,
      )
      if (column.projectId !== id)
        throw new ValidationError('La columna no pertenece a ese proyecto')
      if (column.kind === 'done') {
        throw new ValidationError('La columna del agente no puede ser de tipo «Hecho»')
      }
    }
    const project = await store.projects.update(id, patch)
    await log('project', id, patch.status === 'archived' ? 'archived' : 'updated', id, patch)
    return project
  }

  async function moveProject(id: string, index: number) {
    await getProject(id)
    const siblings = (await store.projects.list({})).filter((p) => p.id !== id)
    return store.projects.update(id, { position: await place('projects', siblings, index) })
  }

  // ─── Columnas ──────────────────────────────────────────────────────────────

  async function listColumns(projectId: string) {
    return store.columns.list({ projectId })
  }

  async function createColumn(input: CreateColumnInput) {
    const data = parse(createColumnInput, input)
    await getProject(data.projectId)
    const siblings = await listColumns(data.projectId)
    const column = await store.columns.insert({
      projectId: data.projectId,
      name: data.name,
      kind: data.kind,
      color: data.color ?? null,
      wipLimit: data.wipLimit ?? null,
      position: await place('columns', siblings, data.index),
    })
    await log('column', column.id, 'created', data.projectId, { name: column.name })
    return column
  }

  async function updateColumn(id: string, input: UpdateColumnInput) {
    const patch = parse(updateColumnInput, input)
    const before = await must(store.columns.get(id), 'Columna', id)
    if (patch.kind === 'done' && (await agentColumnOf(before.projectId)) === id) {
      throw new ValidationError('La columna del agente no puede ser de tipo «Hecho»')
    }
    const column = await store.columns.update(id, patch)
    // Cambiar la semántica de la columna cambia el estado "hecho" de sus tareas.
    if (patch.kind && (patch.kind === 'done') !== (before.kind === 'done')) {
      const tasks = await store.tasks.list({ columnIds: [id] })
      for (const t of tasks) {
        await store.tasks.update(t.id, { completedAt: patch.kind === 'done' ? nowIso() : null })
        await queueGithubState(t)
      }
    }
    await log('column', id, 'updated', column.projectId, patch)
    return column
  }

  async function moveColumn(id: string, index: number) {
    const column = await must(store.columns.get(id), 'Columna', id)
    const siblings = (await listColumns(column.projectId)).filter((c) => c.id !== id)
    return store.columns.update(id, { position: await place('columns', siblings, index) })
  }

  async function deleteColumn(id: string, opts: { moveTasksTo?: string } = {}) {
    const column = await must(store.columns.get(id), 'Columna', id)
    const columns = await listColumns(column.projectId)
    if (columns.length <= 1) throw new ValidationError('Un proyecto necesita al menos una columna')
    const tasks = await store.tasks.list({ columnIds: [id], includeArchived: true })
    if (tasks.length > 0) {
      if (!opts.moveTasksTo) {
        throw new ValidationError(
          `La columna tiene ${tasks.length} tareas: indica a qué columna moverlas`,
        )
      }
      for (const t of tasks) await moveTask(t.id, { columnId: opts.moveTasksTo })
    }
    // En Supabase lo hace la clave ajena (`on delete set null`); el store de memoria no la tiene.
    if ((await agentColumnOf(column.projectId)) === id) {
      await store.projects.update(column.projectId, { agentColumnId: null })
    }
    await store.columns.remove(id)
    await log('column', id, 'deleted', column.projectId, { name: column.name })
    // En su orden de la columna, incluidas las archivadas: así se puede deshacer devolviéndolas.
    return { movedTaskIds: tasks.map((t) => t.id) }
  }

  // ─── Tareas ────────────────────────────────────────────────────────────────

  async function getTask(id: string) {
    return must(store.tasks.get(id), 'Tarea', id)
  }

  /** Columnas indexadas por id, de un proyecto o de todos los no archivados. */
  async function columnIndex(projectId?: string) {
    const projectIds = projectId ? [projectId] : (await listProjects()).map((p) => p.id)
    const all = (await Promise.all(projectIds.map((id) => listColumns(id)))).flat()
    return new Map(all.map((c) => [c.id, c]))
  }

  const withColumn = (t: Task, cols: Map<string, BoardColumn>): TaskWithColumn => {
    const c = cols.get(t.columnId)
    return { ...t, column: { id: t.columnId, name: c?.name ?? '?', kind: c?.kind ?? 'todo' } }
  }

  async function listTasks(query: TaskQuery = {}): Promise<TaskWithColumn[]> {
    const q = parse(taskQuery, query)
    const cols = await columnIndex(q.projectId)
    let columnIds = q.columnId ? [q.columnId] : undefined
    if (q.kinds) {
      const byKind = [...cols.values()].filter((c) => q.kinds?.includes(c.kind)).map((c) => c.id)
      columnIds = columnIds ? columnIds.filter((id) => byKind.includes(id)) : byKind
    }
    // Sin proyecto concreto, limitamos a columnas de proyectos no archivados.
    if (!q.projectId && !columnIds) columnIds = [...cols.keys()]
    const tasks = await store.tasks.list({
      projectId: q.projectId,
      columnIds,
      priority: q.priority,
      source: q.source,
      dueBefore: q.dueBefore,
      search: q.search,
      includeArchived: q.includeArchived,
      limit: q.limit,
    })
    return tasks.map((t) => withColumn(t, cols))
  }

  /** La columna «Para el agente» del proyecto (ADR-0032), o `null`. Los FileStore antiguos no la traen. */
  async function agentColumnOf(projectId: string) {
    return (await store.projects.get(projectId))?.agentColumnId ?? null
  }

  /** La primera «Por hacer» que no sea la del agente (a esa solo se llega a propósito). */
  async function defaultColumn(projectId: string) {
    const [all, agent] = await Promise.all([listColumns(projectId), agentColumnOf(projectId)])
    const cols = all.filter((c) => c.id !== agent)
    const col =
      cols.find((c) => c.kind === 'todo') ??
      cols.find((c) => c.kind !== 'done') ??
      cols[0] ??
      all[0]
    if (!col) throw new ValidationError('El proyecto no tiene columnas')
    return col
  }

  async function createTask(input: CreateTaskInput) {
    const data = parse(createTaskInput, input)
    await getProject(data.projectId)
    const column = data.columnId
      ? await must(store.columns.get(data.columnId), 'Columna', data.columnId)
      : await defaultColumn(data.projectId)
    if (column.projectId !== data.projectId) {
      throw new ValidationError('La columna no pertenece a ese proyecto')
    }
    // Al agente va una issue que ya existe: una tarea nueva no tiene ninguna que etiquetar.
    if (data.columnId && (await agentColumnOf(data.projectId)) === column.id) {
      throw new ValidationError(AGENT_ONLY_GITHUB)
    }
    const siblings = await store.tasks.list({ columnIds: [column.id] })
    const task = await store.tasks.insert({
      projectId: data.projectId,
      columnId: column.id,
      title: data.title,
      description: data.description ?? '',
      priority: data.priority ?? 'none',
      labels: data.labels ?? [],
      dueDate: data.dueDate ?? null,
      source: data.source ?? defaultSource,
      externalId: data.externalId ?? null,
      externalUrl: data.externalUrl ?? null,
      completedAt: column.kind === 'done' ? nowIso() : null,
      archivedAt: null,
      position: await place('tasks', siblings),
    })
    await log('task', task.id, 'created', task.projectId, {
      title: task.title,
      column: column.name,
    })
    return task
  }

  async function updateTask(id: string, input: UpdateTaskInput) {
    const patch = parse(updateTaskInput, input)
    const before = await getTask(id)
    const task = await store.tasks.update(id, patch)
    await log('task', id, 'updated', before.projectId, patch)
    return task
  }

  async function moveTask(id: string, input: MoveTaskInput) {
    const { columnId, index } = parse(moveTaskInput, input)
    // Tres lecturas independientes a la vez: con Supabase cada una es un viaje de red.
    const [task, to, columnTasks] = await Promise.all([
      getTask(id),
      must(store.columns.get(columnId), 'Columna', columnId),
      store.tasks.list({ columnIds: [columnId] }),
    ])
    const [from, agent] = await Promise.all([
      task.columnId === to.id ? to : store.columns.get(task.columnId),
      agentColumnOf(task.projectId),
    ])
    if (to.projectId !== task.projectId) {
      throw new ValidationError('No se puede mover una tarea a otro proyecto con moveTask')
    }
    const entersAgent = to.id === agent && task.columnId !== agent
    const leavesAgent = task.columnId === agent && to.id !== agent
    if (entersAgent && (task.source !== 'github' || !task.externalId)) {
      throw new ValidationError(AGENT_ONLY_GITHUB)
    }
    const siblings = columnTasks.filter((t) => t.id !== id)
    const entersDone = to.kind === 'done' && from?.kind !== 'done'
    const leavesDone = to.kind !== 'done' && from?.kind === 'done'
    const moved = await store.tasks.update(id, {
      columnId,
      position: await place('tasks', siblings, index),
      ...(entersDone ? { completedAt: nowIso() } : {}),
      ...(leavesDone ? { completedAt: null } : {}),
    })
    if (from?.id !== to.id) {
      const action = entersDone ? 'completed' : leavesDone ? 'reopened' : 'moved'
      await log('task', id, action, task.projectId, { from: from?.name, to: to.name })
    }
    if (entersDone || leavesDone) await queueGithubState(task)
    if (entersAgent || leavesAgent) await queueAgentLabel(task)
    return moved
  }

  async function completeTask(id: string) {
    const task = await getTask(id)
    const done = (await listColumns(task.projectId)).find((c) => c.kind === 'done')
    if (!done) throw new ValidationError('El proyecto no tiene ninguna columna de tipo "done"')
    return moveTask(id, { columnId: done.id, index: 0 })
  }

  async function reopenTask(id: string) {
    const task = await getTask(id)
    return moveTask(id, { columnId: (await defaultColumn(task.projectId)).id })
  }

  async function archiveTask(id: string) {
    const task = await getTask(id)
    const archived = await store.tasks.update(id, { archivedAt: nowIso() })
    await log('task', id, 'archived', task.projectId, { title: task.title })
    return archived
  }

  /** Deshace `archiveTask`: la tarea vuelve a su columna y posición. */
  async function restoreTask(id: string) {
    const task = await getTask(id)
    const restored = await store.tasks.update(id, { archivedAt: null })
    await log('task', id, 'restored', task.projectId, { title: task.title })
    return restored
  }

  async function deleteTask(id: string) {
    const task = await getTask(id)
    await store.tasks.remove(id)
    await log('task', id, 'deleted', task.projectId, { title: task.title })
  }

  // ─── GitHub (issues ↔ tareas; ADR-0031) ────────────────────────────────────

  /**
   * Si una tarea de GitHub entra en «hecho» o sale de ahí, su issue tiene que cerrarse o reabrirse: se
   * apunta en la cola de salida. Lo que hace la propia sincronización (actor `github`) no se apunta: ya
   * viene de GitHub, y así no hay ida y vuelta.
   */
  async function queueGithubState(task: Task) {
    if (actor === 'github' || task.source !== 'github' || !task.externalId) return
    await store.githubOutbox.enqueue(task.id, 'state')
  }

  /**
   * Entrar en la columna del agente pone la etiqueta `muninn:agent` en la issue (lo que lanza la Action) y
   * salir la quita (lo que la cancela). Lo que mueven la sincronización o el propio flujo del agente
   * (actores `github` y `agent`) no se apunta: la etiqueta ya está como debe (ADR-0032).
   */
  async function queueAgentLabel(task: Task) {
    if (actor === 'github' || actor === 'agent') return
    if (task.source !== 'github' || !task.externalId) return
    await store.githubOutbox.enqueue(task.id, 'agent')
  }

  /** El proyecto vinculado a un repo (`github_repo`, sin distinguir mayúsculas), si no está archivado. */
  async function projectForRepo(repo: string) {
    const [project] = await store.projects.list({
      githubRepo: repo,
      statuses: ['active', 'paused'],
    })
    return project ?? null
  }

  async function taskForIssue(repo: string, issueNumber: number) {
    const [task] = await store.tasks.list({
      source: 'github',
      externalId: githubExternalId(repo, issueNumber),
      includeArchived: true,
    })
    return task ?? null
  }

  /**
   * Crea o actualiza la tarea de una issue. Idempotente: aplicar dos veces la misma issue no cambia nada.
   * - Nueva y abierta → tarea en la columna por defecto, con título, descripción y etiquetas de la issue.
   *   Nueva y cerrada → no se importa (no traemos el historial).
   * - Ya existe → GitHub manda en el título y la descripción; columna, orden, prioridad, fecha,
   *   etiquetas, subtareas y notas son de Muninn.
   * - Cerrada ↔ hecha: cerrar la issue completa la tarea; reabrirla la saca de «hecho».
   * - Una tarea archivada en Muninn no se toca (archivar es «no la quiero ver»).
   */
  async function applyGithubIssue(repo: string, input: GithubIssue): Promise<GithubApplyResult> {
    const name = parse(githubRepo, repo)
    const issue = parse(githubIssue, input)
    if (issue.pull_request !== undefined) return { action: 'ignored', reason: 'pull-request' }
    const project = await projectForRepo(name)
    if (!project) return { action: 'ignored', reason: 'no-project' }
    const title = issue.title.trim().slice(0, 300) || `Issue #${issue.number}`
    const description = (issue.body ?? '').slice(0, 20000)
    const existing = await taskForIssue(name, issue.number)

    if (!existing) {
      if (issue.state === 'closed') return { action: 'ignored', reason: 'closed' }
      const task = await createTask({
        projectId: project.id,
        title,
        description,
        labels: issueLabels(issue),
        source: 'github',
        externalId: githubExternalId(name, issue.number),
        externalUrl: issue.html_url,
      })
      return { action: 'created', task }
    }
    if (existing.archivedAt) return { action: 'ignored', reason: 'archived' }

    let task = existing
    let changed = false
    if (task.title !== title || task.description !== description) {
      task = await updateTask(task.id, { title, description })
      changed = true
    }
    // Si hay un cambio de Muninn sin llegar a GitHub, el estado de la issue es viejo: manda Muninn.
    const sending = await store.githubOutbox.pending({
      maxAttempts: GITHUB_MAX_ATTEMPTS,
      taskId: task.id,
      kind: 'state',
      limit: 1,
    })
    if (sending.length > 0) return { action: changed ? 'updated' : 'unchanged', task }
    const column = await store.columns.get(task.columnId)
    const done = column?.kind === 'done'
    if (issue.state === 'closed' && !done) {
      task = await completeTask(task.id)
      changed = true
    } else if (issue.state === 'open' && done) {
      task = await reopenTask(task.id)
      changed = true
    }
    return { action: changed ? 'updated' : 'unchanged', task }
  }

  /** La issue se borró o se transfirió a otro repo: su tarea se archiva (nunca se borra). */
  async function removeGithubIssue(repo: string, issueNumber: number) {
    const task = await taskForIssue(parse(githubRepo, repo), issueNumber)
    if (!task || task.archivedAt) return null
    return archiveTask(task.id)
  }

  /**
   * En qué estado debe estar en GitHub la issue de una tarea: cerrada si la tarea está en una columna
   * de tipo `done`, abierta si no. `null` si la tarea no viene de una issue.
   */
  async function githubStateOf(taskId: string) {
    const task = await getTask(taskId)
    const ref =
      task.source === 'github' && task.externalId ? parseGithubExternalId(task.externalId) : null
    if (!ref) return null
    const column = await store.columns.get(task.columnId)
    const state: GithubIssueState = column?.kind === 'done' ? 'closed' : 'open'
    return { ...ref, state, archived: task.archivedAt !== null }
  }

  /** Proyectos con repo vinculado (los que recorre la sincronización). */
  async function linkedProjects() {
    return (await listProjects()).filter((p) => p.githubRepo)
  }

  /**
   * Repos que se pueden vincular a un proyecto: a los que llega el token de la sincronización, por nombre.
   * `null` si este store no puede preguntarlo (modo demo, fichero local): entonces el repo se escribe a mano.
   */
  async function listGithubRepos() {
    if (!store.githubRepos) return null
    return parse(githubRepoList, await store.githubRepos.list())
  }

  /**
   * Si la sincronización podrá crear y cerrar issues en `repo`. La lista de `repos()` trae todos los
   * públicos de la cuenta, también aquellos a los que el token no llega: se comprueba al elegir uno.
   * `null` si este store no puede preguntarlo.
   */
  async function canWriteGithubRepo(repo: string) {
    if (!store.githubRepos) return null
    return store.githubRepos.canWrite(parse(githubRepo, repo))
  }

  /** Tareas de GitHub de un proyecto que siguen abiertas en Muninn (para reconciliar). */
  async function openGithubTasks(projectId: string) {
    const tasks = await listTasks({ projectId, source: 'github' })
    return tasks.filter((t) => t.column.kind !== 'done' && t.externalId)
  }

  // ─── Columna «Para el agente» (ADR-0032) ──────────────────────────────────

  /**
   * Si la issue de una tarea debe llevar la etiqueta del agente: sí mientras la tarea está (sin archivar) en
   * la columna del agente. `null` si la tarea no viene de una issue.
   */
  async function githubAgentStateOf(taskId: string) {
    const task = await getTask(taskId)
    const ref =
      task.source === 'github' && task.externalId ? parseGithubExternalId(task.externalId) : null
    if (!ref) return null
    const agent = await agentColumnOf(task.projectId)
    return { ...ref, labeled: !task.archivedAt && agent !== null && task.columnId === agent }
  }

  /**
   * Un PR del agente (rama `agent/issue-<n>`) cambia su tarea. Idempotente, como `applyIssue`:
   * - abierto (y no en borrador) → a la primera columna «Revisión»;
   * - fusionado → «Hecho», lo que apunta cerrar la issue (fusionar en `develop` no la cierra solo);
   * - cerrado sin fusionar → vuelve a «Por hacer», para reintentarlo moviéndola otra vez al agente.
   * Cada paso queda en la actividad con el enlace al PR. Pensado para un `createMuninn` con actor `agent`.
   */
  async function applyGithubPullRequest(
    repo: string,
    action: string,
    input: GithubPullRequest,
  ): Promise<GithubPullResult> {
    const name = parse(githubRepo, repo)
    const pr = parse(githubPullRequest, input)
    const issueNumber = agentIssueNumber(pr)
    if (issueNumber === null) return { action: 'ignored', reason: 'not-agent' }
    const task = await taskForIssue(name, issueNumber)
    if (!task) return { action: 'ignored', reason: 'no-task' }
    if (task.archivedAt) return { action: 'ignored', reason: 'archived' }
    const column = await store.columns.get(task.columnId)
    const done = column?.kind === 'done'
    const ref = { number: pr.number, url: pr.html_url }

    if (action === 'closed') {
      if (done) return { action: 'unchanged', task }
      if (pr.merged) {
        const completed = await completeTask(task.id)
        await log('task', task.id, 'agent_pr_merged', task.projectId, ref)
        return { action: 'completed', task: completed }
      }
      const back = await moveTask(task.id, { columnId: (await defaultColumn(task.projectId)).id })
      await log('task', task.id, 'agent_pr_closed', task.projectId, ref)
      return { action: 'returned', task: back }
    }
    if (!['opened', 'reopened', 'ready_for_review'].includes(action)) {
      return { action: 'unchanged', task }
    }
    if (pr.state !== 'open' || pr.draft || done || column?.kind === 'review') {
      return { action: 'unchanged', task }
    }
    const review = (await listColumns(task.projectId)).find((c) => c.kind === 'review')
    const moved = review ? await moveTask(task.id, { columnId: review.id, index: 0 }) : task
    await log('task', task.id, 'agent_pr_opened', task.projectId, ref)
    return { action: 'review', task: moved }
  }

  /**
   * Se quitó la etiqueta del agente de la issue sin que hubiera PR: el agente terminó sin conseguirlo (el
   * workflow la quita al acabar) o alguien la quitó a mano. La tarea sale de la columna del agente y vuelve a
   * «Por hacer». Si Muninn tiene pendiente poner la etiqueta, el aviso es viejo: manda Muninn.
   */
  async function githubAgentStopped(repo: string, issueNumber: number) {
    const task = await taskForIssue(parse(githubRepo, repo), issueNumber)
    if (!task || task.archivedAt) return null
    if ((await agentColumnOf(task.projectId)) !== task.columnId) return null
    const sending = await store.githubOutbox.pending({
      maxAttempts: GITHUB_MAX_ATTEMPTS,
      taskId: task.id,
      kind: 'agent',
      limit: 1,
    })
    if (sending.length > 0) return null
    const moved = await moveTask(task.id, { columnId: (await defaultColumn(task.projectId)).id })
    await log('task', task.id, 'agent_stopped', task.projectId, {})
    return moved
  }

  /**
   * Lanza la sincronización ahora (la Edge Function, con la sesión del usuario): `outbox` tras un cambio
   * en la app, para que no espere al cron; `all` para «Sincronizar ahora». `null` si este store no puede.
   */
  async function syncGithubNow(scope: GithubSyncScope = 'all') {
    if (!store.githubRepos) return null
    return store.githubRepos.sync(parse(githubSyncScope, scope))
  }

  // ─── Checklist ─────────────────────────────────────────────────────────────

  async function listChecklist(taskId: string) {
    return store.checklist.list({ taskIds: [taskId] })
  }

  /** `index` (por defecto, al final) y `done` permiten recrear un elemento borrado (deshacer). */
  async function addChecklistItem(
    taskId: string,
    title: string,
    opts: { done?: boolean; index?: number } = {},
  ) {
    await getTask(taskId)
    const clean = title.trim()
    if (!clean) throw new ValidationError('El elemento necesita título')
    const siblings = await listChecklist(taskId)
    return store.checklist.insert({
      taskId,
      title: clean,
      done: opts.done ?? false,
      position: await place('checklist', siblings, opts.index),
    })
  }

  /** Hechos y total de subtareas por tarea (las tarjetas del tablero muestran «3/5»). */
  async function checklistCounts(taskIds: string[]) {
    const counts: Record<string, { done: number; total: number }> = {}
    // Por tandas: con muchos ids, la URL de la consulta de PostgREST se pasaría de largo.
    for (let i = 0; i < taskIds.length; i += 100) {
      for (const item of await store.checklist.list({ taskIds: taskIds.slice(i, i + 100) })) {
        const c = counts[item.taskId] ?? { done: 0, total: 0 }
        c.total += 1
        if (item.done) c.done += 1
        counts[item.taskId] = c
      }
    }
    return counts
  }

  async function updateChecklistItem(
    id: string,
    patch: Partial<Pick<ChecklistItem, 'title' | 'done'>>,
  ) {
    await must(store.checklist.get(id), 'Elemento de checklist', id)
    return store.checklist.update(id, patch)
  }

  async function deleteChecklistItem(id: string) {
    await store.checklist.remove(id)
  }

  // ─── Notas ─────────────────────────────────────────────────────────────────

  async function listNotes(query: NoteQuery = {}) {
    return store.notes.list(parse(noteQuery, query))
  }

  async function getNote(id: string) {
    return must(store.notes.get(id), 'Nota', id)
  }

  async function createNote(input: CreateNoteInput) {
    const data = parse(createNoteInput, input)
    let projectId = data.projectId ?? null
    if (data.taskId) {
      // Una nota de tarea es del proyecto de esa tarea: si dicen otro, algo va mal.
      const task = await getTask(data.taskId)
      if (projectId && projectId !== task.projectId) {
        throw new ValidationError('La tarea no pertenece a ese proyecto')
      }
      projectId = task.projectId
    } else if (projectId) {
      await getProject(projectId)
    }
    const note = await store.notes.insert({
      title: data.title ?? '',
      content: data.content ?? '',
      projectId,
      taskId: data.taskId ?? null,
      pinned: data.pinned ?? false,
      archivedAt: null,
    })
    await log('note', note.id, 'created', note.projectId, { title: note.title })
    return note
  }

  /**
   * Los cambios de título o de texto llegan con el autoguardado del editor (cada pocos segundos): si
   * el último evento de la nota ya era una edición del mismo actor hace poco, no se anota otro y el
   * registro no se llena de «editó la nota».
   */
  const NOTE_EDIT_WINDOW_MS = 10 * 60_000

  async function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
    const patch = parse(updateNoteInput, input)
    const before = await getNote(id)
    if (patch.taskId) {
      const task = await getTask(patch.taskId)
      if (patch.projectId && patch.projectId !== task.projectId) {
        throw new ValidationError('La tarea no pertenece a ese proyecto')
      }
      patch.projectId = task.projectId
    } else if (patch.projectId !== undefined && patch.projectId !== before.projectId) {
      // Otro proyecto (o ninguno): la tarea anterior ya no encaja.
      if (patch.projectId) await getProject(patch.projectId)
      if (patch.taskId === undefined) patch.taskId = null
    }
    const fields = (['title', 'content', 'projectId', 'taskId', 'pinned'] as const).filter(
      (k) => patch[k] !== undefined && patch[k] !== before[k],
    )
    if (fields.length === 0) return before
    const note = await store.notes.update(id, patch)

    if (fields.length === 1 && fields[0] === 'pinned') {
      await log('note', id, note.pinned ? 'pinned' : 'unpinned', note.projectId, {
        title: note.title,
      })
      return note
    }
    if (fields.every((f) => f === 'title' || f === 'content')) {
      const [last] = await store.activity.list({ entityId: id, limit: 1 })
      const recent =
        last?.action === 'updated' &&
        last.actor === actor &&
        clock().getTime() - Date.parse(last.createdAt) < NOTE_EDIT_WINDOW_MS
      if (recent) return note
    }
    await log('note', id, 'updated', note.projectId, { title: note.title, fields })
    return note
  }

  async function archiveNote(id: string) {
    const note = await getNote(id)
    await log('note', id, 'archived', note.projectId, { title: note.title })
    return store.notes.update(id, { archivedAt: nowIso() })
  }

  /** Deshace `archiveNote`. */
  async function restoreNote(id: string) {
    const note = await getNote(id)
    const restored = await store.notes.update(id, { archivedAt: null })
    await log('note', id, 'restored', note.projectId, { title: note.title })
    return restored
  }

  // ─── Informes (UI de inicio, MCP, Jarvis) ──────────────────────────────────

  async function projectStatus(projectId: string): Promise<ProjectStatusReport> {
    const project = await getProject(projectId)
    const columns = await listColumns(projectId)
    const cols = new Map(columns.map((c) => [c.id, c]))
    const tasks = (await store.tasks.list({ projectId })).map((t) => withColumn(t, cols))
    const t0 = today()
    const in7 = addDays(t0, 7)
    const weekAgo = new Date(clock().getTime() - 7 * 86_400_000).toISOString()
    const open = tasks.filter((t) => t.column.kind !== 'done')
    const byDue = (a: Task, b: Task) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')

    return {
      project,
      columns: columns.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        wipLimit: c.wipLimit,
        count: tasks.filter((t) => t.columnId === c.id).length,
      })),
      counts: {
        open: open.length,
        done: tasks.length - open.length,
        overdue: open.filter((t) => t.dueDate && t.dueDate < t0).length,
        dueToday: open.filter((t) => t.dueDate === t0).length,
        dueThisWeek: open.filter((t) => t.dueDate && t.dueDate >= t0 && t.dueDate <= in7).length,
        completedLast7Days: tasks.filter((t) => t.completedAt && t.completedAt >= weekAgo).length,
      },
      inProgress: open.filter((t) => OPEN_ACTIVE_KINDS.includes(t.column.kind)),
      overdue: open
        .filter((t) => t.dueDate && t.dueDate < t0)
        .sort(byDue)
        .slice(0, 20),
      upcoming: open
        .filter((t) => t.dueDate && t.dueDate >= t0 && t.dueDate <= in7)
        .sort(byDue)
        .slice(0, 20),
      recentActivity: await store.activity.list({ projectId, limit: 15 }),
    }
  }

  async function overview(): Promise<OverviewReport> {
    const projects = await store.projects.list({ statuses: ['active'] })
    const t0 = today()
    const in7 = addDays(t0, 7)
    const byDay = new Map(Array.from({ length: 7 }, (_, i) => [addDays(t0, i - 6), 0]))
    const report: OverviewReport = {
      today: t0,
      projects: [],
      overdue: [],
      dueToday: [],
      upcoming: [],
      inProgress: [],
      completedToday: 0,
      completedTodayTasks: [],
      completedByDay: [],
    }
    for (const p of projects) {
      const cols = new Map((await listColumns(p.id)).map((c) => [c.id, c]))
      // Con archivadas: archivar una tarea hecha no debe quitarla de «Hechas hoy» ni de la gráfica.
      const every = (await store.tasks.list({ projectId: p.id, includeArchived: true })).map(
        (t) => ({ ...withColumn(t, cols), projectName: p.name }),
      )
      const tasks = every.filter((t) => !t.archivedAt)
      for (const t of every) {
        if (!t.completedAt) continue
        const day = dateFmt.format(new Date(t.completedAt))
        if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1)
        if (day === t0) report.completedTodayTasks.push(t)
      }
      const open = tasks.filter((t) => t.column.kind !== 'done')
      const overdue = open.filter((t) => t.dueDate && t.dueDate < t0)
      const active = open.filter((t) => OPEN_ACTIVE_KINDS.includes(t.column.kind))
      report.projects.push({
        id: p.id,
        name: p.name,
        color: p.color,
        open: open.length,
        inProgress: active.length,
        overdue: overdue.length,
        done: tasks.length - open.length,
      })
      report.overdue.push(...overdue)
      report.dueToday.push(...open.filter((t) => t.dueDate === t0))
      report.upcoming.push(...open.filter((t) => t.dueDate && t.dueDate > t0 && t.dueDate <= in7))
      report.inProgress.push(...active)
    }
    const byDue = (a: Task, b: Task) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
    report.overdue.sort(byDue)
    report.upcoming.sort(byDue)
    report.completedTodayTasks.sort((a, b) =>
      (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
    )
    report.completedToday = report.completedTodayTasks.length
    report.completedByDay = [...byDay].map(([date, count]) => ({ date, count }))
    return report
  }

  async function recentActivity(
    opts: { projectId?: string; entityId?: string; since?: string; limit?: number } = {},
  ) {
    return store.activity.list(opts)
  }

  /** Ajustes del usuario; sin fila guardada, los valores por defecto (no escribe nada). */
  async function getSettings(): Promise<UserSettings> {
    return (await store.settings.get()) ?? { ...DEFAULT_SETTINGS, updatedAt: nowIso() }
  }

  /** Las preferencias se fusionan por clave; `null` en una clave la borra. */
  async function updateSettings(input: UpdateSettingsInput): Promise<UserSettings> {
    const data = parse(updateSettingsInput, input)
    let preferences: Record<string, unknown> | undefined
    if (data.preferences) {
      const current = await getSettings()
      preferences = { ...current.preferences }
      for (const [k, v] of Object.entries(data.preferences)) {
        if (v === null) delete preferences[k]
        else preferences[k] = v
      }
    }
    return store.settings.upsert({ enabledModules: data.enabledModules, preferences })
  }

  return {
    today,
    projects: {
      list: listProjects,
      get: getProject,
      create: createProject,
      update: updateProject,
      move: moveProject,
      archive: (id: string) => updateProject(id, { status: 'archived' }),
      status: projectStatus,
    },
    columns: {
      list: listColumns,
      create: createColumn,
      update: updateColumn,
      move: moveColumn,
      delete: deleteColumn,
    },
    tasks: {
      list: listTasks,
      get: getTask,
      create: createTask,
      update: updateTask,
      move: moveTask,
      complete: completeTask,
      reopen: reopenTask,
      archive: archiveTask,
      restore: restoreTask,
      delete: deleteTask,
    },
    checklist: {
      list: listChecklist,
      counts: checklistCounts,
      add: addChecklistItem,
      update: updateChecklistItem,
      delete: deleteChecklistItem,
    },
    notes: {
      list: listNotes,
      get: getNote,
      create: createNote,
      update: updateNote,
      archive: archiveNote,
      restore: restoreNote,
    },
    settings: {
      get: getSettings,
      update: updateSettings,
    },
    github: {
      applyIssue: applyGithubIssue,
      removeIssue: removeGithubIssue,
      stateOf: githubStateOf,
      linkedProjects,
      repos: listGithubRepos,
      canWrite: canWriteGithubRepo,
      openTasks: openGithubTasks,
      applyPullRequest: applyGithubPullRequest,
      agentStopped: githubAgentStopped,
      agentStateOf: githubAgentStateOf,
      syncNow: syncGithubNow,
      outbox: {
        pending: (limit?: number, kind?: OutboxKind) =>
          store.githubOutbox.pending({ maxAttempts: GITHUB_MAX_ATTEMPTS, limit, kind }),
        settle: (entries: OutboxEntry[], error?: string) =>
          store.githubOutbox.settle(entries, error),
      },
    },
    overview,
    recentActivity,
  }
}
