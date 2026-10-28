import type { BoardColumn, ColumnKind, Muninn, UpdateColumnInput } from '@muninn/core'
import { notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { applyColumnMove, applyTaskMove, type BoardData } from './board'
import { fail, optimistic, rollback, serial, settle } from './mutations'
import { keys } from './queries'

/** Acciones sobre las columnas del tablero, con feedback y «Deshacer» (ver `task-actions.ts`). */

export interface NewColumn {
  projectId: string
  name: string
  kind: ColumnKind
  wipLimit?: number | null
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
    fail('No se pudo crear la columna', err)
    return null
  }
  qc.setQueryData<BoardData>(keys.board(input.projectId), (d) =>
    d ? { ...d, columns: [...d.columns, column] } : d,
  )
  settle(qc, input.projectId)
  notify.success(`Columna «${column.name}» creada`, {
    icon: 'plus',
    action: {
      label: 'Deshacer',
      onClick: async () => {
        try {
          await serial(input.projectId, () => m.columns.delete(column.id))
          qc.setQueryData<BoardData>(keys.board(input.projectId), (d) =>
            d ? { ...d, columns: d.columns.filter((c) => c.id !== column.id) } : d,
          )
          settle(qc, input.projectId)
          notify.info(`Columna «${column.name}» quitada`)
        } catch (err) {
          fail('No se pudo quitar la columna', err)
        }
      },
    },
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
  const before = Object.fromEntries(
    Object.keys(patch).map((k) => [k, column[k as keyof BoardColumn]]),
  ) as UpdateColumnInput
  const prev = await optimistic(qc, column.projectId, (d) => ({
    ...d,
    columns: d.columns.map((c) => (c.id === column.id ? ({ ...c, ...patch } as BoardColumn) : c)),
  }))
  try {
    await serial(column.projectId, () => m.columns.update(column.id, patch))
  } catch (err) {
    rollback(qc, column.projectId, prev)
    fail('No se pudo guardar la columna', err)
    return false
  }
  settle(qc, column.projectId)
  if (opts.undoing) return true
  notify.success(message, {
    icon: 'move',
    action: {
      label: 'Deshacer',
      onClick: async () => {
        const ok = await updateColumn(
          m,
          qc,
          { ...column, ...patch } as BoardColumn,
          before,
          message,
          {
            undoing: true,
          },
        )
        if (ok) notify.info('Cambio deshecho')
      },
    },
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
    fail('No se pudo mover la columna', err)
    return false
  }
  settle(qc, column.projectId)
  if (opts.undoing) return true
  notify.success(`Columna «${column.name}» movida`, {
    icon: 'move',
    action:
      fromIndex >= 0
        ? {
            label: 'Deshacer',
            onClick: async () => {
              const ok = await moveColumn(m, qc, column, fromIndex, { undoing: true })
              if (ok) notify.info('Movimiento deshecho', { icon: 'move' })
            },
          }
        : undefined,
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
    fail('No se pudo borrar la columna', err)
    return false
  }
  settle(qc, column.projectId)
  notify.success(`Columna «${column.name}» borrada`, {
    icon: 'trash',
    description:
      movedTaskIds.length && dest
        ? `${movedTaskIds.length === 1 ? '1 tarea movida' : `${movedTaskIds.length} tareas movidas`} a ${dest.name}`
        : undefined,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        try {
          const restored = await serial(column.projectId, async () => {
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
            return col
          })
          settle(qc, column.projectId)
          notify.info(`Columna «${restored.name}» recuperada`)
        } catch (err) {
          fail('No se pudo recuperar la columna', err)
        }
      },
    },
  })
  return true
}
