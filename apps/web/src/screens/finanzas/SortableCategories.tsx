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
import type { FinanceCategory } from '@muninn/core'
import { ColorDot, cn, IconButton, icons, projectColor } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { archiveCategory, moveCategory } from '../../lib/finance-actions'
import { useMuninn } from '../../lib/muninn'

/** Solo arriba y abajo: es una lista. */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

interface Props {
  /** Las activas de un tipo, en su orden. */
  list: FinanceCategory[]
  onEdit: (category: FinanceCategory) => void
}

/**
 * Filas de categorías que se reordenan arrastrando su asa (ratón, tacto o teclado: Espacio, flechas,
 * Espacio). Al soltar se escribe una vez (`categories.move`) con «Deshacer».
 */
export function SortableCategories({ list, onEdit }: Props) {
  const { t } = useTranslation('finance')
  const m = useMuninn()
  const qc = useQueryClient()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const name = (id: unknown) => list.find((c) => c.id === id)?.name ?? ''
  const place = (id: unknown) =>
    t('categories.dndPlace', { n: list.findIndex((c) => c.id === id) + 1, total: list.length })

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const category = list.find((c) => c.id === active.id)
    const to = list.findIndex((c) => c.id === over.id)
    // Con `arrayMove`, el sitio final en la lista es también el índice entre las demás.
    if (category && to >= 0) void moveCategory(m, qc, category, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[vertical]}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: t('categories.dndInstructions'),
        },
        announcements: {
          onDragStart: ({ active }) =>
            t('categories.dndStart', { name: name(active.id), place: place(active.id) }),
          onDragOver: ({ active, over }) =>
            over
              ? t('categories.dndOver', { name: name(active.id), place: place(over.id) })
              : undefined,
          onDragEnd: ({ active, over }) =>
            over
              ? t('categories.dndEnd', { name: name(active.id), place: place(over.id) })
              : undefined,
          onDragCancel: ({ active }) => t('categories.dndCancel', { name: name(active.id) }),
        },
      }}
    >
      <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {list.map((c) => (
          <Row
            key={c.id}
            category={c}
            onEdit={() => onEdit(c)}
            onArchive={() => archiveCategory(m, qc, c)}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function Row({
  category: c,
  onEdit,
  onArchive,
}: {
  category: FinanceCategory
  onEdit: () => void
  onArchive: () => void
}) {
  const { t } = useTranslation('finance')
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: c.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative flex items-center gap-1 border-t border-border-subtle bg-surface py-1 pr-2 pl-1.5',
        isDragging && 'z-10 rounded-md border-transparent shadow-drag',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={t('categories.move', { name: c.name })}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-fg-faint outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing md:size-7"
        {...attributes}
        {...listeners}
      >
        <icons.grip size={14} />
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t('edit', { name: c.name })}
        className="flex min-h-11 flex-1 cursor-pointer items-center gap-2.5 text-left text-base outline-none hover:text-fg focus-visible:underline md:min-h-8"
      >
        <ColorDot color={projectColor(c.color)} />
        <span className="truncate">{c.name}</span>
      </button>
      <IconButton
        aria-label={t('archive', { name: c.name })}
        icon={<icons.archive />}
        onClick={onArchive}
        className="size-11 md:size-8"
      />
    </li>
  )
}
