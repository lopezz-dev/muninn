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
  type MoveTaskInput,
  moveTaskInput,
  type Note,
  type NoteQuery,
  noteQuery,
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
import { NotFoundError, type Store } from './store'

export const DEFAULT_COLUMNS: { name: string; kind: ColumnKind }[] = [
  { name: 'Backlog', kind: 'backlog' },
  { name: 'Pendiente', kind: 'todo' },
  { name: 'En curso', kind: 'in_progress' },
  { name: 'Revisión', kind: 'review' },
  { name: 'Hecho', kind: 'done' },
]

const OPEN_ACTIVE_KINDS: ColumnKind[] = ['in_progress', 'review']

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
    const column = await store.columns.update(id, patch)
    // Cambiar la semántica de la columna cambia el estado "hecho" de sus tareas.
    if (patch.kind && (patch.kind === 'done') !== (before.kind === 'done')) {
      const tasks = await store.tasks.list({ columnIds: [id] })
      for (const t of tasks) {
        await store.tasks.update(t.id, { completedAt: patch.kind === 'done' ? nowIso() : null })
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

  async function defaultColumn(projectId: string) {
    const cols = await listColumns(projectId)
    const col =
      cols.find((c) => c.kind === 'todo') ?? cols.find((c) => c.kind !== 'done') ?? cols[0]
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
    const from = task.columnId === to.id ? to : await store.columns.get(task.columnId)
    if (to.projectId !== task.projectId) {
      throw new ValidationError('No se puede mover una tarea a otro proyecto con moveTask')
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
    if (data.projectId) await getProject(data.projectId)
    if (data.taskId) await getTask(data.taskId)
    const note = await store.notes.insert({
      title: data.title ?? '',
      content: data.content ?? '',
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
      pinned: data.pinned ?? false,
      archivedAt: null,
    })
    await log('note', note.id, 'created', note.projectId, { title: note.title })
    return note
  }

  async function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
    const patch = parse(updateNoteInput, input)
    await getNote(id)
    const note = await store.notes.update(id, patch)
    await log('note', id, 'updated', note.projectId, { title: note.title })
    return note
  }

  async function archiveNote(id: string) {
    const note = await getNote(id)
    await log('note', id, 'archived', note.projectId, { title: note.title })
    return store.notes.update(id, { archivedAt: nowIso() })
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
    },
    settings: {
      get: getSettings,
      update: updateSettings,
    },
    overview,
    recentActivity,
  }
}
