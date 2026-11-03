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
import { i18n, t } from '../i18n'
import { blocksAgentDrop, flushGithubSoon } from './agent'
import { applyTaskMove, type BoardData, indexInColumn } from './board'
import { dueToast } from './calendar'
import { notifyUndo } from './feedback'
import { fail, optimistic, previousValues, rollback, serial, settle } from './mutations'
import { keys } from './queries'

/**
 * Acciones sobre tareas y subtareas, con feedback y «Deshacer» (ADR-0019). Cada una refleja el cambio
 * en la caché al instante y escribe en el core; ver `mutations.ts`. Archivar es reversible; eliminar para
 * siempre solo se puede con las archivadas, y espera lo que dura el aviso para que «Deshacer» no pierda nada
 * (`deleteArchivedTasksWithUndo`, ADR-0067).
 */

type TaskRef = Pick<TaskWithColumn, 'id' | 'projectId' | 'columnId' | 'title'>

const board = (qc: QueryClient, projectId: string) =>
  qc.getQueryData<BoardData>(keys.board(projectId))

/** El proyecto en caché (para su columna del agente). */
const cachedProject = (qc: QueryClient, projectId: string) =>
  qc.getQueryData<Project>(keys.project(projectId))

/**
 * Los avisos usan el namespace `task`, y estas acciones se llaman también desde el tablero, Inicio o el diálogo de
 * nueva tarea: se carga antes de avisar (si ya está, no espera a nada).
 */
const ready = () => i18n.loadNamespaces('task')

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
    await ready()
    notify.error(t('actions.agentOnlyGithub', { ns: 'task' }), {
      description: t('actions.agentOnlyGithubHint', { ns: 'task' }),
    })
    return false
  }
  const prev = await optimistic(qc, projectId, (d) => applyTaskMove(d, taskId, columnId, index))
  const task = prev?.tasks.find((t) => t.id === taskId)
  const fromColumnId = task?.columnId ?? o.fromColumnId
  const fromIndex = prev ? indexInColumn(prev, taskId) : undefined
  await ready()
  const title = task?.title ?? o.title ?? t('actions.defaultTitle', { ns: 'task' })
  const target = prev?.columns.find((c) => c.id === columnId)

  try {
    await serial(projectId, () => m.tasks.move(taskId, { columnId, index }))
  } catch (err) {
    rollback(qc, projectId, prev)
    fail(t('actions.moveFailed', { ns: 'task' }), err)
    return false
  }
  settle(qc, projectId, taskId)
  // Cerrar o reabrir la issue, o etiquetarla para el agente, sin esperar al cron.
  if (task?.source === 'github' && task.columnId !== columnId) flushGithubSoon(m)

  if (o.undoing) return true
  const same = fromColumnId === columnId
  const inTarget = prev?.tasks.filter((t) => t.columnId === columnId && t.id !== taskId).length ?? 0
  const over = target?.wipLimit != null && inTarget + 1 > target.wipLimit
  notifyUndo(
    o.verb === 'completed'
      ? t('actions.completed', { ns: 'task', title })
      : o.verb === 'reopened'
        ? t('actions.reopened', { ns: 'task', title })
        : same
          ? t('actions.reordered', { ns: 'task', title })
          : target
            ? t('actions.movedTo', { ns: 'task', title, column: target.name })
            : t('actions.moved', { ns: 'task', title }),
    {
      icon: o.verb === 'completed' ? 'check' : 'move',
      description: over
        ? t('actions.overLimit', {
            ns: 'task',
            column: target?.name ?? '',
            count: inTarget + 1,
            limit: target?.wipLimit ?? 0,
          })
        : undefined,
      // Sin tablero en caché ni `o.fromColumnId` no se sabe de dónde venía.
      undo: fromColumnId
        ? () =>
            moveTask(m, qc, {
              projectId,
              taskId,
              columnId: fromColumnId,
              index: fromIndex,
              title,
              fromColumnId: columnId,
              undoing: true,
            })
        : null,
      undone: [t('actions.moveUndone', { ns: 'task' }), { icon: 'move' }],
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
    await ready()
    notify.error(t('actions.noDoneColumn', { ns: 'task' }), {
      description: t('actions.noDoneColumnHint', { ns: 'task' }),
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
  await ready()
  try {
    const task = await serial(input.projectId, () => m.tasks.create(input))
    const data = board(qc, task.projectId)
    const column = data?.columns.find((c) => c.id === task.columnId)
    created = {
      ...task,
      column: {
        id: task.columnId,
        name: column?.name ?? '',
        kind: column?.kind ?? 'todo',
        color: column?.color ?? null,
      },
    }
    if (data && column) {
      qc.setQueryData<BoardData>(keys.board(task.projectId), {
        ...data,
        tasks: [...data.tasks, created],
      })
    }
  } catch (err) {
    fail(t('actions.createFailed', { ns: 'task' }), err)
    return null
  }
  settle(qc, created.projectId, created.id)
  notifyUndo(t('actions.created', { ns: 'task', title: created.title }), {
    icon: 'plus',
    description: created.column.name || undefined,
    undo: () => archiveTask(m, qc, created, { undoing: true }),
    undone: [t('actions.archived', { ns: 'task', title: created.title }), { icon: 'archive' }],
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
  const before = previousValues(task, patch)
  const prev = await optimistic(qc, task.projectId, (d) => ({
    ...d,
    tasks: d.tasks.map((t) => (t.id === task.id ? ({ ...t, ...patch } as TaskWithColumn) : t)),
  }))
  await ready()
  try {
    await serial(task.projectId, () => m.tasks.update(task.id, patch))
  } catch (err) {
    rollback(qc, task.projectId, prev)
    fail(t('actions.saveFailed', { ns: 'task' }), err)
    return false
  }
  settle(qc, task.projectId, task.id)
  if (opts.undoing) return true
  notifyUndo(toast.message, {
    icon: toast.icon,
    id: `patch-${task.id}`,
    undo: () =>
      patchTask(m, qc, { ...task, ...patch } as TaskWithColumn, before, toast, { undoing: true }),
  })
  return true
}

/**
 * Cambia (o quita, con `null`) la fecha de vencimiento: lo que hace soltar una tarea en un día del calendario o
 * en «Sin fecha» (ADR-0068). La columna no cambia. El aviso dice cuándo vence y su «Deshacer» devuelve la de antes.
 */
export async function setDueDate(
  m: Muninn,
  qc: QueryClient,
  task: TaskWithColumn,
  dueDate: string | null,
): Promise<boolean> {
  if ((task.dueDate ?? null) === dueDate) return true
  // El aviso es del calendario (`board`): se puede cambiar la fecha desde otras pantallas.
  await i18n.loadNamespaces('board')
  return patchTask(
    m,
    qc,
    task,
    { dueDate },
    { message: dueToast(dueDate, m.today()), icon: 'calendar' },
  )
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
  await ready()
  try {
    await serial(task.projectId, () => m.tasks.archive(task.id))
  } catch (err) {
    rollback(qc, task.projectId, prev)
    fail(t('actions.archiveFailed', { ns: 'task' }), err)
    return false
  }
  settle(qc, task.projectId, task.id)
  if (opts.undoing) return true
  notifyUndo(t('actions.archived', { ns: 'task', title: task.title }), {
    icon: 'archive',
    undo: async () => {
      await serial(task.projectId, () => m.tasks.restore(task.id))
      settle(qc, task.projectId, task.id)
    },
    undone: [t('actions.restored', { ns: 'task', title: task.title }), { icon: 'archive' }],
    failTitle: t('actions.restoreFailed', { ns: 'task' }),
  })
  return true
}

/** Saca una tarea de «Archivadas» y la devuelve a su columna. «Deshacer» la vuelve a archivar. */
export async function restoreArchivedTask(
  m: Muninn,
  qc: QueryClient,
  task: Pick<TaskRef, 'id' | 'projectId' | 'title'>,
): Promise<boolean> {
  await ready()
  try {
    await serial(task.projectId, () => m.tasks.restore(task.id))
  } catch (err) {
    fail(t('actions.restoreFailed', { ns: 'task' }), err)
    return false
  }
  settle(qc, task.projectId, task.id)
  notifyUndo(t('actions.restored', { ns: 'task', title: task.title }), {
    icon: 'archive',
    description: t('actions.restoredHint', { ns: 'task' }),
    undo: async () => {
      await serial(task.projectId, () => m.tasks.archive(task.id))
      settle(qc, task.projectId, task.id)
    },
    undone: [t('actions.archivedAgain', { ns: 'task', title: task.title }), { icon: 'archive' }],
    failTitle: t('actions.archiveFailed', { ns: 'task' }),
  })
  return true
}

/** Lo que dura el aviso de «Eliminar»: hasta entonces no se borra nada. */
const DELETE_DELAY = 6000

/**
 * Elimina para siempre tareas archivadas de un proyecto (ADR-0067, como los proyectos en ADR-0065). No pregunta:
 * las quita de la vista y espera lo que dura el aviso; «Deshacer» las devuelve sin haber borrado nada. Si se cierra
 * la app antes, no se borran.
 */
export function deleteArchivedTasksWithUndo(
  m: Muninn,
  qc: QueryClient,
  projectId: string,
  tasks: Pick<TaskWithColumn, 'id' | 'title' | 'source'>[],
  view: { hide: (ids: string[]) => void; show: (ids: string[]) => void },
) {
  const ids = tasks.map((t) => t.id)
  const one = tasks.length === 1
  const fromGithub = tasks.some((t) => t.source === 'github')
  view.hide(ids)
  const timer = setTimeout(async () => {
    const failed: string[] = []
    for (const id of ids)
      await serial(projectId, () => m.tasks.delete(id)).catch(() => failed.push(id))
    settle(qc, projectId)
    view.show(failed)
    if (failed.length)
      notify.error(t('actions.deleteFailed', { ns: 'task' }), {
        description: t('actions.deleteLeft', { ns: 'task', count: failed.length }),
      })
  }, DELETE_DELAY)
  const toast = () =>
    notifyUndo(
      one
        ? t('actions.deletedOne', { ns: 'task', title: tasks[0]?.title ?? '' })
        : t('actions.deletedMany', { ns: 'task', count: tasks.length }),
      {
        icon: 'trash',
        description: fromGithub
          ? t('actions.deletedGithubHint', { ns: 'task' })
          : t('actions.deletedHint', { ns: 'task' }),
        duration: DELETE_DELAY,
        // Aún no se ha borrado nada: deshacer es cancelar la espera, no puede fallar.
        undo: () => {
          clearTimeout(timer)
          view.show(ids)
        },
        undone: t(one ? 'actions.deleteUndoneOne' : 'actions.deleteUndoneMany', { ns: 'task' }),
      },
    )
  // Es síncrona (la vista se actualiza ya): si el namespace aún no está, el aviso sale al tenerlo.
  if (i18n.hasLoadedNamespace('task')) toast()
  else void ready().then(toast)
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
  await ready()
  try {
    item = await m.checklist.add(task.id, title)
  } catch (err) {
    fail(t('actions.subtaskAddFailed', { ns: 'task' }), err)
    return false
  }
  refreshChecklist(qc, task)
  notifyUndo(t('actions.subtaskAdded', { ns: 'task' }), {
    icon: 'plus',
    description: item.title,
    id: `cl-${task.id}`,
    undo: async () => {
      await m.checklist.delete(item.id)
      refreshChecklist(qc, task)
    },
    undone: t('actions.subtaskRemoved', { ns: 'task' }),
    failTitle: t('actions.subtaskRemoveFailed', { ns: 'task' }),
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
  await ready()
  try {
    await m.checklist.update(item.id, { done })
  } catch (err) {
    qc.setQueryData(key, prev)
    fail(t('actions.subtaskUpdateFailed', { ns: 'task' }), err)
    return false
  }
  refreshChecklist(qc, task)
  if (opts.undoing) return true
  notifyUndo(t(done ? 'actions.subtaskDone' : 'actions.subtaskPending', { ns: 'task' }), {
    icon: 'check',
    description: item.title,
    id: `cl-${item.id}`,
    undo: () => setChecklistDone(m, qc, task, item, !done, { undoing: true }),
  })
  return true
}

/** Mueve una subtarea. `index` cuenta las demás (como `checklist.move`); «Deshacer» la devuelve a `from`. */
export async function moveChecklistItem(
  m: Muninn,
  qc: QueryClient,
  task: TaskRef,
  item: ChecklistItem,
  index: number,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const key = keys.checklist(task.id)
  const prev = qc.getQueryData<ChecklistItem[]>(key)
  const from = prev?.findIndex((i) => i.id === item.id) ?? -1
  if (from === index) return true
  qc.setQueryData<ChecklistItem[]>(key, (items) => {
    if (!items) return items
    const rest = items.filter((i) => i.id !== item.id)
    return [...rest.slice(0, index), item, ...rest.slice(index)]
  })
  await ready()
  try {
    await m.checklist.move(item.id, index)
  } catch (err) {
    qc.setQueryData(key, prev)
    fail(t('actions.subtaskMoveFailed', { ns: 'task' }), err)
    return false
  }
  refreshChecklist(qc, task)
  if (opts.undoing || from < 0) return true
  notifyUndo(t('actions.subtaskMoved', { ns: 'task' }), {
    icon: 'move',
    description: item.title,
    id: `cl-move-${item.id}`,
    undo: () => moveChecklistItem(m, qc, task, item, from, { undoing: true }),
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
  await ready()
  try {
    await m.checklist.delete(item.id)
  } catch (err) {
    qc.setQueryData(key, prev)
    fail(t('actions.subtaskRemoveFailed', { ns: 'task' }), err)
    return false
  }
  refreshChecklist(qc, task)
  notifyUndo(t('actions.subtaskRemoved', { ns: 'task' }), {
    icon: 'trash',
    description: item.title,
    undo: async () => {
      await m.checklist.add(task.id, item.title, { done: item.done, index })
      refreshChecklist(qc, task)
    },
    undone: t('actions.subtaskRestored', { ns: 'task' }),
    failTitle: t('actions.subtaskRestoreFailed', { ns: 'task' }),
  })
  return true
}
