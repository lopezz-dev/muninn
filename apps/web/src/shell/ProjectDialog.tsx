import type { Project } from '@muninn/core'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Icon,
  notify,
  palette,
  SheetContent,
  TextArea,
  TextField,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { ProjectAvatar, ProjectCover } from '../components/ProjectAvatar'
import { type Swatch, SwatchPicker } from '../components/SwatchPicker'
import { useMuninn } from '../lib/muninn'
import { reduceProjectImage } from '../lib/project-image'
import {
  archiveProjectWithUndo,
  createProjectWithUndo,
  invalidateProjects,
  setProjectImageWithUndo,
  updateProjectWithUndo,
} from '../lib/queries'
import { useIsDesktop } from '../lib/use-media'

const COLORS: Swatch<string>[] = [
  { value: 'blue', label: 'Azul', color: palette.blue },
  { value: 'violet', label: 'Violeta', color: palette.violet },
  { value: 'teal', label: 'Verde azulado', color: palette.teal },
  { value: 'pink', label: 'Rosa', color: palette.pink },
  { value: 'green', label: 'Verde', color: palette.green },
  { value: 'amber', label: 'Ámbar', color: palette.amber },
]

/** Qué pasa con la imagen al guardar: se queda como está, se cambia por una nueva (ya reducida) o se quita. */
type ImageChange =
  | { kind: 'keep' }
  | { kind: 'new'; blob: Blob; preview: string }
  | { kind: 'remove' }

/**
 * Crear y editar un proyecto (ADR-0055): nombre, descripción, color e imagen; al editar, también archivar. Diálogo en
 * el ordenador y hoja desde abajo en el teléfono. Diseño: lienzo «Muninn — Móvil 2.0» (P-Dialogo, P-Hoja).
 */
export function ProjectDialog({
  open,
  project,
  onOpenChange,
}: {
  open: boolean
  /** El proyecto que se edita; sin él, se crea uno nuevo. */
  project?: Project
  onOpenChange: (open: boolean) => void
}) {
  const desktop = useIsDesktop()
  const title = project ? 'Editar proyecto' : 'Nuevo proyecto'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {desktop ? (
        <DialogContent
          title={title}
          description={
            project
              ? undefined
              : 'Empieza con un tablero de cinco columnas que puedes cambiar cuando quieras.'
          }
        >
          {open ? <ProjectForm project={project} onDone={() => onOpenChange(false)} /> : null}
        </DialogContent>
      ) : (
        <SheetContent side="bottom" title={title}>
          {open ? <ProjectForm project={project} onDone={() => onOpenChange(false)} /> : null}
        </SheetContent>
      )}
    </Dialog>
  )
}

function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const fileId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [color, setColor] = useState(project?.color ?? 'blue')
  const [image, setImage] = useState<ImageChange>({ kind: 'keep' })
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  // La vista previa es un `blob:` local: se libera al cambiarla o al cerrar.
  const preview = image.kind === 'new' ? image.preview : null
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview])

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      const blob = await reduceProjectImage(file)
      setImage({ kind: 'new', blob, preview: URL.createObjectURL(blob) })
    } catch (err) {
      notify.error('No se pudo usar esa imagen', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const currentPath = image.kind === 'keep' ? (project?.imagePath ?? null) : null
  const hasImage = image.kind === 'new' || Boolean(currentPath)
  const look = { name: name.trim() || 'P', color, imagePath: currentPath }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Ponle un nombre al proyecto')
      return
    }
    setSaving(true)
    if (!project) {
      const created = await createProjectWithUndo(m, qc, {
        name: trimmed,
        color,
        description: description.trim(),
      })
      if (created && image.kind === 'new') {
        try {
          await m.projects.setImage(created.id, image.blob)
          await invalidateProjects(qc)
        } catch (err) {
          notify.error('El proyecto se creó, pero no se pudo subir la imagen', {
            description: err instanceof Error ? err.message : undefined,
          })
        }
      }
      setSaving(false)
      if (!created) return
      onDone()
      navigate({ to: '/proyectos/$projectId', params: { projectId: created.id } })
      return
    }
    const patch = {
      ...(trimmed !== project.name ? { name: trimmed } : {}),
      ...(description.trim() !== project.description ? { description: description.trim() } : {}),
      ...(color !== project.color ? { color } : {}),
    }
    let ok = true
    if (Object.keys(patch).length) ok = Boolean(await updateProjectWithUndo(m, qc, project, patch))
    if (ok && image.kind !== 'keep') {
      ok = await setProjectImageWithUndo(m, qc, project, image.kind === 'new' ? image.blob : null)
    }
    setSaving(false)
    if (ok) onDone()
  }

  const archive = async () => {
    if (!project) return
    onDone()
    if (await archiveProjectWithUndo(m, qc, project.id, project.name))
      navigate({ to: '/proyectos' })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {m.projects.imagesEnabled ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-fg-muted">Imagen</span>
          <div className="relative">
            {preview ? (
              <div aria-hidden="true" className="relative h-28 overflow-hidden rounded-lg">
                <img src={preview} alt="" className="size-full object-cover" />
              </div>
            ) : (
              <ProjectCover project={look} className="h-28 overflow-hidden rounded-lg" />
            )}
            <span className="absolute bottom-2.5 left-2.5 rounded-lg border-2 border-surface-raised shadow-popover">
              {preview ? (
                <span aria-hidden="true" className="block size-14 overflow-hidden rounded-md">
                  <img src={preview} alt="" className="size-full object-cover" />
                </span>
              ) : (
                <ProjectAvatar project={look} size="lg" className="size-14" />
              )}
            </span>
            {hasImage ? null : (
              <span className="absolute inset-y-0 right-4 left-24 flex items-center text-sm text-fg-muted">
                Sin imagen: se ven la inicial y el color.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void pick(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button
              size="lg"
              className="flex-1 md:h-8 md:flex-none"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="image" />
              {hasImage ? 'Cambiar imagen' : 'Elegir imagen'}
            </Button>
            {hasImage ? (
              <Button
                size="lg"
                variant="ghost"
                className="md:h-8"
                onClick={() => setImage({ kind: 'remove' })}
              >
                Quitar
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-fg-subtle">
            Opcional. Se reduce en tu dispositivo antes de subirla. Es la portada en el ordenador y
            la tablet, y el icono en el teléfono y en la barra lateral.
          </p>
        </div>
      ) : null}

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
        autoFocus={!project}
      />
      <TextArea
        label="Descripción"
        hint="Opcional. Sale en la tarjeta del proyecto y la lee el asistente."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={5000}
        rows={3}
        placeholder="De qué va, para qué es, qué cuenta como terminado…"
      />
      <SwatchPicker
        legend="Color"
        name="project-color"
        value={color}
        options={COLORS}
        onChange={setColor}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {project ? (
          <Button variant="danger" size="lg" className="md:h-8" onClick={archive}>
            <Icon name="archive" />
            Archivar
          </Button>
        ) : null}
        <span className="flex-1" />
        <DialogClose asChild>
          <Button variant="ghost" size="lg" className="md:h-8">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" variant="primary" size="lg" className="md:h-8" disabled={saving}>
          {project ? 'Guardar' : 'Crear proyecto'}
        </Button>
      </div>
    </form>
  )
}
