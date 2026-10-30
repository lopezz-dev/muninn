import {
  type Announcements,
  type CollisionDetection,
  closestCenter,
  closestCorners,
  type DroppableContainer,
  getFirstCollision,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  type ScreenReaderInstructions,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { MutableRefObject } from 'react'
import { colId, findColumn, type ItemsByColumn, isColKey, isTabKey } from '../../lib/board'

/**
 * Piezas de dnd-kit que comparten el tablero de escritorio, el de móvil y el calendario: los sensores,
 * elegir sobre qué se suelta, mover con el teclado entre columnas y avisar a los lectores de pantalla
 * (en español).
 */

/**
 * Sensores de todas las vistas con arrastre. Ratón: a los 6 px (un clic sigue abriendo la tarea). Tacto:
 * mantener pulsado 250 ms, para que deslizar siga haciendo scroll. Teclado: Espacio recoge y suelta,
 * Escape cancela; Enter queda para abrir la tarea (las tarjetas son enlaces). Lo único que cambia entre
 * vistas es a dónde llevan las flechas (`coordinateGetter`).
 */
export function useBoardSensors(coordinateGetter: KeyboardCoordinateGetter) {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )
}

type Kind = 'card' | 'column'
const typeOf = (c: { data: { current?: Record<string, unknown> } }) =>
  c.data.current?.type as Kind | undefined

/**
 * Sobre qué se suelta. Una columna: la más cercana al centro. Una tarjeta: la tarjeta bajo el puntero
 * (o, si el puntero está sobre una columna, la tarjeta de esa columna más cercana; o la columna si está
 * vacía). Si al cambiar de columna el diseño se mueve y no hay nada bajo el puntero, recuerda la última.
 */
export function boardCollision(
  getItems: () => ItemsByColumn,
  last: MutableRefObject<UniqueIdentifier | null>,
  recentlyMoved: MutableRefObject<boolean>,
): CollisionDetection {
  return (args) => {
    if (typeOf(args.active) === 'column') {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => isColKey(c.id)),
      })
    }
    const pointer = pointerWithin(args)
    const hits = pointer.length > 0 ? pointer : rectIntersection(args)
    let overId = getFirstCollision(hits, 'id')
    if (overId != null) {
      if (isColKey(overId)) {
        const ids = getItems()[colId(overId)] ?? []
        if (ids.length > 0) {
          const inside = args.droppableContainers.filter(
            (c) => c.id !== overId && ids.includes(String(c.id)),
          )
          overId = closestCenter({ ...args, droppableContainers: inside })[0]?.id ?? overId
        }
      }
      last.current = overId
      return [{ id: overId }]
    }
    if (recentlyMoved.current) last.current = args.active.id
    return last.current != null ? [{ id: last.current }] : []
  }
}

/**
 * Teclado entre columnas: las flechas saltan a la tarjeta más cercana en esa dirección (o a una
 * columna vacía). Con una columna recogida, solo hay columnas. El de `@dnd-kit/sortable` mira todo lo
 * que hay en pantalla y no sabe que una tarjeta puede cambiar de columna.
 */
export const boardKeyboard: KeyboardCoordinateGetter = (
  event,
  { context: { active, droppableRects, droppableContainers, collisionRect } },
) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return undefined
  event.preventDefault()
  if (!active || !collisionRect) return undefined
  const moving = typeOf(active)

  const candidates: DroppableContainer[] = []
  for (const entry of droppableContainers.getEnabled()) {
    const rect = droppableRects.get(entry.id)
    if (!rect) continue
    const t = typeOf(entry)
    if (moving === 'column' && t !== 'column') continue
    // Una tarjeta salta entre tarjetas; una columna solo cuenta si no tiene tarjetas a las que ir.
    if (moving === 'card' && t === 'column' && entry.data.current?.hasCards) continue
    if (isTabKey(entry.id)) continue
    const ok =
      event.code === 'ArrowDown'
        ? collisionRect.top < rect.top
        : event.code === 'ArrowUp'
          ? collisionRect.top > rect.top
          : event.code === 'ArrowLeft'
            ? collisionRect.left >= rect.left + rect.width
            : collisionRect.left + collisionRect.width <= rect.left
    if (ok) candidates.push(entry)
  }

  const closest = getFirstCollision(
    closestCorners({
      active,
      collisionRect,
      droppableRects,
      droppableContainers: candidates,
      pointerCoordinates: null,
    }),
    'id',
  )
  if (closest == null) return undefined
  const target = droppableContainers.get(closest)
  const rect = target?.rect.current
  if (!target || !rect) return undefined
  // En una columna vacía, a su primer hueco; en una tarjeta, a su esquina.
  if (moving === 'card' && typeOf(target) === 'column')
    return { x: rect.left + 12, y: rect.top + 56 }
  return { x: rect.left, y: rect.top }
}

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'Para mover, pulsa Espacio. Con las flechas eliges el sitio, con Espacio sueltas y con Escape cancelas. Enter abre la tarea.',
}

interface Labels {
  /** «“Título”» de una tarjeta, «la columna X» de una columna. */
  name: (id: UniqueIdentifier) => string
  /** «posición 2 de 5 en En curso» para una tarjeta; para una columna, «posición 2 de 5». */
  where: (id: UniqueIdentifier) => string
}

export const announcements = ({ name, where }: Labels): Announcements => ({
  onDragStart: ({ active }) => `Has recogido ${name(active.id)}. ${where(active.id)}.`,
  onDragOver: ({ active, over }) => (over ? `${name(active.id)}: ${where(over.id)}.` : undefined),
  onDragEnd: ({ active, over }) =>
    over
      ? `Has soltado ${name(active.id)}. ${where(over.id)}.`
      : `${name(active.id)} vuelve a su sitio.`,
  onDragCancel: ({ active }) => `Movimiento cancelado: ${name(active.id)} vuelve a su sitio.`,
})

/** Posición «n de total» de `id` dentro de su columna, para los avisos. */
export function placeOf(items: ItemsByColumn, id: string, columnName: (id: string) => string) {
  const col = findColumn(items, id)
  if (!col) return ''
  const list = items[col] ?? []
  return `posición ${list.indexOf(id) + 1} de ${list.length} en ${columnName(col)}`
}
