import { Button, Dialog, DialogClose, DialogContent, palette, TextField } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { type Swatch, SwatchPicker } from '../components/SwatchPicker'
import { useMuninn } from '../lib/muninn'
import { createProjectWithUndo } from '../lib/queries'

type ProjectColor = 'blue' | 'violet' | 'teal' | 'pink' | 'green' | 'amber'

const COLORS: Swatch<ProjectColor>[] = [
  { value: 'blue', label: 'Azul', color: palette.blue },
  { value: 'violet', label: 'Violeta', color: palette.violet },
  { value: 'teal', label: 'Verde azulado', color: palette.teal },
  { value: 'pink', label: 'Rosa', color: palette.pink },
  { value: 'green', label: 'Verde', color: palette.green },
  { value: 'amber', label: 'Ámbar', color: palette.amber },
]

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [color, setColor] = useState<ProjectColor>('blue')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName('')
    setColor('blue')
    setError(undefined)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Ponle un nombre al proyecto')
      return
    }
    setSaving(true)
    const project = await createProjectWithUndo(m, qc, { name: trimmed, color })
    setSaving(false)
    if (!project) return
    onOpenChange(false)
    reset()
    navigate({ to: '/proyectos/$projectId', params: { projectId: project.id } })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent
        title="Nuevo proyecto"
        description="Empieza con un tablero de cinco columnas que puedes cambiar cuando quieras."
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Nombre"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(undefined)
            }}
            error={error}
            maxLength={120}
            autoComplete="off"
            autoFocus
          />
          <SwatchPicker
            legend="Color"
            name="project-color"
            value={color}
            options={COLORS}
            onChange={setColor}
          />
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={saving}>
              Crear proyecto
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
