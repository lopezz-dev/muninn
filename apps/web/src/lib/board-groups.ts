import type { TaskWithColumn } from '@muninn/core'
import { useMemo } from 'react'
import { type BoardData, groupByColumn } from './board'
import { type BoardFilter, filterTasks } from './board-filter'

type Groups = Record<string, TaskWithColumn[]>

/**
 * Reparto del tablero por columnas, el mismo para todas las vistas (Tablero, móvil, Lista) y para el
 * contador de la cabecera. Con un filtro puesto, `groups` solo tiene las tareas que lo cumplen y
 * `totals`, la columna entera (para el límite y para `fullIndex` al soltar).
 */
export interface BoardGroups {
  /** Tareas que pasan el filtro, en el orden del tablero. Sin filtro es `board.tasks` tal cual. */
  visible: TaskWithColumn[]
  groups: Groups
  totals: Groups
  filtering: boolean
}

type BoardTasks = Pick<BoardData, 'columns' | 'tasks'>

export function boardGroups(board: BoardTasks, filter: BoardFilter, today: string): BoardGroups {
  const visible = filterTasks(board.tasks, filter, today)
  const totals = groupByColumn(board.columns, board.tasks)
  // Sin filtro, `visible` es el mismo array: no hace falta agrupar dos veces.
  const groups = visible === board.tasks ? totals : groupByColumn(board.columns, visible)
  return { visible, groups, totals, filtering: visible !== board.tasks }
}

const NONE: BoardTasks = { columns: [], tasks: [] }

/** `boardGroups` memorizado por partes. Acepta el tablero aún sin cargar (todo vacío). */
export function useBoardGroups(
  board: BoardTasks | undefined,
  filter: BoardFilter,
  today: string,
): BoardGroups {
  const { columns, tasks } = board ?? NONE
  const visible = useMemo(() => filterTasks(tasks, filter, today), [tasks, filter, today])
  const totals = useMemo(() => groupByColumn(columns, tasks), [columns, tasks])
  const groups = useMemo(
    () => (visible === tasks ? totals : groupByColumn(columns, visible)),
    [columns, tasks, visible, totals],
  )
  return { visible, groups, totals, filtering: visible !== tasks }
}
