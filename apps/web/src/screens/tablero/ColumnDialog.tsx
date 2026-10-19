import type { BoardColumn, ColumnKind } from '@muninn/core'
import { Button, columnKinds, Dialog, DialogClose, DialogContent, TextField } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { SelectMenu } from '../../components/SelectMenu'
import { KIND_LABEL } from '../../lib/board'
import { createColumn, updateColumn } from '../../lib/column-actions'
import { useMuninn } from '../../lib/muninn'

const KIND_OPTIONS = (Object.keys(KIND_LABEL) as ColumnKind[]).map((k) => ({
  value: k,
  label: KIND_LABEL[k],
  dot: columnKinds[k],
}))

interface ColumnDialogProps {
  projectId: string
  /** `null` = cerrado; `'new'` = crear; una columna = editarla. */
  target: BoardColumn | 'new' | null
  onClose: () => void
}

/** Crear o editar una columna: nombre, tipo (qué significa «hecho») y límite de trabajo en curso. */
export function ColumnDialog({ projectId, target, onClose }: ColumnDialogProps) {
  const m = useMuninn()
  const qc = useQueryClient()
  const editing = target && target !== 'new' ? target : null
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ColumnKind>('todo')
  const [wip, setWip] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  // Cada vez que se abre, parte de los valores de la columna (o de los de una nueva).
  useEffect(() => {
    if (!target) return
    setName(editing?.name ?? '')
    setKind(editing?.kind ?? 'todo')
    setWip(editing?.wipLimit ? String(editing.wipLimit) : '')
    setError(undefined)
  }, [target, editing])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Ponle un nombre a la columna')
    const limit = wip.trim() === '' ? null : Number(wip)
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      return setError(
        'El límite es un número entero de 1 en adelante, o vacío para no tener límite',
      )
    }
    setSaving(true)
    if (editing) {
      const patch = {
        ...(clean !== editing.name ? { name: clean } : {}),
        ...(kind !== editing.kind ? { kind } : {}),
        ...(limit !== editing.wipLimit ? { wipLimit: limit } : {}),
      }
      const renamedOnly = Object.keys(patch).length === 1 && 'name' in patch
      const ok =
        Object.keys(patch).length === 0 ||
        (await updateColumn(
          m,
          qc,
          editing,
          patch,
          renamedOnly ? `Columna renombrada a «${clean}»` : `Columna «${clean}» actualizada`,
        ))
      setSaving(false)
      if (ok) onClose()
    } else {
      const column = await createColumn(m, qc, { projectId, name: clean, kind, wipLimit: limit })
      setSaving(false)
      if (column) onClose()
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={editing ? 'Editar columna' : 'Nueva columna'}
        description="El tipo dice qué significa la columna aunque la llames como quieras: «Hecho» completa las tareas que entren."
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Nombre"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(undefined)
            }}
            maxLength={60}
            autoComplete="off"
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Tipo</span>
            <SelectMenu label="Tipo" value={kind} options={KIND_OPTIONS} onChange={setKind} />
          </div>
          <TextField
            label="Límite de tareas"
            hint="Vacío = sin límite. Al superarlo te avisamos, pero no te lo impedimos."
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={wip}
            onChange={(e) => {
              setWip(e.target.value)
              setError(undefined)
            }}
            error={error}
          />
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={saving}>
              {editing ? 'Guardar' : 'Crear columna'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
