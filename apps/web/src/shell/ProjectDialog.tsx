import type { Project, ProjectImageKind } from '@muninn/core'
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
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ProjectAvatar, ProjectCover, soft } from '../components/ProjectAvatar'
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

/** Selector de una imagen (logo o portada): botón que abre el archivo, y «Quitar» si hay una. */
function ImagePicker({
  label,
  has,
  onPick,
  onRemove,
}: {
  label: string
  has: boolean
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-sm text-fg-muted">{label}</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={`Elegir ${label.toLowerCase()}`}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ''
        }}
      />
      <Button size="lg" className="flex-1 md:h-8 md:flex-none" onClick={() => ref.current?.click()}>
        <Icon name="image" />
        {has ? `Cambiar ${label.toLowerCase()}` : `Elegir ${label.toLowerCase()}`}
      </Button>
      {has ? (
        <Button size="lg" variant="ghost" className="md:h-8" onClick={onRemove}>
          Quitar
        </Button>
      ) : null}
    </div>
  )
}

function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [color, setColor] = useState(project?.color ?? 'blue')
  // Si eligió color a mano, el del logo nuevo no lo pisa (solo se ofrece como muestra).
  const [colorTouched, setColorTouched] = useState(false)
  const [logoColor, setLogoColor] = useState<string | null>(null)
  const [logo, setLogo] = useState<ImageChange>({ kind: 'keep' })
  const [cover, setCover] = useState<ImageChange>({ kind: 'keep' })
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  // Las vistas previas son `blob:` locales: se liberan al cambiarlas o al cerrar.
  const logoPreview = logo.kind === 'new' ? logo.preview : null
  const coverPreview = cover.kind === 'new' ? cover.preview : null
  useEffect(() => () => (logoPreview ? URL.revokeObjectURL(logoPreview) : undefined), [logoPreview])
  useEffect(
    () => () => (coverPreview ? URL.revokeObjectURL(coverPreview) : undefined),
    [coverPreview],
  )

  const pick = async (file: File, kind: ProjectImageKind) => {
    try {
      const reduced = await reduceProjectImage(file, kind)
      const change: ImageChange = {
        kind: 'new',
        blob: reduced.blob,
        preview: URL.createObjectURL(reduced.blob),
      }
      if (kind === 'cover') {
        setCover(change)
        return
      }
      setLogo(change)
      setLogoColor(reduced.color)
      if (reduced.color && !colorTouched) setColor(reduced.color)
    } catch (err) {
      notify.error('No se pudo usar esa imagen', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const logoPath = logo.kind === 'keep' ? (project?.imagePath ?? null) : null
  const coverPath = cover.kind === 'keep' ? (project?.coverPath ?? null) : null
  const hasLogo = logo.kind === 'new' || Boolean(logoPath)
  const hasCover = cover.kind === 'new' || Boolean(coverPath)
  const look = { name: name.trim() || 'P', color, imagePath: logoPath, coverPath }

  // Colores: los de siempre, el del logo y, si el proyecto ya tenía uno propio, ese.
  const swatches: Swatch<string>[] = [...COLORS]
  if (logoColor && !COLORS.some((c) => c.value === logoColor)) {
    swatches.push({ value: logoColor, label: 'Del logo', color: logoColor })
  }
  if (color.startsWith('#') && !swatches.some((c) => c.value === color)) {
    swatches.push({ value: color, label: 'Personalizado', color })
  }

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
      if (created && (logo.kind === 'new' || cover.kind === 'new')) {
        try {
          if (logo.kind === 'new') await m.projects.setImage(created.id, logo.blob, 'logo')
          if (cover.kind === 'new') await m.projects.setImage(created.id, cover.blob, 'cover')
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
    for (const [kind, change] of [
      ['logo', logo],
      ['cover', cover],
    ] as const) {
      if (!ok || change.kind === 'keep') continue
      ok = await setProjectImageWithUndo(
        m,
        qc,
        project,
        change.kind === 'new' ? change.blob : null,
        kind,
      )
    }
    setSaving(false)
    if (ok) onDone()
  }

  const archive = async () => {
    if (!project) return
    onDone()
    if (await archiveProjectWithUndo(m, qc, project)) navigate({ to: '/proyectos' })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {m.projects.imagesEnabled ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium text-fg-muted">Logo y portada</span>
          {/* Vista previa como en la tarjeta: la portada (o el degradado del color) con el logo encima. */}
          <div className="relative">
            {coverPreview ? (
              <div aria-hidden="true" className="h-28 overflow-hidden rounded-lg">
                <img src={coverPreview} alt="" className="size-full object-cover" />
              </div>
            ) : (
              <ProjectCover project={look} className="h-28 overflow-hidden rounded-lg" />
            )}
            <span className="absolute bottom-2.5 left-2.5 rounded-lg border-2 border-surface-raised shadow-popover">
              {logoPreview ? (
                <span
                  aria-hidden="true"
                  className="block size-14 overflow-hidden rounded-md"
                  style={soft(color)}
                >
                  <img src={logoPreview} alt="" className="size-full object-cover" />
                </span>
              ) : (
                <ProjectAvatar project={look} size="lg" className="size-14" />
              )}
            </span>
          </div>
          <ImagePicker
            label="Logo"
            has={hasLogo}
            onPick={(f) => void pick(f, 'logo')}
            onRemove={() => {
              setLogo({ kind: 'remove' })
              setLogoColor(null)
            }}
          />
          <ImagePicker
            label="Portada"
            has={hasCover}
            onPick={(f) => void pick(f, 'cover')}
            onRemove={() => setCover({ kind: 'remove' })}
          />
          <p className="text-xs text-fg-subtle">
            Opcionales. Se reducen en tu dispositivo antes de subirlas. El logo es el icono del
            proyecto y su color se ofrece como color del proyecto; sin portada, el banner usa ese
            color.
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
        options={swatches}
        onChange={(c) => {
          setColor(c)
          setColorTouched(true)
        }}
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
