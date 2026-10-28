import type {
  BoardColumn,
  ChecklistItem,
  CreateTaskInput,
  Muninn,
  Project,
  TaskWithColumn,
  UpdateTaskInput,
} from '@muninn/core'
import { type IconName, notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { AGENT_ONLY_GITHUB, blocksAgentDrop, flushGithubSoon } from './agent'
import { applyTaskMove, type BoardData, indexInColumn } from './board'
import { fail, optimistic, rollback, serial, settle } from './mutations'
import { keys } from './queries'

/**
 * Acciones sobre tareas y subtareas, con feedback y «Deshacer» (ADR-0019). Cada una refleja el cambio
 * en la caché al instante y escribe en el core; ver `mutations.ts`. Nada de aquí borra datos:
 * archivar es reversible y el core no ofrece borrado de tareas en la UI.
 */

type TaskRef = Pick<TaskWithColumn, 'id' | 'projectId' | 'columnId' | 'title'>

const board = (qc: QueryClient, projectId: string) =>
  qc.getQueryData<BoardData>(keys.board(projectId))

/** El proyecto en caché (para su columna del agente). */
const cachedProject = (qc: QueryClient, projectId: string) =>
  qc.getQueryData<Project>(keys.project(projectId))

// ─── Mover ──────────────────────────────────────────────────────────────────

export interface MoveOptions {
  projectId: string
  taskId: string
  columnId: string
  /** Posición en la columna destino, sin contar la propia tarea (0 = arriba). Por defecto, al final. */
  index?: number
  /** Qué ha pasado, para el texto del aviso. */
  verb?: 'moved' | 'completed' | 'reopened'
  /** Para el aviso y el «Deshacer» cuando el tablero no está en caché (por ejemplo, desde Inicio). */
  title?: string
  fromColumnId?: string
  /** Es un «Deshacer»: sin otro «Deshacer» encima. */
  undoing?: boolean
}

/** Mueve (o reordena) una tarea: optimista, serializado y con «Deshacer» que la devuelve a su sitio. */
export async function moveTask(m: Muninn, qc: QueryClient, o: MoveOptions): Promise<boolean> {
  const { projectId, taskId, columnId, index } = o
  // La columna del agente solo admite tareas de una issue (ADR-0032): se avisa antes de moverla.
  const cached = board(qc, projectId)?.tasks.find((t) => t.id === taskId)
  if (cached && blocksAgentDrop(cachedProject(qc, projectId), cached, columnId)) {
    notify.error(AGENT_ONLY_GITHUB, {
      description: 'Las que creas en Muninn no tienen una issue que etiquetar.',
    })
    return false
  }
  const prev = await optimistic(qc, projectId, (d) => applyTaskMove(d, taskId, columnId, index))
  const task = prev?.tasks.find((t) => t.id === taskId)
  const fromColumnId = task?.columnId ?? o.fromColumnId
  const fromIndex = prev ? indexInColumn(prev, taskId) : undefined
  const title = task?.title ?? o.title ?? 'Tarea'
  const target = prev?.columns.find((c) => c.id === columnId)

  try {
    await serial(projectId, () => m.tasks.move(taskId, { columnId, index }))
  } catch (err) {
    rollback(qc, projectId, prev)
    fail('No se pudo mover la tarea', err)
    return false
  }
  settle(qc, projectId, taskId)
  // Cerrar o reabrir la issue, o etiquetarla para el agente, sin esperar al cron.
  if (task?.source === 'github' && task.columnId !== columnId) flushGithubSoon(m)

  if (o.undoing) return true
  const same = fromColumnId === columnId
  const inTarget = prev?.tasks.filter((t) => t.columnId === columnId && t.id !== taskId).length ?? 0
  const over = target?.wipLimit != null && inTarget + 1 > target.wipLimit
  notify.success(
    o.verb === 'completed'
      ? `«${title}» completada`
      : o.verb === 'reopened'
        ? `«${title}» reabierta`
        : same
          ? `«${title}» reordenada`
          : `«${title}» movida${target ? ` a ${target.name}` : ''}`,
    {
      icon: o.verb === 'completed' ? 'check' : 'move',
      description: over
        ? `${target?.name} supera su límite (${inTarget + 1} de ${target?.wipLimit})`
        : undefined,
      action: fromColumnId
        ? {
            label: 'Deshacer',
            onClick: async () => {
              const ok = await moveTask(m, qc, {
                projectId,
                taskId,
                columnId: fromColumnId,
                index: fromIndex,
                title,
                fromColumnId: columnId,
                undoing: true,
              })
              if (ok) notify.info('Movimiento deshecho', { icon: 'move' })
            },
          }
        : undefined,
    },
  )
  return true
}

async function columnsOf(m: Muninn, qc: QueryClient, projectId: string): Promise<BoardColumn[]> {
  return board(qc, projectId)?.columns ?? (await m.columns.list(projectId))
}

/** A la columna «Hecho» (la primera de ese tipo), arriba del todo. */
export async function completeTask(m: Muninn, qc: QueryClient, task: TaskRef) {
  const done = (await columnsOf(m, qc, task.projectId)).find((c) => c.kind === 'done')
  if (!done) {
    notify.error('Este proyecto no tiene una columna «Hecho»', {
      description: 'Añade una o cambia el tipo de una columna.',
    })
    return false
  }
  return moveTask(m, qc, {
    projectId: task.projectId,
    taskId: task.id,
    columnId: done.id,
    index: 0,
    verb: 'completed',
    title: task.title,
    fromColumnId: task.columnId,
  })
}

/** Vuelve a la primera columna «Por hacer» (o la primera que no sea «Hecho»), sin contar la del agente. */
export async function reopenTask(m: Muninn, qc: QueryClient, task: TaskRef) {
  const agent = cachedProject(qc, task.projectId)?.agentColumnId
  const cols = (await columnsOf(m, qc, task.projectId)).filter((c) => c.id !== agent)
  const to = cols.find((c) => c.kind === 'todo') ?? cols.find((c) => c.kind !== 'done') ?? cols[0]
  if (!to) return false
  return moveTask(m, qc, {
    projectId: task.projectId,
    taskId: task.id,
    columnId: to.id,
    verb: 'reopened',
    title: task.title,
    fromColumnId: task.columnId,
  })
}

// ─── Crear, editar, archivar ────────────────────────────────────────────────

/** Crea una tarea (al final de su columna). «Deshacer» la archiva: el core no borra desde la UI. */
export async function createTask(
  m: Muninn,
  qc: QueryClient,
  input: CreateTaskInput,
): Promise<TaskWithColumn | null> {
  let created: TaskWithColumn
  try {
    const task = await serial(input.projectId, () => m.tasks.create(input))
    const data = board(qc, task.projectId)
    const column = data?.columns.find((c) => c.id === task.columnId)
    created = {
      ...task,
      column: { id: task.columnId, name: column?.name ?? '', kind: column?.kind ?? 'todo' },
    }
    if (data && column) {
      qc.setQueryData<BoardData>(keys.board(task.projectId), {
        ...data,
        tasks: [...data.tasks, created],
      })
    }
  } catch (err) {
    fail('No se pudo crear la tarea', err)
    return null
  }
  settle(qc, created.projectId, created.id)
  notify.success(`Tarea «${created.title}» creada`, {
    icon: 'plus',
    description: created.column.name || undefined,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        await archiveTask(m, qc, created, { undoing: true })
        notify.info(`«${created.title}» archivada`, { icon: 'archive' })
      },
    },
  })
  return created
}

export interface PatchToast {
  /** Qué ha cambiado: «Prioridad: Alta», «Título actualizado»… */
  message: string
  icon?: IconName
}

/**
 * Edita campos de una tarea. «Deshacer» devuelve los valores que tenía. `undoing` evita encadenar
 * un «Deshacer» sobre otro.
 */
export async function patchTask(
  m: Muninn,
  qc: QueryClient,
  task: TaskWithColumn,
  patch: UpdateTaskInput,
  toast: PatchToast,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const before = Object.fromEntries(
    Object.keys(patch).map((k) => [k, task[k as keyof TaskWithColumn]]),
  ) as UpdateTaskInput
  const prev = await optimistic(qc, task.projectId, (d) => ({
    ...d,
    tasks: d.tasks.map((t) => (t.id === task.id ? ({ ...t, ...patch } as TaskWithColumn) : t)),
  }))
  try {
    await serial(task.projectId, () => m.tasks.update(task.id, patch))
  } catch (err) {
    rollback(qc, task.projectId, prev)
    fail('No se pudo guardar el cambio', err)
    return false
  }
  settle(qc, task.projectId, task.id)
  if (opts.undoing) return true
  notify.success(toast.message, {
    icon: toast.icon,
    id: `patch-${task.id}`,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        const ok = await patchTask(m, qc, { ...task, ...patch } as TaskWithColumn, before, toast, {
          undoing: true,
        })
        if (ok) notify.info('Cambio deshecho')
      },
    },
  })
  return true
}

/** Archiva (la quita del tablero). «Deshacer» la restaura en su columna y posición. */
export async function archiveTask(
  m: Muninn,
  qc: QueryClient,
  task: TaskRef,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const prev = await optimistic(qc, task.projectId, (d) => ({
    ...d,
    tasks: d.tasks.filter((t) => t.id !== task.id),
  }))
  try {
    await serial(task.projectId, () => m.tasks.archive(task.id))
  } catch (err) {
    rollback(qc, task.projectId, prev)
    fail('No se pudo archivar la tarea', err)
    return false
  }
  settle(qc, task.projectId, task.id)
  if (opts.undoing) return true
  notify.success(`«${task.title}» archivada`, {
    icon: 'archive',
    action: {
      label: 'Deshacer',
      onClick: async () => {
        try {
          await serial(task.projectId, () => m.tasks.restore(task.id))
          settle(qc, task.projectId, task.id)
          notify.info(`«${task.title}» recuperada`, { icon: 'archive' })
        } catch (err) {
          fail('No se pudo recuperar la tarea', err)
        }
      },
    },
  })
  return true
}

// ─── Subtareas ──────────────────────────────────────────────────────────────

const refreshChecklist = (qc: QueryClient, task: Pick<TaskRef, 'id' | 'projectId'>) => {
  void qc.invalidateQueries({ queryKey: keys.checklist(task.id) })
  settle(qc, task.projectId, task.id)
}

export async function addChecklistItem(
  m: Muninn,
  qc: QueryClient,
  task: TaskRef,
  title: string,
): Promise<boolean> {
  let item: ChecklistItem
  try {
    item = await m.checklist.add(task.id, title)
  } catch (err) {
    fail('No se pudo añadir la subtarea', err)
    return false
  }
  refreshChecklist(qc, task)
  notify.success('Subtarea añadida', {
    icon: 'plus',
    description: item.title,
    id: `cl-${task.id}`,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        await m.checklist.delete(item.id)
        refreshChecklist(qc, task)
        notify.info('Subtarea quitada')
      },
    },
  })
  return true
}

export async function setChecklistDone(
  m: Muninn,
  qc: QueryClient,
  task: TaskRef,
  item: ChecklistItem,
  done: boolean,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const key = keys.checklist(task.id)
  const prev = qc.getQueryData<ChecklistItem[]>(key)
  qc.setQueryData<ChecklistItem[]>(key, (items) =>
    items?.map((i) => (i.id === item.id ? { ...i, done } : i)),
  )
  try {
    await m.checklist.update(item.id, { done })
  } catch (err) {
    qc.setQueryData(key, prev)
    fail('No se pudo actualizar la subtarea', err)
    return false
  }
  refreshChecklist(qc, task)
  if (opts.undoing) return true
  notify.success(done ? 'Subtarea hecha' : 'Subtarea pendiente', {
    icon: 'check',
    description: item.title,
    id: `cl-${item.id}`,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        const ok = await setChecklistDone(m, qc, task, item, !done, { undoing: true })
        if (ok) notify.info('Cambio deshecho')
      },
    },
  })
  return true
}

export async function deleteChecklistItem(
  m: Muninn,
  qc: QueryClient,
  task: TaskRef,
  item: ChecklistItem,
  index: number,
): Promise<boolean> {
  const key = keys.checklist(task.id)
  const prev = qc.getQueryData<ChecklistItem[]>(key)
  qc.setQueryData<ChecklistItem[]>(key, (items) => items?.filter((i) => i.id !== item.id))
  try {
    await m.checklist.delete(item.id)
  } catch (err) {
    qc.setQueryData(key, prev)
    fail('No se pudo quitar la subtarea', err)
    return false
  }
  refreshChecklist(qc, task)
  notify.success('Subtarea quitada', {
    icon: 'trash',
    description: item.title,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        await m.checklist.add(task.id, item.title, { done: item.done, index })
        refreshChecklist(qc, task)
        notify.info('Subtarea recuperada')
      },
    },
  })
  return true
}
