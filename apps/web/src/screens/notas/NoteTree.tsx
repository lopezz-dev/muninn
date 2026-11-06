import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { Note, NoteKind, Project } from '@muninn/core'
import {
  ColorDot,
  cn,
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  screenIcons,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TreeItem, TreeList } from '../../components/TreeBranch'
import { useMuninn } from '../../lib/muninn'
import { archiveNote, createNote, moveNote, patchNote } from '../../lib/note-actions'
import { noteTitle } from '../../lib/notes'
import {
  buildSpaces,
  type DropZone,
  descendantIds,
  dropTarget,
  MAX_INDENT,
  type MoveTarget,
  spaceOf,
  type TreeNode,
  zoneAt,
} from '../../lib/notes-tree'

const COLLAPSED_KEY = 'muninn:notes:collapsed'

/** Las plegadas se recuerdan en este navegador (comodidad, no dato: ADR-0083 no lo guarda en la cuenta). */
function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveCollapsed(ids: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]))
  } catch {
    // Sin almacenamiento (ventana privada): se pliega igual mientras dura la página.
  }
}

/** Y del puntero al arrastrar: la del evento que empezó más lo que se ha movido. */
function pointerY(e: DragMoveEvent | DragEndEvent): number | null {
  const start = e.activatorEvent
  const y =
    start instanceof MouseEvent
      ? start.clientY
      : typeof TouchEvent !== 'undefined' && start instanceof TouchEvent
        ? start.touches[0]?.clientY
        : undefined
  return y === undefined ? null : y + e.delta.y
}

interface Hint {
  id: string
  zone: DropZone
}

interface Props {
  notes: Note[]
  projects: Project[]
  /** Con un proyecto filtrado, solo su espacio. */
  onlyProjectId: string | null
  touch: boolean
}

/**
 * El árbol de notas (ADR-0083): un bloque por espacio («General» y cada proyecto con notas) con sus páginas y
 * carpetas plegables. Arrastrar una nota sobre otra la mete dentro; sobre su borde, la pone al lado; sobre la
 * cabecera de un espacio, la lleva a su raíz. Cada cambio avisa con «Deshacer».
 */
export function NoteTree({ notes, projects, onlyProjectId, touch }: Props) {
  const { t } = useTranslation('notes')
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [dragging, setDragging] = useState<Note | null>(null)
  const [hint, setHint] = useState<Hint | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const spaces = useMemo(() => buildSpaces(notes), [notes])
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes])
  const projectOf = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const shown = useMemo(() => {
    if (onlyProjectId) return [onlyProjectId]
    const ids: (string | null)[] = [null]
    for (const p of projects) if (spaces.has(p.id)) ids.push(p.id)
    // Notas de un proyecto archivado (no está en la lista de proyectos): al final, para no perderlas.
    for (const s of spaces.values())
      if (s.projectId && !ids.includes(s.projectId)) ids.push(s.projectId)
    return ids
  }, [onlyProjectId, projects, spaces])

  const spaceName = useCallback(
    (projectId: string | null) =>
      projectId
        ? (projectOf.get(projectId)?.name ?? t('editor.archivedProject'))
        : t('tree.general'),
    [projectOf, t],
  )

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveCollapsed(next)
      return next
    })

  const create = async (input: {
    projectId?: string | null
    parentId?: string
    kind?: NoteKind
  }) => {
    if (input.parentId && collapsed.has(input.parentId)) toggle(input.parentId)
    const note = await createNote(m, qc, input, {
      onUndo: () => navigate({ to: '/notas', replace: true }),
    })
    if (note) navigate({ to: '/notas/$noteId', params: { noteId: note.id } })
  }

  const setKind = (note: Note, kind: NoteKind) =>
    patchNote(
      m,
      qc,
      note.id,
      { kind },
      { message: kind === 'folder' ? t('toast.kindFolder') : t('toast.kindPage'), icon: 'notes' },
    )

  // La nota abierta: si se archiva (ella o una que la contiene), se vuelve a la lista; «Deshacer» la vuelve a abrir.
  const openId = useParams({ strict: false }).noteId as string | undefined
  const archive = async (note: Note) => {
    const affected = new Set([note.id, ...descendantIds(notes, note.id)])
    const wasOpen = openId && affected.has(openId) ? openId : null
    const ok = await archiveNote(m, qc, note, {
      onUndo: wasOpen
        ? () => navigate({ to: '/notas/$noteId', params: { noteId: wasOpen } })
        : undefined,
    })
    if (ok && wasOpen) navigate({ to: '/notas', replace: true })
  }

  const onDragStart = ({ active }: DragStartEvent) =>
    setDragging(byId.get(String(active.id)) ?? null)

  /** El destino según dónde está el puntero: sobre una fila (antes, dentro, después) o sobre un espacio. */
  const targetOf = (
    e: DragMoveEvent | DragEndEvent,
  ): { hint: Hint | null; target: MoveTarget } | null => {
    const over = e.over
    const dragged = byId.get(String(e.active.id))
    if (!over || !dragged) return null
    const overId = String(over.id)
    if (overId.startsWith('space:')) {
      const projectId = overId.slice('space:'.length) || null
      return { hint: null, target: { parentId: null, projectId } }
    }
    const overNote = byId.get(overId)
    const y = pointerY(e)
    if (!overNote || y === null) return null
    const zone = zoneAt(y, over.rect)
    const target = dropTarget(notes, dragged, overNote, zone)
    return target ? { hint: { id: overNote.id, zone }, target } : null
  }

  const onDragMove = (e: DragMoveEvent) => {
    const next = targetOf(e)?.hint ?? null
    setHint((h) => (h?.id === next?.id && h?.zone === next?.zone ? h : next))
  }

  const onDragEnd = (e: DragEndEvent) => {
    const result = targetOf(e)
    setDragging(null)
    setHint(null)
    if (!result) return
    const note = byId.get(String(e.active.id))
    if (!note) return
    const { target } = result
    // Soltar dentro de una plegada la despliega, para ver dónde ha caído.
    if (target.parentId && collapsed.has(target.parentId) && !target.index) toggle(target.parentId)
    void moveNote(m, qc, note.id, target)
  }

  const branchProps = (projectId: string | null, name: string) => ({
    touch,
    collapsed,
    hint,
    draggingId: dragging?.id ?? null,
    spaceName: name,
    onToggle: toggle,
    onCreate: (parentId: string, kind: NoteKind) => create({ parentId, kind }),
    onKind: setKind,
    onToRoot: (note: Note) => moveNote(m, qc, note.id, { parentId: null, projectId }),
    onArchive: archive,
  })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null)
        setHint(null)
      }}
      accessibility={{ screenReaderInstructions: { draggable: t('tree.dragHint') } }}
    >
      <nav aria-label={t('tree.label')} className="flex flex-col gap-3">
        {shown.map((projectId) => {
          const space = spaceOf(spaces, projectId)
          const project = projectId ? projectOf.get(projectId) : undefined
          const name = spaceName(projectId)
          const props = branchProps(projectId, name)
          return (
            <SpaceBlock
              key={projectId ?? ''}
              projectId={projectId}
              name={name}
              color={project?.color}
              touch={touch}
              empty={space.roots.length === 0}
              onCreate={(kind) => create({ projectId, kind })}
            >
              {space.roots.map((node) => (
                <Branch key={node.note.id} node={node} depth={0} {...props} />
              ))}
            </SpaceBlock>
          )
        })}
      </nav>
      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="glass-floating flex max-w-72 items-center gap-2 rounded-md border border-border-strong px-2.5 py-1.5 text-sm text-fg shadow-popover">
            <KindIcon kind={dragging.kind} />
            <span className="truncate">{noteTitle(dragging)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function KindIcon({ kind, open }: { kind: NoteKind; open?: boolean }) {
  const Icon =
    kind === 'folder' ? (open ? screenIcons.folderOpen : screenIcons.folder) : screenIcons.page
  return (
    <Icon
      size={15}
      aria-hidden="true"
      className="shrink-0 text-fg-subtle group-data-[status=active]/link:text-accent"
    />
  )
}

interface SpaceProps {
  projectId: string | null
  name: string
  color?: string
  touch: boolean
  empty: boolean
  onCreate: (kind: NoteKind) => void
  children: ReactNode
}

/** Un espacio: su cabecera (también sitio donde soltar, a la raíz) y la rama de sus notas, como un grupo de la ayuda. */
function SpaceBlock({ projectId, name, color, touch, empty, onCreate, children }: SpaceProps) {
  const { t } = useTranslation('notes')
  const { setNodeRef, isOver } = useDroppable({ id: `space:${projectId ?? ''}` })
  return (
    <section aria-label={name} className="flex flex-col">
      <div
        ref={setNodeRef}
        className={cn(
          'group flex items-center gap-1.5 rounded-md px-2.5 pt-1 pb-1',
          isOver && 'bg-accent/15 outline outline-accent/60',
        )}
      >
        {color ? (
          <ColorDot color={color} className="mx-[3px]" />
        ) : (
          <icons.notes size={13} aria-hidden="true" className="shrink-0 text-fg-subtle" />
        )}
        <h2 className="flex-1 truncate text-2xs font-semibold tracking-wider text-fg-subtle uppercase">
          {name}
        </h2>
        <IconButton
          aria-label={t('tree.newPageIn', { name })}
          title={t('tree.newPageIn', { name })}
          icon={<icons.plus />}
          size="sm"
          onClick={() => onCreate('page')}
          className={cn(
            touch ? 'size-9' : 'size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        />
        <Menu>
          <MenuTrigger asChild>
            <IconButton
              aria-label={t('tree.actions', { title: name })}
              icon={<icons.dots />}
              size="sm"
              className={cn(
                touch
                  ? 'size-9'
                  : 'size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
              )}
            />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<screenIcons.page />} onSelect={() => onCreate('page')}>
              {t('tree.newPageIn', { name })}
            </MenuItem>
            <MenuItem icon={<screenIcons.folder />} onSelect={() => onCreate('folder')}>
              {t('tree.newFolder')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {empty ? (
        <p className="py-1.5 pl-8 text-xs text-fg-faint">{t('tree.emptySpace')}</p>
      ) : (
        // La rama baja desde el icono del espacio, como en el índice de la ayuda.
        <TreeList className="ml-4">{children}</TreeList>
      )}
    </section>
  )
}

interface BranchProps {
  node: TreeNode
  depth: number
  touch: boolean
  collapsed: ReadonlySet<string>
  hint: Hint | null
  draggingId: string | null
  spaceName: string
  onToggle: (id: string) => void
  onCreate: (parentId: string, kind: NoteKind) => void
  onKind: (note: Note, kind: NoteKind) => void
  onToRoot: (note: Note) => void
  onArchive: (note: Note) => void
}

/**
 * Una nota y, si está desplegada, sus hijas colgando de su rama (`TreeList`/`TreeItem`, las mismas líneas que el
 * índice de la ayuda). La curva de cada fila se ve en acento si dentro está la nota abierta: el camino hasta ella.
 */
function Branch(props: BranchProps) {
  const { node, depth, touch, collapsed, hint, draggingId, spaceName } = props
  const { onToggle, onCreate, onKind, onToRoot, onArchive } = props
  const { t } = useTranslation('notes')
  const { note, children } = node
  const hasChildren = children.length > 0
  const expanded = hasChildren && !collapsed.has(note.id)
  const drag = useDraggable({ id: note.id })
  const drop = useDroppable({ id: note.id })
  const title = noteTitle(note)
  const zone = hint?.id === note.id ? hint.zone : null
  return (
    <TreeItem
      className={cn(
        // La curva llega a media fila (no a media rama, que crece con las hijas).
        touch ? 'before:h-[22px]' : 'before:h-[15px]',
        draggingId === note.id && 'opacity-40',
      )}
    >
      <div
        ref={drop.setNodeRef}
        className={cn(
          'group relative flex items-center rounded-md',
          zone === 'inside' && 'bg-accent/15 outline outline-accent/60',
        )}
      >
        {zone === 'before' || zone === 'after' ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-accent',
              zone === 'before' ? '-top-px' : '-bottom-px',
            )}
          />
        ) : null}
        <Link
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          // Un enlace, no un botón de arrastrar: el arrastre es un extra del ratón y del tacto.
          role="link"
          to="/notas/$noteId"
          params={{ noteId: note.id }}
          className={cn(
            'group/link flex min-w-0 flex-1 touch-manipulation items-center gap-2 rounded-md px-2 text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
            'data-[status=active]:bg-fg/[0.07] data-[status=active]:text-fg',
            touch ? 'min-h-11 text-md' : 'h-[30px] text-[13.5px]',
          )}
        >
          <KindIcon kind={note.kind} open={expanded} />
          <span className={cn('min-w-0 flex-1 truncate', !note.title.trim() && 'text-fg-subtle')}>
            {title}
          </span>
          {note.pinned ? (
            <icons.pin
              size={12}
              weight="fill"
              aria-hidden="true"
              className="shrink-0 text-accent"
            />
          ) : null}
        </Link>
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? t('tree.collapse', { title }) : t('tree.expand', { title })}
            aria-expanded={expanded}
            onClick={() => onToggle(note.id)}
            className={cn(
              'grid shrink-0 cursor-pointer place-items-center rounded-sm text-fg-subtle outline-none hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
              touch ? 'size-9' : 'size-6',
            )}
          >
            <icons.chevronRight
              size={12}
              className={cn('transition-transform', expanded && 'rotate-90')}
            />
          </button>
        ) : null}
        <IconButton
          aria-label={t('tree.newSubpage')}
          title={t('tree.newSubpage')}
          icon={<icons.plus />}
          size="sm"
          onClick={() => onCreate(note.id, 'page')}
          className={cn(
            touch ? 'hidden' : 'size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        />
        <Menu>
          <MenuTrigger asChild>
            <IconButton
              aria-label={t('tree.actions', { title })}
              icon={<icons.dots />}
              size="sm"
              className={cn(
                touch
                  ? 'size-9'
                  : 'size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
              )}
            />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<screenIcons.page />} onSelect={() => onCreate(note.id, 'page')}>
              {t('tree.newSubpage')}
            </MenuItem>
            <MenuItem icon={<screenIcons.folder />} onSelect={() => onCreate(note.id, 'folder')}>
              {t('tree.newFolderInside')}
            </MenuItem>
            <MenuSeparator />
            {note.kind === 'folder' ? (
              <MenuItem icon={<icons.sync />} onSelect={() => onKind(note, 'page')}>
                {t('tree.toPage')}
              </MenuItem>
            ) : (
              <MenuItem icon={<icons.sync />} onSelect={() => onKind(note, 'folder')}>
                {t('tree.toFolder')}
              </MenuItem>
            )}
            {note.parentId ? (
              <MenuItem icon={<icons.chevronUp />} onSelect={() => onToRoot(note)}>
                {t('tree.toRoot', { name: spaceName })}
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem icon={<icons.archive />} danger onSelect={() => onArchive(note)}>
              {t('tree.archive')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {expanded ? (
        // Las hijas cuelgan del icono de su madre; a partir del sexto nivel ya no se sangra más.
        <TreeList className={depth + 1 < MAX_INDENT ? 'ml-4' : 'ml-0'}>
          {children.map((child) => (
            <Branch key={child.note.id} {...props} node={child} depth={depth + 1} />
          ))}
        </TreeList>
      ) : null}
    </TreeItem>
  )
}
