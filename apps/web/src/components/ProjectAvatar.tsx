import type { Project } from '@muninn/core'
import { cn, projectColor } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { type CSSProperties, useState } from 'react'
import { useMuninn } from '../lib/muninn'
import { projectImageQuery } from '../lib/queries'

type ProjectLook = Pick<Project, 'name' | 'color'> & { imagePath?: string | null }

const hex = (color: string) => (color.startsWith('#') ? color : projectColor(color))

/** Fondo del proyecto sin imagen: su color, suave, sobre la superficie. */
const soft = (color: string): CSSProperties => ({
  background: `color-mix(in srgb, ${hex(color)} 18%, var(--mn-color-surface-raised))`,
  color: hex(color),
})

/** URL de la imagen, o `null` si no tiene, aún no llegó o no carga (sin conexión): entonces se ven la inicial y el color. */
function useProjectImage(path: string | null | undefined) {
  const m = useMuninn()
  const url = useQuery(projectImageQuery(m, path ?? null)).data ?? null
  const [broken, setBroken] = useState<string | null>(null)
  return {
    url: url && url !== broken ? url : null,
    onError: () => setBroken(url),
  }
}

const sizes = {
  xs: 'size-[18px] rounded-xs text-[10px]',
  sm: 'size-7 rounded-sm text-xs',
  md: 'size-11 rounded-md text-md',
  lg: 'size-16 rounded-lg text-xl',
} as const

/** Icono del proyecto (ADR-0055): su imagen recortada en cuadrado o, si no tiene, la inicial sobre su color. */
export function ProjectAvatar({
  project,
  size = 'md',
  className,
}: {
  project: ProjectLook
  size?: keyof typeof sizes
  className?: string
}) {
  const { url, onError } = useProjectImage(project.imagePath)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden font-bold',
        sizes[size],
        className,
      )}
      style={soft(project.color)}
    >
      {url ? (
        <img src={url} alt="" onError={onError} className="size-full object-cover" />
      ) : (
        project.name.trim().charAt(0).toUpperCase()
      )}
    </span>
  )
}

/** Portada de la tarjeta del proyecto: su imagen o su color suave, con una franja del color abajo. */
export function ProjectCover({ project, className }: { project: ProjectLook; className?: string }) {
  const { url, onError } = useProjectImage(project.imagePath)
  return (
    <div aria-hidden="true" className={cn('relative', className)} style={soft(project.color)}>
      {url ? <img src={url} alt="" onError={onError} className="size-full object-cover" /> : null}
      <span
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{ background: hex(project.color) }}
      />
    </div>
  )
}
