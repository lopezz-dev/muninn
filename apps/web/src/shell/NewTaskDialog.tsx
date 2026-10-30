import type { TaskPriority } from '@muninn/core'
import {
  Button,
  columnKinds,
  DateField,
  Dialog,
  DialogClose,
  DialogContent,
  Icon,
  TextField,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { SelectMenu } from '../components/SelectMenu'
import { PRIORITIES } from '../lib/board'
import { useMuninn } from '../lib/muninn'
import { boardQuery, projectsQuery } from '../lib/queries'
import { createTask } from '../lib/task-actions'
import type { NewTaskPreset } from './shell-context'

const priorityOptions = PRIORITIES.map((p) => ({ value: p.value, label: p.label }))

/**
 * Nueva tarea desde cualquier sitio (botón, atajo N, «+» de una columna). Se carga en diferido: el
 * shell no paga por él hasta que se abre por primera vez.
 */
export function NewTaskDialog({
  open,
  preset,
  onOpenChange,
  onNewProject,
}: {
  open: boolean
  preset: NewTaskPreset
  onOpenChange: (open: boolean) => void
  onNewProject: () => void
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const projects = useQuery({ ...projectsQuery(m), enabled: open }).data ?? []
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [columnId, setColumnId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('none')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  // Al abrir, vuelve a empezar: el proyecto y la columna que mande quien lo abre, o el primero.
  useEffect(() => {
    if (!open) return
    setTitle(preset.title ?? '')
    setPriority('none')
    setDueDate(preset.dueDate ?? '')
    setError(undefined)
    setProjectId(preset.projectId ?? '')
    setColumnId(preset.columnId ?? '')
  }, [open, preset.projectId, preset.columnId, preset.title, preset.dueDate])

  const effectiveProject = projects.some((p) => p.id === projectId) ? projectId : projects[0]?.id
  const board = useQuery({
    ...boardQuery(m, effectiveProject ?? ''),
    enabled: open && Boolean(effectiveProject),
  }).data
  const columns = board?.columns ?? []
  const fallbackColumn =
    columns.find((c) => c.kind === 'todo') ?? columns.find((c) => c.kind !== 'done') ?? columns[0]
  const effectiveColumn = columns.some((c) => c.id === columnId) ? columnId : fallbackColumn?.id

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = title.trim()
    if (!clean) return setError('Ponle un título a la tarea')
    if (!effectiveProject) return
    setSaving(true)
    const task = await createTask(m, qc, {
      projectId: effectiveProject,
      columnId: effectiveColumn,
      title: clean,
      description: preset.description,
      priority,
      dueDate: dueDate || null,
    })
    setSaving(false)
    if (task) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Nueva tarea"
        description={
          projects.length ? 'Se crea al final de la columna que elijas.' : 'Necesitas un proyecto.'
        }
      >
        {projects.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-fg-muted">
              Las tareas viven en el tablero de un proyecto. Crea el primero y vuelve aquí.
            </p>
            <Button
              variant="primary"
              onClick={() => {
                onOpenChange(false)
                onNewProject()
              }}
            >
              <Icon name="plus" />
              Nuevo proyecto
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <TextField
              label="Título"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError(undefined)
              }}
              error={error}
              maxLength={300}
              autoComplete="off"
              autoFocus
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">Proyecto</span>
                <SelectMenu
                  label="Proyecto"
                  value={effectiveProject ?? ''}
                  options={projects.map((p) => ({ value: p.id, label: p.name, dot: p.color }))}
                  onChange={(id) => {
                    setProjectId(id)
                    setColumnId('')
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">Columna</span>
                <SelectMenu
                  label="Columna"
                  value={effectiveColumn ?? ''}
                  options={columns.map((c) => ({
                    value: c.id,
                    label: c.name,
                    dot: columnKinds[c.kind],
                  }))}
                  onChange={setColumnId}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">Prioridad</span>
                <SelectMenu
                  label="Prioridad"
                  value={priority}
                  options={priorityOptions}
                  onChange={setPriority}
                />
              </div>
              <DateField
                label="Vence"
                value={dueDate}
                onChange={setDueDate}
                today={m.today()}
                clearable
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button type="submit" variant="primary" disabled={saving || !effectiveColumn}>
                Crear tarea
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
