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
import { canBeAgentColumn, setAgentColumn, useAgentColumn } from '../../lib/agent'
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
 * Opciones de una columna: editar, moverla con el teclado (alternativa al arrastre), marcarla como la del
 * agente (si el proyecto tiene repo; ADR-0032) y borrarla.
 * Con tareas, el borrado pregunta a qué columna pasan (es una elección, no una confirmación; todo
 * se puede deshacer).
 */
export function ColumnMenu({ column, columns, taskCount, onEdit, size = 'md' }: ColumnMenuProps) {
  const m = useMuninn()
  const qc = useQueryClient()
  const index = columns.findIndex((c) => c.id === column.id)
  const others = columns.filter((c) => c.id !== column.id)
  const last = columns.length <= 1
  const { project, githubOn } = useAgentColumn(column.projectId)
  const isAgent = project?.agentColumnId === column.id

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
        {project && canBeAgentColumn(project, githubOn, column) ? (
          <MenuItem
            icon={<icons.agent />}
            onSelect={() => setAgentColumn(m, qc, project, columns, isAgent ? null : column.id)}
          >
            {isAgent ? 'Dejar de usarla para el agente' : 'Usar para el agente'}
          </MenuItem>
        ) : null}
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
