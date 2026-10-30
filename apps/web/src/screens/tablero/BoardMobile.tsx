import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { BoardColumn } from '@muninn/core'
import { cn, IconButton, icons } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAgentColumn } from '../../lib/agent'
import { type BoardData, isColKey, isTabKey, tabId, tabKey } from '../../lib/board'
import { type BoardFilter, fullIndex } from '../../lib/board-filter'
import { useBoardGroups } from '../../lib/board-groups'
import { useMuninn } from '../../lib/muninn'
import { completeTask, moveTask } from '../../lib/task-actions'
import { AgentMark, ColumnCount, KIND_DOT } from './Column'
import { ColumnDialog } from './ColumnDialog'
import { ColumnMenu } from './ColumnMenu'
import { announcements, screenReaderInstructions, useBoardSensors } from './dnd'
import { QuickAdd } from './QuickAdd'
import { SwipeToComplete } from './SwipeToComplete'
import { SortableTaskCard, TaskCardOverlay } from './TaskCard'

/** Pestaña de columna. También recibe tarjetas: soltar una sobre ella la pasa a esa columna. */
function Tab({
  column,
  count,
  selected,
  onSelect,
}: {
  column: BoardColumn
  count: number
  selected: boolean
  onSelect: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tabKey(column.id) })
  const el = useRef<HTMLButtonElement | null>(null)
  // La pestaña elegida (o la de En curso al abrir) siempre a la vista en la tira con scroll.
  useEffect(() => {
    if (selected) el.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [selected])
  return (
    <button
      ref={(node) => {
        el.current = node
        setNodeRef(node)
      }}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
        selected
          ? 'border-border-strong bg-surface-raised text-fg'
          : 'border-border text-fg-muted hover:text-fg',
        isOver && 'border-accent bg-accent-soft text-fg',
      )}
    >
      <span aria-hidden="true" className={cn('size-2 rounded-xs', KIND_DOT[column.kind])} />
      {column.name}
      <ColumnCount count={count} limit={column.wipLimit} />
    </button>
  )
}

/**
 * Tablero de móvil (< 768 px), como M-Tablero: pestañas de columnas y una lista de tarjetas grandes.
 * Mantén pulsada una tarjeta para reordenarla, o suéltala sobre otra pestaña para cambiarla de
 * columna; desliza a la izquierda para completarla.
 */
export function BoardMobile({
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
  const agentColumnId = useAgentColumn(projectId).columnId
  // Con un filtro puesto solo se ven las tareas que lo cumplen; el índice que se manda al servidor sigue
  // siendo el de la columna entera (`fullIndex`).
  const { groups, totals } = useBoardGroups(board, filter, today)
  const initial = board.columns.find((c) => c.kind === 'in_progress') ?? board.columns[0]
  const [picked, setPicked] = useState(initial?.id)
  const column = board.columns.find((c) => c.id === picked) ?? board.columns[0]
  const tasks = column ? (groups[column.id] ?? []) : []
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editing, setEditing] = useState<BoardColumn | 'new' | null>(null)
  const taskById = useMemo(() => new Map(board.tasks.map((t) => [t.id, t])), [board.tasks])

  const sensors = useBoardSensors(sortableKeyboardCoordinates)

  // Una pestaña bajo el dedo manda sobre las tarjetas; si no, la tarjeta más cercana.
  const collision: CollisionDetection = (args) => {
    const tab = pointerWithin(args).find((c) => isTabKey(c.id))
    if (tab) return [tab]
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => !isTabKey(c.id)),
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || !column) return
    const id = String(active.id)
    const overId = String(over.id)
    if (isTabKey(overId)) {
      const to = tabId(overId)
      if (to === column.id) return
      setPicked(to)
      void moveTask(m, qc, { projectId, taskId: id, columnId: to })
      return
    }
    if (isColKey(overId)) return
    const ids = tasks.map((t) => t.id)
    const [from, to] = [ids.indexOf(id), ids.indexOf(overId)]
    if (from < 0 || to < 0 || from === to) return
    // `to` es el índice final entre las visibles; `fullIndex` lo lleva a la columna entera.
    const moved = [...ids]
    moved.splice(from, 1)
    moved.splice(to, 0, id)
    const all = (totals[column.id] ?? []).map((t) => t.id)
    void moveTask(m, qc, {
      projectId,
      taskId: id,
      columnId: column.id,
      index: fullIndex(all, moved, id),
    })
  }

  const a11y = {
    screenReaderInstructions,
    announcements: announcements({
      name: (id) => `«${taskById.get(String(id))?.title ?? ''}»`,
      where: (id) =>
        isTabKey(id)
          ? `sobre la pestaña ${board.columns.find((c) => c.id === tabId(String(id)))?.name ?? ''}`
          : `posición ${tasks.findIndex((t) => t.id === String(id)) + 1} de ${tasks.length}`,
    }),
  }

  const activeTask = activeId ? taskById.get(activeId) : undefined
  const total = column ? (totals[column.id]?.length ?? 0) : 0
  const full = column?.wipLimit != null && total >= column.wipLimit

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        accessibility={a11y}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div
          role="tablist"
          aria-label="Columnas"
          className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1"
        >
          {board.columns.map((c) => (
            <Tab
              key={c.id}
              column={c}
              count={totals[c.id]?.length ?? 0}
              selected={c.id === column?.id}
              onSelect={() => setPicked(c.id)}
            />
          ))}
          <IconButton
            aria-label="Añadir columna"
            icon={<icons.plus size={16} />}
            size="lg"
            className="h-9 w-9 shrink-0"
            onClick={() => setEditing('new')}
          />
        </div>

        {column ? (
          <div className="flex flex-col gap-3" role="tabpanel" aria-label={column.name}>
            <div className="flex min-h-9 items-center gap-2 text-xs text-fg-subtle">
              {full ? (
                <span>
                  <b
                    className={cn(
                      'font-semibold',
                      total > (column?.wipLimit ?? 0) ? 'text-danger' : 'text-accent',
                    )}
                  >
                    {total > (column?.wipLimit ?? 0) ? 'Límite superado' : 'Límite alcanzado'}
                  </b>{' '}
                  · termina algo antes de empezar otra
                </span>
              ) : (
                <span>
                  {tasks.length === 1 ? '1 tarea' : `${tasks.length} tareas`}
                  {tasks.length !== total ? ` de ${total}` : ''} en {column.name}
                </span>
              )}
              {column.id === agentColumnId ? <AgentMark /> : null}
              <span className="ml-auto">
                <ColumnMenu
                  column={column}
                  columns={board.columns}
                  taskCount={total}
                  onEdit={setEditing}
                  size="lg"
                />
              </span>
            </div>

            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {tasks.map((t) => (
                  <SwipeToComplete
                    key={t.id}
                    onComplete={() => {
                      if (t.column.kind !== 'done') void completeTask(m, qc, t)
                    }}
                  >
                    <SortableTaskCard
                      task={t}
                      progress={board.counts[t.id]}
                      today={today}
                      projectId={projectId}
                      large
                    />
                  </SwipeToComplete>
                ))}
              </div>
            </SortableContext>

            {tasks.length === 0 ? (
              <p className="rounded-md border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-faint">
                {total > 0 ? 'Ninguna tarea cumple el filtro.' : `Sin tareas en ${column.name}.`}
              </p>
            ) : (
              <p className="px-2 text-center text-xs leading-relaxed text-fg-faint">
                Desliza a la izquierda para completar · mantén pulsado y suelta sobre otra pestaña
                para cambiar de columna
              </p>
            )}
            {column.kind === 'done' || column.id === agentColumnId ? null : (
              <QuickAdd projectId={projectId} columnId={column.id} large />
            )}
          </div>
        ) : null}

        <DragOverlay>
          {activeTask ? (
            <TaskCardOverlay
              task={activeTask}
              progress={board.counts[activeTask.id]}
              today={today}
              large
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <ColumnDialog projectId={projectId} target={editing} onClose={() => setEditing(null)} />
    </>
  )
}
