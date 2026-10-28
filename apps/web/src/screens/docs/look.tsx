import { cn } from '@muninn/ui'
import { AppIcon, isAppIcon } from '../../components/AppIcon'
import type { Doc, DocGroupId } from '../../lib/docs'

/** Los iconos que puede pedir una guía con `icon:` (ADR-0052): los de `icons` y `screenIcons`. */
export const isDocIcon = isAppIcon

/** El icono de una guía; si el nombre no existe, el del libro. */
export const DocIcon = AppIcon

/** Icono del título de cada grupo. */
export const GROUP_ICON: Record<DocGroupId, string> = {
  'primeros-pasos': 'flag',
  'tu-trabajo': 'checklist',
  modulos: 'more',
  ia: 'assistant',
  cuenta: 'user',
  otras: 'docs',
}

/** Color del recuadro del icono: el de su módulo (como en Ajustes › Módulos), o uno por grupo. */
const TILE_BY_ICON: Record<string, string> = {
  projects: 'bg-project-blue/15 text-project-blue',
  checklist: 'bg-project-blue/15 text-project-blue',
  notes: 'bg-project-teal/15 text-project-teal',
  finance: 'bg-project-amber/15 text-project-amber',
  news: 'bg-project-pink/15 text-project-pink',
  github: 'bg-project-violet/15 text-project-violet',
  assistant: 'bg-project-green/15 text-project-green',
  plug: 'bg-project-green/15 text-project-green',
}

export const tileClass = (doc: Pick<Doc, 'icon' | 'group' | 'status'>) =>
  doc.status === 'proximamente'
    ? 'bg-surface-raised text-fg-faint'
    : (TILE_BY_ICON[doc.icon] ??
      (doc.group === 'primeros-pasos'
        ? 'bg-accent-soft text-accent'
        : 'bg-surface-raised text-fg-subtle'))

/** El icono de una guía en su recuadro de color. */
export function DocTile({
  doc,
  size = 'md',
  className,
}: {
  doc: Pick<Doc, 'icon' | 'group' | 'status'>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box = { sm: 'size-7 rounded-md', md: 'size-8 rounded-md', lg: 'size-12 rounded-lg' }[size]
  const px = { sm: 15, md: 17, lg: 24 }[size]
  return (
    <span className={cn('grid shrink-0 place-items-center', box, tileClass(doc), className)}>
      <DocIcon name={doc.icon} size={px} />
    </span>
  )
}
