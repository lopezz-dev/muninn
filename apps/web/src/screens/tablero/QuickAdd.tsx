import { icons, TextField } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useMuninn } from '../../lib/muninn'
import { createTask } from '../../lib/task-actions'

/**
 * «Añadir tarea» al pie de una columna: escribes el título, Enter la crea y el campo sigue abierto
 * para la siguiente; Escape o salir con el campo vacío lo cierra.
 */
export function QuickAdd({
  projectId,
  columnId,
  large,
}: {
  projectId: string
  columnId: string
  large?: boolean
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = title.trim()
    if (!clean || busy) return
    setBusy(true)
    const task = await createTask(m, qc, { projectId, columnId, title: clean })
    setBusy(false)
    if (task) setTitle('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg ${large ? 'h-11' : 'h-8'}`}
      >
        <icons.plus size={14} />
        Añadir tarea
      </button>
    )
  }

  return (
    <form onSubmit={submit}>
      <TextField
        label="Título de la nueva tarea"
        hideLabel
        placeholder="Título de la tarea"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            setTitle('')
            setOpen(false)
          }
        }}
        onBlur={() => {
          if (!title.trim()) setOpen(false)
        }}
        maxLength={300}
        autoComplete="off"
        size={large ? 'lg' : 'md'}
        autoFocus
      />
    </form>
  )
}
