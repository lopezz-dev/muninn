import type { BoardColumn } from '@muninn/core'
import {
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { deleteColumn, moveColumn } from '../../lib/column-actions'
import { useMuninn } from '../../lib/muninn'

interface ColumnMenuProps {
  column: BoardColumn
  /** Todas las columnas del proyecto, en orden. */
  columns: BoardColumn[]
  taskCount: number
  onEdit: (column: BoardColumn) => void
  size?: 'md' | 'lg'
}

/**
 * Opciones de una columna: editar, moverla con el teclado (alternativa al arrastre) y borrarla.
 * Con tareas, el borrado pregunta a qué columna pasan (es una elección, no una confirmación; todo
 * se puede deshacer).
 */
export function ColumnMenu({ column, columns, taskCount, onEdit, size = 'md' }: ColumnMenuProps) {
  const m = useMuninn()
  const qc = useQueryClient()
  const index = columns.findIndex((c) => c.id === column.id)
  const others = columns.filter((c) => c.id !== column.id)
  const last = columns.length <= 1

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton
          aria-label={`Opciones de la columna ${column.name}`}
          icon={<icons.dots size={16} />}
          size={size === 'lg' ? 'lg' : 'sm'}
        />
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<icons.settings />} onSelect={() => onEdit(column)}>
          Editar columna
        </MenuItem>
        <MenuItem
          icon={<icons.chevronLeft />}
          disabled={index <= 0}
          onSelect={() => moveColumn(m, qc, column, index - 1)}
        >
          Mover a la izquierda
        </MenuItem>
        <MenuItem
          icon={<icons.chevronRight />}
          disabled={index >= columns.length - 1}
          onSelect={() => moveColumn(m, qc, column, index + 1)}
        >
          Mover a la derecha
        </MenuItem>
        <MenuSeparator />
        {taskCount === 0 || last ? (
          <MenuItem
            danger
            icon={<icons.trash />}
            disabled={last}
            onSelect={() => deleteColumn(m, qc, column)}
          >
            Borrar columna
          </MenuItem>
        ) : (
          <MenuSub>
            <MenuSubTrigger danger icon={<icons.trash />}>
              Borrar y mover {taskCount === 1 ? 'su tarea' : `sus ${taskCount} tareas`} a
            </MenuSubTrigger>
            <MenuSubContent>
              {others.map((c) => (
                <MenuItem key={c.id} onSelect={() => deleteColumn(m, qc, column, c)}>
                  {c.name}
                </MenuItem>
              ))}
            </MenuSubContent>
          </MenuSub>
        )}
      </MenuContent>
    </Menu>
  )
}
