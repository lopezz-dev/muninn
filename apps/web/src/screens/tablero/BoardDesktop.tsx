import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import type { BoardColumn } from '@muninn/core'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type BoardData,
  colId,
  colKey,
  findColumn,
  groupByColumn,
  type ItemsByColumn,
  idsByColumn,
  isColKey,
  moveAcross,
} from '../../lib/board'
import { type BoardFilter, filterTasks, fullIndex } from '../../lib/board-filter'
import { moveColumn } from '../../lib/column-actions'
import { useMuninn } from '../../lib/muninn'
import { moveTask } from '../../lib/task-actions'
import { Column, ColumnOverlay } from './Column'
import { ColumnDialog } from './ColumnDialog'
import {
  announcements,
  boardCollision,
  boardKeyboard,
  placeOf,
  screenReaderInstructions,
} from './dnd'
import { TaskCardOverlay } from './TaskCard'

interface DragState {
  type: 'card' | 'column'
  id: string
  /** Copia local del reparto de tarjetas: se va reordenando en vivo y se confirma al soltar. */
  items: ItemsByColumn
  cols: string[]
}

/**
 * Tablero de escritorio (≥ 768 px): columnas en fila con scroll horizontal. Las tarjetas se arrastran
 * entre columnas y las columnas por su asa; con ratón, tacto o teclado (Espacio, flechas, Espacio).
 * Al soltar se escribe una sola vez (`tasks.move` / `columns.move`) y la caché se adelanta al servidor.
 */
export function BoardDesktop({
  projectId,
  board,
  today,
  filter,
}: {
  projectId: string
  board: BoardData
  today: string
  filter: BoardFilter
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [drag, setDrag] = useState<DragState | null>(null)
  const [editing, setEditing] = useState<BoardColumn | 'new' | null>(null)

  // Con un filtro puesto solo se ven (y se arrastran) las tareas que lo cumplen; el índice que se manda al
  // servidor sigue siendo el de la columna entera (`fullIndex`).
  const visible = useMemo(
    () => filterTasks(board.tasks, filter, today),
    [board.tasks, filter, today],
  )
  const groups = useMemo(() => groupByColumn(board.columns, visible), [board.columns, visible])
  const idle = useMemo(() => idsByColumn(groups), [groups])
  const allIds = useMemo(
    () => idsByColumn(groupByColumn(board.columns, board.tasks)),
    [board.columns, board.tasks],
  )
  const items = drag?.items ?? idle
  const colOrder = drag?.cols ?? board.columns.map((c) => c.id)
  const columnById = useMemo(() => new Map(board.columns.map((c) => [c.id, c])), [board.columns])
  const taskById = useMemo(() => new Map(board.tasks.map((t) => [t.id, t])), [board.tasks])

  const itemsRef = useRef(items)
  itemsRef.current = items
  const lastOver = useRef<UniqueIdentifier | null>(null)
  const recentlyMoved = useRef(false)
  useEffect(() => {
    recentlyMoved.current = false
  })
  const collision = useMemo(
    () => boardCollision(() => itemsRef.current, lastOver, recentlyMoved),
    [],
  )

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboard,
      // Enter queda para abrir la tarea (las tarjetas son enlaces).
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )

  const colName = (id: string) => columnById.get(id)?.name ?? ''
  const a11y = {
    screenReaderInstructions,
    announcements: announcements({
      name: (id) =>
        isColKey(id)
          ? `la columna ${colName(colId(String(id)))}`
          : `«${taskById.get(String(id))?.title ?? ''}»`,
      where: (id) =>
        isColKey(id)
          ? `sobre la columna ${colName(colId(String(id)))}`
          : placeOf(itemsRef.current, String(id), colName),
    }),
  }

  const onDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current?.type === 'column' ? 'column' : 'card'
    setDrag({
      type,
      id: String(e.active.id),
      items: idle,
      cols: board.columns.map((c) => c.id),
    })
  }

  // Una tarjeta que pasa a otra columna se cuela ya en ella: las demás se apartan mientras arrastras.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.data.current?.type === 'column') return
    const activeId = String(active.id)
    const overId = String(over.id)
    setDrag((d) => {
      if (!d) return d
      const from = findColumn(d.items, activeId)
      const to = isColKey(overId) ? colId(overId) : findColumn(d.items, overId)
      if (!from || !to || from === to) return d
      const overRect = over.rect
      const activeRect = active.rect.current.translated
      const below =
        !isColKey(overId) && activeRect
          ? activeRect.top > overRect.top + overRect.height / 2
          : false
      recentlyMoved.current = true
      return {
        ...d,
        items: moveAcross(d.items, activeId, to, isColKey(overId) ? null : overId, below),
      }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const d = drag
    setDrag(null)
    lastOver.current = null
    if (!d || !over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    if (d.type === 'column') {
      const column = columnById.get(colId(activeId))
      const overCol = isColKey(overId) ? colId(overId) : findColumn(d.items, overId)
      const to = overCol ? d.cols.indexOf(overCol) : -1
      const from = d.cols.indexOf(colId(activeId))
      // `columns.move` cuenta las demás columnas: el índice final de la lista ya es ese.
      if (column && to >= 0 && to !== from) void moveColumn(m, qc, column, to)
      return
    }

    let next = d.items
    const column = findColumn(next, activeId)
    if (!column) return
    const overColumn = isColKey(overId) ? colId(overId) : findColumn(next, overId)
    if (overColumn === column && !isColKey(overId)) {
      const list = next[column] ?? []
      const [from, to] = [list.indexOf(activeId), list.indexOf(overId)]
      if (from !== to) next = { ...next, [column]: arrayMove(list, from, to) }
    }
    const originColumn = findColumn(idle, activeId)
    const originIndex = originColumn ? (idle[originColumn] ?? []).indexOf(activeId) : -1
    if (column === originColumn && (next[column] ?? []).indexOf(activeId) === originIndex) return
    const index = fullIndex(allIds[column] ?? [], next[column] ?? [], activeId)
    void moveTask(m, qc, { projectId, taskId: activeId, columnId: column, index })
  }

  const activeTask = drag?.type === 'card' ? taskById.get(drag.id) : undefined
  const activeColumn = drag?.type === 'column' ? columnById.get(colId(drag.id)) : undefined

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        accessibility={a11y}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDrag(null)
          lastOver.current = null
        }}
      >
        <section
          aria-label="Columnas"
          // flex-1 + min-h-0: el tablero mide lo que queda de ventana; las columnas llegan al pie (se puede
          // soltar en todo su alto) y sus tarjetas hacen scroll dentro (ADR-0047).
          className="-mx-8 flex min-h-0 flex-1 gap-3 overflow-x-auto px-8 pb-3"
        >
          <SortableContext items={colOrder.map(colKey)} strategy={horizontalListSortingStrategy}>
            {colOrder.map((id) => {
              const column = columnById.get(id)
              if (!column) return null
              return (
                <Column
                  key={id}
                  column={column}
                  columns={board.columns}
                  tasks={(items[id] ?? []).flatMap((t) => taskById.get(t) ?? [])}
                  // Cuenta la columna entera (para el límite), también con un filtro puesto y arrastrando.
                  total={
                    (allIds[id]?.length ?? 0) + (items[id]?.length ?? 0) - (idle[id]?.length ?? 0)
                  }
                  counts={board.counts}
                  today={today}
                  projectId={projectId}
                  onEdit={setEditing}
                />
              )
            })}
          </SortableContext>
        </section>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}>
          {activeTask ? (
            <TaskCardOverlay
              task={activeTask}
              progress={board.counts[activeTask.id]}
              today={today}
            />
          ) : activeColumn ? (
            <ColumnOverlay
              column={activeColumn}
              count={
                (allIds[activeColumn.id]?.length ?? 0) +
                (items[activeColumn.id]?.length ?? 0) -
                (idle[activeColumn.id]?.length ?? 0)
              }
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <ColumnDialog projectId={projectId} target={editing} onClose={() => setEditing(null)} />
    </>
  )
}
