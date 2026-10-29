import {
  type BoardColumn,
  type CreateTaskInput,
  columnKind,
  MAX_BATCH_TASKS,
  type Muninn,
  type Project,
  type Task,
  taskPriority,
  ValidationError,
} from '@muninn/core'
import { z } from 'zod'
import { type AnyTool, defineTool, isExpectedError, UUID } from './define'

const projectRef = z
  .string()
  .min(1)
  .describe('Id del proyecto o su nombre (no distingue mayúsculas)')
const isoDate = z.iso.date().describe('Fecha AAAA-MM-DD')

/**
 * Por id o por nombre (ADR-0009): primero el nombre exacto y, si no hay, los que lo contienen. Entre varios
 * candidatos gana el activo o pausado sobre el archivado (al archivar un proyecto, su nombre se reutiliza); si
 * quedan varios sin archivar, error con sus ids en vez de elegir uno al azar.
 */
export async function resolveProject(app: Muninn, ref: string) {
  if (UUID.test(ref)) return app.projects.get(ref)
  const all = await app.projects.list({ includeArchived: true })
  const needle = ref.trim().toLowerCase()
  const exact = all.filter((p) => p.name.toLowerCase() === needle)
  const candidates =
    exact.length > 0 ? exact : all.filter((p) => p.name.toLowerCase().includes(needle))
  const live = candidates.filter((p) => p.status !== 'archived')
  if (live.length > 1) {
    throw new ValidationError(
      `Hay ${live.length} proyectos que encajan con "${ref}": ${live.map((p) => `${p.name} (${p.id})`).join(', ')}. Usa el id.`,
    )
  }
  const match = live[0] ?? candidates[0]
  if (!match) {
    throw new ValidationError(
      `No hay ningún proyecto llamado "${ref}". Proyectos: ${all.map((p) => p.name).join(', ') || '(ninguno)'}`,
    )
  }
  return match
}

/** Acepta id de columna, nombre ("En curso") o tipo ("in_progress"). */
export async function resolveColumn(app: Muninn, projectId: string, ref: string) {
  const cols = await app.columns.list(projectId)
  const needle = ref.trim().toLowerCase()
  const match =
    cols.find((c) => c.id === ref) ??
    cols.find((c) => c.name.toLowerCase() === needle) ??
    cols.find((c) => c.kind === needle)
  if (!match) {
    throw new ValidationError(
      `Columna "${ref}" no encontrada. Columnas: ${cols.map((c) => `${c.name} (${c.kind})`).join(', ')}`,
    )
  }
  return match
}

/** Columna e índice de una tarea (índice sin contarla, como espera `tasks.move`), para devolverla allí. */
async function placeOf(app: Muninn, task: Task) {
  const column = await app.tasks.list({ projectId: task.projectId, columnId: task.columnId })
  return {
    columnId: task.columnId,
    index: Math.max(
      0,
      column.findIndex((t) => t.id === task.id),
    ),
  }
}

const taskTarget = (t: Task) => ({ kind: 'task' as const, id: t.id, projectId: t.projectId })

const taskFields = ['title', 'description', 'priority', 'labels', 'dueDate'] as const

/** Campos de una tarea nueva, comunes a `create_task` y a cada elemento de `create_tasks`. */
const newTask = {
  title: z.string().min(1),
  description: z.string().optional(),
  column: z.string().optional().describe('Id, nombre o tipo de columna'),
  priority: taskPriority.optional(),
  labels: z.array(z.string()).optional(),
  dueDate: isoDate.optional(),
  checklist: z
    .array(z.string().min(1))
    .max(100)
    .optional()
    .describe('Subtareas, en orden (se crean sin marcar)'),
}

type BatchResult =
  | {
      index: number
      ok: true
      id: string
      title: string
      checklist: number
      checklistError?: string
    }
  | { index: number; ok: false; error: string }

export const taskTools: AnyTool[] = [
  // ─── Lectura ────────────────────────────────────────────────────────────────
  defineTool({
    name: 'overview',
    title: 'Resumen del día',
    description:
      'Resumen global: proyectos activos con sus contadores, tareas vencidas, que vencen hoy y en curso. Úsalo primero para responder "¿cómo voy?".',
    input: {},
    access: 'read',
    module: null,
    run: ({ app }) => app.overview(),
  }),
  defineTool({
    name: 'list_projects',
    title: 'Listar proyectos',
    description: 'Lista los proyectos (activos y pausados; opcionalmente también archivados).',
    input: { includeArchived: z.boolean().optional() },
    access: 'read',
    module: 'tasks',
    run: ({ app }, { includeArchived }) => app.projects.list({ includeArchived }),
  }),
  defineTool({
    name: 'project_status',
    title: 'Estado de un proyecto',
    description:
      'Informe de un proyecto: columnas con número de tareas, vencidas, próximas 7 días, en curso y actividad reciente.',
    input: { project: projectRef },
    access: 'read',
    module: 'tasks',
    detail: (a) => a.project,
    run: async ({ app }, { project }) =>
      app.projects.status((await resolveProject(app, project)).id),
  }),
  defineTool({
    name: 'list_tasks',
    title: 'Buscar tareas',
    description:
      'Lista tareas con filtros. Sin filtros devuelve todas las de proyectos no archivados.',
    input: {
      project: projectRef.optional(),
      kinds: z
        .array(columnKind)
        .optional()
        .describe('Tipos de columna: backlog, todo, in_progress, review, done'),
      priority: z.array(taskPriority).optional(),
      dueBefore: isoDate.optional(),
      search: z.string().optional().describe('Texto en título o descripción'),
      limit: z.number().int().min(1).max(200).optional(),
    },
    access: 'read',
    module: 'tasks',
    detail: (a) => a.search ?? a.project,
    run: async ({ app }, { project, ...rest }) =>
      app.tasks.list({
        ...rest,
        projectId: project ? (await resolveProject(app, project)).id : undefined,
        limit: rest.limit ?? 100,
      }),
  }),
  defineTool({
    name: 'get_task',
    title: 'Detalle de tarea',
    description: 'Tarea con su checklist y notas vinculadas.',
    input: { taskId: z.uuid() },
    access: 'read',
    module: 'tasks',
    run: async ({ app }, { taskId }) => ({
      task: await app.tasks.get(taskId),
      checklist: await app.checklist.list(taskId),
      notes: await app.notes.list({ taskId }),
    }),
  }),
  defineTool({
    name: 'list_columns',
    title: 'Columnas de un proyecto',
    description: 'Columnas (estados) del tablero Kanban de un proyecto, en orden.',
    input: { project: projectRef },
    access: 'read',
    module: 'tasks',
    detail: (a) => a.project,
    run: async ({ app }, { project }) => app.columns.list((await resolveProject(app, project)).id),
  }),
  defineTool({
    name: 'recent_activity',
    title: 'Actividad reciente',
    description:
      'Qué ha cambiado (tareas creadas, movidas, completadas…), global o de un proyecto.',
    input: {
      project: projectRef.optional(),
      since: z.iso.datetime().optional().describe('Desde (ISO 8601)'),
      limit: z.number().int().min(1).max(200).optional(),
    },
    access: 'read',
    module: null,
    detail: (a) => a.project,
    run: async ({ app }, { project, since, limit }) =>
      app.recentActivity({
        projectId: project ? (await resolveProject(app, project)).id : undefined,
        since,
        limit: limit ?? 30,
      }),
  }),

  // ─── Escritura ──────────────────────────────────────────────────────────────
  defineTool({
    name: 'create_project',
    title: 'Crear proyecto',
    description:
      'Crea un proyecto con el tablero por defecto (Backlog, Pendiente, En curso, Revisión, Hecho).',
    input: {
      name: z.string().min(1),
      description: z.string().optional(),
      githubRepo: z.string().optional().describe('owner/repo para sincronizar issues'),
    },
    access: 'write',
    module: 'tasks',
    detail: (a) => a.name,
    run: async ({ app, changed }, input) => {
      const p = await app.projects.create(input)
      changed({
        summary: `Proyecto «${p.name}» creado`,
        undo: (m) => m.projects.archive(p.id),
        target: { kind: 'project', id: p.id },
      })
      return p
    },
  }),
  defineTool({
    name: 'create_task',
    title: 'Crear tarea',
    description:
      'Crea una tarea en un proyecto, con su checklist si se indica. Por defecto va a la columna "Pendiente". Para varias tareas, usa create_tasks.',
    input: { project: projectRef, ...newTask },
    access: 'write',
    module: 'tasks',
    detail: (a) => a.title,
    run: async ({ app, changed }, { project, column, ...rest }) => {
      const p = await resolveProject(app, project)
      const columnId = column ? (await resolveColumn(app, p.id, column)).id : undefined
      const task = await app.tasks.create({ ...rest, projectId: p.id, columnId })
      changed({
        summary: `Tarea «${task.title}» creada en ${p.name}`,
        undo: (m) => m.tasks.archive(task.id),
        target: taskTarget(task),
      })
      return rest.checklist?.length
        ? { ...task, checklist: await app.checklist.list(task.id) }
        : task
    },
  }),
  defineTool({
    name: 'create_tasks',
    title: 'Crear tareas en lote',
    description: `Crea varias tareas de una vez (máximo ${MAX_BATCH_TASKS}), cada una con su checklist opcional, en el orden dado y al final de su columna. \`project\` vale para todas salvo las que lleven el suyo. Devuelve el id de cada tarea creada y el error de cada una que falle, sin cortar las demás: no repitas las que ya salieron bien.`,
    input: {
      project: projectRef.optional().describe('Proyecto de todas las tareas que no lleven el suyo'),
      tasks: z
        .array(z.object({ project: projectRef.optional(), ...newTask }))
        .min(1)
        .max(MAX_BATCH_TASKS),
    },
    access: 'write',
    module: 'tasks',
    detail: (a) => `${a.tasks.length} tareas`,
    run: async ({ app, changed }, { project, tasks }) => {
      // Proyecto y columna se resuelven una vez por nombre: 50 tareas del mismo proyecto no son 50 búsquedas.
      const projects = new Map<string, Promise<Project>>()
      const columns = new Map<string, Promise<BoardColumn>>()
      const cached = <T>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>) => {
        const hit = map.get(key) ?? load()
        map.set(key, hit)
        return hit
      }
      const results: BatchResult[] = []
      const pending: { index: number; input: CreateTaskInput }[] = []
      for (const [index, t] of tasks.entries()) {
        const { project: own, column, ...rest } = t
        try {
          const ref = own ?? project
          if (!ref)
            throw new ValidationError(
              'Falta el proyecto: indica `project` en la llamada o en la tarea',
            )
          const p = await cached(projects, ref, () => resolveProject(app, ref))
          const columnId = column
            ? (await cached(columns, `${p.id}:${column}`, () => resolveColumn(app, p.id, column)))
                .id
            : undefined
          pending.push({ index, input: { ...rest, projectId: p.id, columnId } })
        } catch (err) {
          if (!isExpectedError(err)) throw err
          results[index] = { index, ok: false, error: err.message }
        }
      }
      const done = pending.length > 0 ? await app.tasks.createMany(pending.map((x) => x.input)) : []
      const created: Task[] = []
      for (const [i, r] of done.entries()) {
        const index = (pending[i] as (typeof pending)[number]).index
        if (!r.ok) {
          results[index] = { index, ok: false, error: r.error }
          continue
        }
        created.push(r.task)
        results[index] = {
          index,
          ok: true,
          id: r.task.id,
          title: r.task.title,
          checklist: r.checklist.length,
          ...(r.checklistError ? { checklistError: r.checklistError } : {}),
        }
      }
      const first = created[0]
      if (first) {
        changed({
          summary:
            created.length === 1
              ? `Tarea «${first.title}» creada`
              : `${created.length} tareas creadas`,
          undo: async (m) => {
            for (const t of created) await m.tasks.archive(t.id)
          },
          target:
            created.length === 1 ? taskTarget(first) : { kind: 'project', id: first.projectId },
        })
      }
      return { created: created.length, failed: tasks.length - created.length, results }
    },
  }),
  defineTool({
    name: 'update_task',
    title: 'Editar tarea',
    description: 'Cambia título, descripción, prioridad, etiquetas o fecha de una tarea.',
    input: {
      taskId: z.uuid(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      priority: taskPriority.optional(),
      labels: z.array(z.string()).optional(),
      dueDate: isoDate.nullable().optional(),
    },
    access: 'write',
    module: 'tasks',
    detail: (a) =>
      a.priority ? `prioridad ${a.priority}` : a.dueDate ? `fecha ${a.dueDate}` : a.title,
    run: async ({ app, changed }, { taskId, ...patch }) => {
      const before = await app.tasks.get(taskId)
      const task = await app.tasks.update(taskId, patch)
      const previous = Object.fromEntries(
        taskFields.filter((k) => patch[k] !== undefined).map((k) => [k, before[k]]),
      )
      changed({
        summary: `Tarea «${task.title}» editada`,
        undo: (m) => m.tasks.update(taskId, previous),
        target: taskTarget(task),
      })
      return task
    },
  }),
  defineTool({
    name: 'move_task',
    title: 'Mover tarea',
    description:
      'Mueve una tarea a otra columna de su proyecto (p. ej. "En curso" o "in_progress").',
    input: {
      taskId: z.uuid(),
      column: z.string().describe('Id, nombre o tipo de columna'),
      index: z.number().int().min(0).optional().describe('Posición; por defecto, al final'),
    },
    access: 'write',
    idempotent: true,
    module: 'tasks',
    detail: (a) => `→ ${a.column}`,
    run: async ({ app, changed }, { taskId, column, index }) => {
      const task = await app.tasks.get(taskId)
      const [col, back] = await Promise.all([
        resolveColumn(app, task.projectId, column),
        placeOf(app, task),
      ])
      const moved = await app.tasks.move(taskId, { columnId: col.id, index })
      changed({
        summary: `«${task.title}» movida a ${col.name}`,
        undo: (m) => m.tasks.move(taskId, back),
        target: taskTarget(task),
      })
      return moved
    },
  }),
  defineTool({
    name: 'complete_task',
    title: 'Completar tarea',
    description: 'Marca una tarea como hecha (la mueve a la columna de tipo "done").',
    input: { taskId: z.uuid() },
    access: 'write',
    idempotent: true,
    module: 'tasks',
    run: async ({ app, changed }, { taskId }) => {
      const task = await app.tasks.get(taskId)
      const back = await placeOf(app, task)
      const done = await app.tasks.complete(taskId)
      changed({
        summary: `«${task.title}» completada`,
        undo: (m) => m.tasks.move(taskId, back),
        target: taskTarget(task),
      })
      return done
    },
  }),
  defineTool({
    name: 'archive_task',
    title: 'Archivar tarea',
    description: 'Archiva una tarea (deja de verse en el tablero, no se borra).',
    input: { taskId: z.uuid() },
    access: 'write',
    idempotent: true,
    module: 'tasks',
    run: async ({ app, changed }, { taskId }) => {
      const task = await app.tasks.archive(taskId)
      changed({
        summary: `«${task.title}» archivada`,
        undo: (m) => m.tasks.restore(taskId),
        target: taskTarget(task),
      })
      return task
    },
  }),
  defineTool({
    name: 'add_checklist_item',
    title: 'Añadir subtarea',
    description: 'Añade un elemento al checklist de una tarea.',
    input: { taskId: z.uuid(), title: z.string().min(1) },
    access: 'write',
    module: 'tasks',
    detail: (a) => a.title,
    run: async ({ app, changed }, { taskId, title }) => {
      const item = await app.checklist.add(taskId, title)
      const task = await app.tasks.get(taskId)
      changed({
        summary: `Subtarea «${item.title}» añadida a «${task.title}»`,
        // Quitar lo recién creado, como el «Deshacer» de la UI (ADR-0025).
        undo: (m) => m.checklist.delete(item.id),
        target: taskTarget(task),
      })
      return item
    },
  }),
  defineTool({
    name: 'set_checklist_item_done',
    title: 'Marcar subtarea',
    description: 'Marca o desmarca un elemento del checklist.',
    input: { itemId: z.uuid(), done: z.boolean() },
    access: 'write',
    idempotent: true,
    module: 'tasks',
    run: async ({ app, changed }, { itemId, done }) => {
      const item = await app.checklist.update(itemId, { done })
      changed({
        summary: `Subtarea «${item.title}» ${done ? 'hecha' : 'pendiente'}`,
        undo: (m) => m.checklist.update(itemId, { done: !done }),
      })
      return item
    },
  }),
]
