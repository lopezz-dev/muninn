import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ChecklistItem, TaskWithColumn } from '@muninn/core'
import { Checkbox, cn, IconButton, icons, ProgressBar, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useMuninn } from '../../lib/muninn'
import { checklistQuery } from '../../lib/queries'
import {
  addChecklistItem,
  deleteChecklistItem,
  moveChecklistItem,
  setChecklistDone,
} from '../../lib/task-actions'

/** Solo arriba y abajo: es una lista. */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * Subtareas de una tarea: marcar, quitar, añadir (Enter) y reordenar arrastrando el asa (ratón, tacto o teclado:
 * Espacio, flechas, Espacio), cada cosa con su «Deshacer».
 */
export function Checklist({ task, touch }: { task: TaskWithColumn; touch?: boolean }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const items = useQuery(checklistQuery(m, task.id)).data ?? []
  const [title, setTitle] = useState('')
  const done = items.filter((i) => i.done).length
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const name = (id: unknown) => items.find((i) => i.id === id)?.title ?? ''
  const place = (id: unknown) =>
    `posición ${items.findIndex((i) => i.id === id) + 1} de ${items.length}`

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const clean = title.trim()
    if (!clean) return
    setTitle('')
    if (!(await addChecklistItem(m, qc, task, clean))) setTitle(clean)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const item = items.find((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    // Con `arrayMove`, el sitio final en la lista es también el índice entre las demás.
    if (item && to >= 0) void moveChecklistItem(m, qc, task, item, to)
  }

  return (
    <section aria-labelledby={`cl-${task.id}`} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <h2
          id={`cl-${task.id}`}
          className="text-xs font-semibold tracking-wider text-fg-subtle uppercase"
        >
          Subtareas
        </h2>
        {items.length ? (
          <>
            <span className="text-xs text-fg-subtle tabular">
              {done} de {items.length}
            </span>
            <ProgressBar
              value={done / items.length}
              label="Subtareas hechas"
              className="h-[3px] flex-1"
            />
          </>
        ) : null}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[vertical]}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Para mover la subtarea, pulsa Espacio. Con las flechas eliges el sitio, con Espacio sueltas y con Escape cancelas.',
          },
          announcements: {
            onDragStart: ({ active }) => `Has cogido «${name(active.id)}», ${place(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over ? `«${name(active.id)}» irá a la ${place(over.id)}.` : undefined,
            onDragEnd: ({ active, over }) =>
              over ? `«${name(active.id)}» queda en la ${place(over.id)}.` : undefined,
            onDragCancel: ({ active }) => `Cancelado: «${name(active.id)}» no se mueve.`,
          },
        }}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col">
            {items.map((item, index) => (
              <Row
                key={item.id}
                item={item}
                touch={touch}
                sortable={items.length > 1}
                onDone={(v) => setChecklistDone(m, qc, task, item, v)}
                onDelete={() => deleteChecklistItem(m, qc, task, item, index)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <form onSubmit={add}>
        <TextField
          label="Añadir subtarea"
          hideLabel
          placeholder="Añadir subtarea"
          leading={<icons.plus size={14} />}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          autoComplete="off"
          size={touch ? 'lg' : 'md'}
        />
      </form>
    </section>
  )
}

function Row({
  item,
  touch,
  sortable,
  onDone,
  onDelete,
}: {
  item: ChecklistItem
  touch?: boolean
  /** Con una sola subtarea no hay nada que reordenar: sin asa. */
  sortable: boolean
  onDone: (done: boolean) => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !sortable })
  // En escritorio, el asa y la papelera aparecen al pasar por la fila (o al llegar con el teclado).
  const reveal =
    !touch && 'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group relative flex items-center gap-3 border-border-subtle text-base',
        touch ? 'min-h-[52px] border-t first:border-t-0' : 'min-h-8',
        isDragging && 'z-10 rounded-md border-transparent bg-surface-raised shadow-drag',
      )}
    >
      {sortable ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Mover subtarea: ${item.title}`}
          className={cn(
            '-mr-2 grid shrink-0 cursor-grab touch-none place-items-center rounded-sm text-fg-faint outline-none hover:text-fg focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing',
            touch ? '-ml-2 size-11' : '-ml-1 size-6',
            reveal,
          )}
          {...attributes}
          {...listeners}
        >
          <icons.grip size={14} />
        </button>
      ) : null}
      <Checkbox
        checked={item.done}
        onCheckedChange={onDone}
        aria-label={`${item.done ? 'Desmarcar' : 'Marcar'}: ${item.title}`}
        touch={touch}
        size={touch ? 'lg' : 'md'}
      />
      <span
        className={cn('min-w-0 flex-1 break-words', item.done && 'text-fg-subtle line-through')}
      >
        {item.title}
      </span>
      <IconButton
        aria-label={`Quitar subtarea: ${item.title}`}
        icon={<icons.close size={14} />}
        size={touch ? 'lg' : 'sm'}
        className={cn(reveal)}
        onClick={onDelete}
      />
    </li>
  )
}
