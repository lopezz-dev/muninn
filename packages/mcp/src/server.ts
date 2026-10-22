import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { columnKind, type Muninn, NotFoundError, taskPriority, ValidationError } from '@muninn/core'
import { z } from 'zod'
import { registerFinanceTools } from './finance-tools'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const projectRef = z
  .string()
  .min(1)
  .describe('Id del proyecto o su nombre (no distingue mayúsculas)')
const isoDate = z.iso.date().describe('Fecha AAAA-MM-DD')

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

const ok = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
})

/** Errores esperables (validación, no encontrado) vuelven al modelo como texto para que corrija. */
const run = async (fn: () => Promise<unknown>): Promise<ToolResult> => {
  try {
    return ok(await fn())
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      return { content: [{ type: 'text', text: err.message }], isError: true }
    }
    throw err
  }
}

/**
 * Servidor MCP de Muninn. Expone la API de dominio como herramientas para Claude, Codex
 * o un modelo local. No expone borrados definitivos: como mucho, archivar.
 */
export function createMuninnMcpServer(app: Muninn) {
  const server = new McpServer({ name: 'muninn', version: '0.1.0' })

  async function resolveProject(ref: string) {
    if (UUID.test(ref)) return app.projects.get(ref)
    const all = await app.projects.list({ includeArchived: true })
    const needle = ref.trim().toLowerCase()
    const match =
      all.find((p) => p.name.toLowerCase() === needle) ??
      all.find((p) => p.name.toLowerCase().includes(needle))
    if (!match) {
      throw new ValidationError(
        `No hay ningún proyecto llamado "${ref}". Proyectos: ${all.map((p) => p.name).join(', ') || '(ninguno)'}`,
      )
    }
    return match
  }

  /** Acepta id de columna, nombre ("En curso") o tipo ("in_progress"). */
  async function resolveColumn(projectId: string, ref: string) {
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

  const read = { readOnlyHint: true, openWorldHint: false }
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false }

  // ─── Lectura ────────────────────────────────────────────────────────────────

  server.registerTool(
    'overview',
    {
      title: 'Resumen del día',
      description:
        'Resumen global: proyectos activos con sus contadores, tareas vencidas, que vencen hoy y en curso. Úsalo primero para responder "¿cómo voy?".',
      inputSchema: {},
      annotations: read,
    },
    () => run(() => app.overview()),
  )

  server.registerTool(
    'list_projects',
    {
      title: 'Listar proyectos',
      description: 'Lista los proyectos (activos y pausados; opcionalmente también archivados).',
      inputSchema: { includeArchived: z.boolean().optional() },
      annotations: read,
    },
    ({ includeArchived }) => run(() => app.projects.list({ includeArchived })),
  )

  server.registerTool(
    'project_status',
    {
      title: 'Estado de un proyecto',
      description:
        'Informe de un proyecto: columnas con número de tareas, vencidas, próximas 7 días, en curso y actividad reciente.',
      inputSchema: { project: projectRef },
      annotations: read,
    },
    ({ project }) => run(async () => app.projects.status((await resolveProject(project)).id)),
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'Buscar tareas',
      description:
        'Lista tareas con filtros. Sin filtros devuelve todas las de proyectos no archivados.',
      inputSchema: {
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
      annotations: read,
    },
    ({ project, ...rest }) =>
      run(async () =>
        app.tasks.list({
          ...rest,
          projectId: project ? (await resolveProject(project)).id : undefined,
          limit: rest.limit ?? 100,
        }),
      ),
  )

  server.registerTool(
    'get_task',
    {
      title: 'Detalle de tarea',
      description: 'Tarea con su checklist y notas vinculadas.',
      inputSchema: { taskId: z.uuid() },
      annotations: read,
    },
    ({ taskId }) =>
      run(async () => ({
        task: await app.tasks.get(taskId),
        checklist: await app.checklist.list(taskId),
        notes: await app.notes.list({ taskId }),
      })),
  )

  server.registerTool(
    'list_columns',
    {
      title: 'Columnas de un proyecto',
      description: 'Columnas (estados) del tablero Kanban de un proyecto, en orden.',
      inputSchema: { project: projectRef },
      annotations: read,
    },
    ({ project }) => run(async () => app.columns.list((await resolveProject(project)).id)),
  )

  server.registerTool(
    'list_notes',
    {
      title: 'Buscar notas',
      description: 'Lista o busca notas, opcionalmente de un proyecto.',
      inputSchema: {
        project: projectRef.optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: read,
    },
    ({ project, search, limit }) =>
      run(async () =>
        app.notes.list({
          projectId: project ? (await resolveProject(project)).id : undefined,
          search,
          limit: limit ?? 50,
        }),
      ),
  )

  server.registerTool(
    'recent_activity',
    {
      title: 'Actividad reciente',
      description:
        'Qué ha cambiado (tareas creadas, movidas, completadas…), global o de un proyecto.',
      inputSchema: {
        project: projectRef.optional(),
        since: z.iso.datetime().optional().describe('Desde (ISO 8601)'),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: read,
    },
    ({ project, since, limit }) =>
      run(async () =>
        app.recentActivity({
          projectId: project ? (await resolveProject(project)).id : undefined,
          since,
          limit: limit ?? 30,
        }),
      ),
  )

  // ─── Escritura ──────────────────────────────────────────────────────────────

  server.registerTool(
    'create_project',
    {
      title: 'Crear proyecto',
      description:
        'Crea un proyecto con el tablero por defecto (Backlog, Pendiente, En curso, Revisión, Hecho).',
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        githubRepo: z.string().optional().describe('owner/repo para sincronizar issues'),
      },
      annotations: write,
    },
    (input) => run(() => app.projects.create(input)),
  )

  server.registerTool(
    'create_task',
    {
      title: 'Crear tarea',
      description: 'Crea una tarea en un proyecto. Por defecto va a la columna "Pendiente".',
      inputSchema: {
        project: projectRef,
        title: z.string().min(1),
        description: z.string().optional(),
        column: z.string().optional().describe('Id, nombre o tipo de columna'),
        priority: taskPriority.optional(),
        labels: z.array(z.string()).optional(),
        dueDate: isoDate.optional(),
      },
      annotations: write,
    },
    ({ project, column, ...rest }) =>
      run(async () => {
        const p = await resolveProject(project)
        const columnId = column ? (await resolveColumn(p.id, column)).id : undefined
        return app.tasks.create({ ...rest, projectId: p.id, columnId })
      }),
  )

  server.registerTool(
    'update_task',
    {
      title: 'Editar tarea',
      description: 'Cambia título, descripción, prioridad, etiquetas o fecha de una tarea.',
      inputSchema: {
        taskId: z.uuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: taskPriority.optional(),
        labels: z.array(z.string()).optional(),
        dueDate: isoDate.nullable().optional(),
      },
      annotations: write,
    },
    ({ taskId, ...patch }) => run(() => app.tasks.update(taskId, patch)),
  )

  server.registerTool(
    'move_task',
    {
      title: 'Mover tarea',
      description:
        'Mueve una tarea a otra columna de su proyecto (p. ej. "En curso" o "in_progress").',
      inputSchema: {
        taskId: z.uuid(),
        column: z.string().describe('Id, nombre o tipo de columna'),
        index: z.number().int().min(0).optional().describe('Posición; por defecto, al final'),
      },
      annotations: { ...write, idempotentHint: true },
    },
    ({ taskId, column, index }) =>
      run(async () => {
        const task = await app.tasks.get(taskId)
        const col = await resolveColumn(task.projectId, column)
        return app.tasks.move(taskId, { columnId: col.id, index })
      }),
  )

  server.registerTool(
    'complete_task',
    {
      title: 'Completar tarea',
      description: 'Marca una tarea como hecha (la mueve a la columna de tipo "done").',
      inputSchema: { taskId: z.uuid() },
      annotations: { ...write, idempotentHint: true },
    },
    ({ taskId }) => run(() => app.tasks.complete(taskId)),
  )

  server.registerTool(
    'archive_task',
    {
      title: 'Archivar tarea',
      description: 'Archiva una tarea (deja de verse en el tablero, no se borra).',
      inputSchema: { taskId: z.uuid() },
      annotations: { ...write, idempotentHint: true },
    },
    ({ taskId }) => run(() => app.tasks.archive(taskId)),
  )

  server.registerTool(
    'add_checklist_item',
    {
      title: 'Añadir subtarea',
      description: 'Añade un elemento al checklist de una tarea.',
      inputSchema: { taskId: z.uuid(), title: z.string().min(1) },
      annotations: write,
    },
    ({ taskId, title }) => run(() => app.checklist.add(taskId, title)),
  )

  server.registerTool(
    'set_checklist_item_done',
    {
      title: 'Marcar subtarea',
      description: 'Marca o desmarca un elemento del checklist.',
      inputSchema: { itemId: z.uuid(), done: z.boolean() },
      annotations: { ...write, idempotentHint: true },
    },
    ({ itemId, done }) => run(() => app.checklist.update(itemId, { done })),
  )

  server.registerTool(
    'create_note',
    {
      title: 'Crear nota',
      description: 'Crea una nota en Markdown, opcionalmente vinculada a un proyecto o tarea.',
      inputSchema: {
        title: z.string().optional(),
        content: z.string().describe('Markdown'),
        project: projectRef.optional(),
        taskId: z.uuid().optional(),
        pinned: z.boolean().optional(),
      },
      annotations: write,
    },
    ({ project, ...rest }) =>
      run(async () =>
        app.notes.create({
          ...rest,
          projectId: project ? (await resolveProject(project)).id : undefined,
        }),
      ),
  )

  server.registerTool(
    'update_note',
    {
      title: 'Editar nota',
      description: 'Cambia el título, el contenido o el fijado de una nota.',
      inputSchema: {
        noteId: z.uuid(),
        title: z.string().optional(),
        content: z.string().optional(),
        pinned: z.boolean().optional(),
      },
      annotations: write,
    },
    ({ noteId, ...patch }) => run(() => app.notes.update(noteId, patch)),
  )

  registerFinanceTools(server, app, { run, read, write })

  return server
}
