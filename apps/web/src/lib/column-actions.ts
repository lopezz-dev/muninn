import type { BoardColumn, ColumnKind, Muninn, UpdateColumnInput } from '@muninn/core'
import type { QueryClient } from '@tanstack/react-query'
import { t } from '../i18n'
import { applyColumnMove, applyTaskMove, type BoardData } from './board'
import { notifyUndo } from './feedback'
import { fail, optimistic, previousValues, rollback, serial, settle } from './mutations'
import { keys } from './queries'

/** Acciones sobre las columnas del tablero, con feedback y «Deshacer» (ver `task-actions.ts`). */

export interface NewColumn {
  projectId: string
  name: string
  kind: ColumnKind
  wipLimit?: number | null
  /** Color propio de la paleta (`blue`, `violet`…); `null` o sin poner, el del tipo. */
  color?: string | null
}

/** Crea una columna al final. «Deshacer» la quita (sigue vacía, así que no pierde nada). */
export async function createColumn(
  m: Muninn,
  qc: QueryClient,
  input: NewColumn,
): Promise<BoardColumn | null> {
  let column: BoardColumn
  try {
    column = await serial(input.projectId, () => m.columns.create(input))
  } catch (err) {
    fail(t('columnActions.createFailed', { ns: 'board' }), err)
    return null
  }
  qc.setQueryData<BoardData>(keys.board(input.projectId), (d) =>
    d ? { ...d, columns: [...d.columns, column] } : d,
  )
  settle(qc, input.projectId)
  notifyUndo(t('columnActions.created', { ns: 'board', name: column.name }), {
    icon: 'plus',
    undo: async () => {
      await serial(input.projectId, () => m.columns.delete(column.id))
      qc.setQueryData<BoardData>(keys.board(input.projectId), (d) =>
        d ? { ...d, columns: d.columns.filter((c) => c.id !== column.id) } : d,
      )
      settle(qc, input.projectId)
    },
    undone: t('columnActions.removed', { ns: 'board', name: column.name }),
    failTitle: t('columnActions.removeFailed', { ns: 'board' }),
  })
  return column
}

/** Cambia nombre, tipo o límite. Cambiar el tipo a/desde «Hecho» completa o reabre sus tareas. */
export async function updateColumn(
  m: Muninn,
  qc: QueryClient,
  column: BoardColumn,
  patch: UpdateColumnInput,
  message: string,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const before = previousValues(column, patch)
  const next = { ...column, ...patch } as BoardColumn
  const prev = await optimistic(qc, column.projectId, (d) => ({
    ...d,
    columns: d.columns.map((c) => (c.id === column.id ? next : c)),
    // Las tareas llevan una copia de su columna (nombre, tipo, color): que cambie a la vez en todas las vistas.
    tasks: d.tasks.map((t) =>
      t.columnId === column.id
        ? { ...t, column: { id: next.id, name: next.name, kind: next.kind, color: next.color } }
        : t,
    ),
  }))
  try {
    await serial(column.projectId, () => m.columns.update(column.id, patch))
  } catch (err) {
    rollback(qc, column.projectId, prev)
    fail(t('columnActions.saveFailed', { ns: 'board' }), err)
    return false
  }
  settle(qc, column.projectId)
  if (opts.undoing) return true
  notifyUndo(message, {
    icon: 'move',
    undo: () =>
      updateColumn(m, qc, { ...column, ...patch } as BoardColumn, before, message, {
        undoing: true,
      }),
  })
  return true
}

/** Mueve una columna. `index` cuenta las demás columnas (0 = la primera). */
export async function moveColumn(
  m: Muninn,
  qc: QueryClient,
  column: Pick<BoardColumn, 'id' | 'projectId' | 'name'>,
  index: number,
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  const prev = await optimistic(qc, column.projectId, (d) => applyColumnMove(d, column.id, index))
  const fromIndex = prev?.columns.findIndex((c) => c.id === column.id) ?? -1
  try {
    await serial(column.projectId, () => m.columns.move(column.id, index))
  } catch (err) {
    rollback(qc, column.projectId, prev)
    fail(t('columnActions.moveFailed', { ns: 'board' }), err)
    return false
  }
  settle(qc, column.projectId)
  if (opts.undoing) return true
  notifyUndo(t('columnActions.moved', { ns: 'board', name: column.name }), {
    icon: 'move',
    // Sin tablero en caché no se sabe de dónde venía.
    undo: fromIndex >= 0 ? () => moveColumn(m, qc, column, fromIndex, { undoing: true }) : null,
    undone: [t('columnActions.moveUndone', { ns: 'board' }), { icon: 'move' }],
  })
  return true
}

/**
 * Borra una columna. Si tiene tareas, pasan a `moveTasksTo` (el core lo exige). «Deshacer» recrea la
 * columna donde estaba y le devuelve sus tareas en su orden, incluidas las archivadas.
 */
export async function deleteColumn(
  m: Muninn,
  qc: QueryClient,
  column: BoardColumn,
  moveTasksTo?: BoardColumn,
): Promise<boolean> {
  const moved = (qc.getQueryData<BoardData>(keys.board(column.projectId))?.tasks ?? []).filter(
    (t) => t.columnId === column.id,
  )
  const index = qc
    .getQueryData<BoardData>(keys.board(column.projectId))
    ?.columns.findIndex((c) => c.id === column.id)
  const dest = moveTasksTo
  const prev = await optimistic(qc, column.projectId, (d) => {
    let next: BoardData = d
    if (dest) for (const t of moved) next = applyTaskMove(next, t.id, dest.id)
    return { ...next, columns: next.columns.filter((c) => c.id !== column.id) }
  })
  let movedTaskIds: string[]
  try {
    ;({ movedTaskIds } = await serial(column.projectId, () =>
      m.columns.delete(column.id, { moveTasksTo: dest?.id }),
    ))
  } catch (err) {
    rollback(qc, column.projectId, prev)
    fail(t('columnActions.deleteFailed', { ns: 'board' }), err)
    return false
  }
  settle(qc, column.projectId)
  notifyUndo(t('columnActions.deleted', { ns: 'board', name: column.name }), {
    icon: 'trash',
    description:
      movedTaskIds.length && dest
        ? t('columnActions.tasksMoved', {
            ns: 'board',
            count: movedTaskIds.length,
            name: dest.name,
          })
        : undefined,
    undo: async () => {
      await serial(column.projectId, async () => {
        const col = await m.columns.create({
          projectId: column.projectId,
          name: column.name,
          kind: column.kind,
          color: column.color,
          wipLimit: column.wipLimit,
          index: index != null && index >= 0 ? index : undefined,
        })
        for (const [i, id] of movedTaskIds.entries()) {
          await m.tasks.move(id, { columnId: col.id, index: i })
        }
      })
      settle(qc, column.projectId)
    },
    undone: t('columnActions.restored', { ns: 'board', name: column.name }),
    failTitle: t('columnActions.restoreFailed', { ns: 'board' }),
  })
  return true
}
