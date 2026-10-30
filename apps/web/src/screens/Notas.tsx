import type { Note, Project } from '@muninn/core'
import { Button, ColorDot, cn, Icon, IconButton, icons } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useMatch, useNavigate } from '@tanstack/react-router'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { FilterChip } from '../components/FilterChip'
import { EmptyState, Ghost, Page } from '../components/Page'
import { timeAgo } from '../lib/dates'
import { useMuninn } from '../lib/muninn'
import { createNote } from '../lib/note-actions'
import {
  countByProject,
  filterNotes,
  isFiltering,
  NO_FILTER,
  type NoteFilter,
  notePreview,
  noteTitle,
} from '../lib/notes'
import { notesQuery } from '../lib/notes-queries'
import { projectsQuery } from '../lib/queries'
import { useIsDesktop } from '../lib/use-media'

const sectionLabel = 'px-3.5 pt-3 pb-1 text-xs font-semibold tracking-wider text-fg-faint uppercase'

interface ItemProps {
  note: Note
  project: Project | undefined
}

/** Una nota en la lista: título, dos líneas de texto, proyecto y cuándo se editó. */
function NoteItem({ note, project }: ItemProps) {
  const preview = notePreview(note)
  return (
    <Link
      to="/notas/$noteId"
      params={{ noteId: note.id }}
      className="flex flex-col gap-1.5 px-3.5 py-3 text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent data-[status=active]:bg-fg/[0.07] md:rounded-md"
    >
      <span
        className={cn(
          'truncate text-md font-semibold md:text-base',
          !note.title.trim() && 'text-fg-subtle',
        )}
      >
        {noteTitle(note)}
      </span>
      {preview ? (
        <span className="line-clamp-2 text-[13.5px] leading-snug text-fg-subtle md:text-sm">
          {preview}
        </span>
      ) : null}
      <span className="flex items-center gap-2 text-xs text-fg-subtle">
        {project ? <ColorDot color={project.color} /> : null}
        <span className="truncate">
          {project ? `${project.name} · ` : ''}
          {timeAgo(note.updatedAt)}
        </span>
      </span>
    </Link>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col">
      <h2 className={sectionLabel}>{label}</h2>
      <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface md:gap-0.5 md:divide-y-0 md:border-0 md:bg-transparent">
        {children}
      </div>
    </section>
  )
}

/**
 * Notas: lista con búsqueda, fijadas y filtro por proyecto, y el editor de la nota abierta a su derecha
 * (Notas.dc.html y M-Notas.dc.html). En móvil, abrir una nota la pone a pantalla completa.
 */
export function Notas() {
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const notes = useQuery(notesQuery(m))
  const projects = useQuery(projectsQuery(m)).data
  const open = useMatch({ from: '/_app/notas/$noteId', shouldThrow: false })?.params.noteId
  const [filter, setFilter] = useState<NoteFilter>(NO_FILTER)
  // Con una nota abierta, `NotaDetalle` pone su título; al volver a la lista, el de la sección.
  useEffect(() => {
    if (!open) document.title = 'Notas · Muninn'
  }, [open])
  const projectOf = useMemo(() => new Map(projects?.map((p) => [p.id, p])), [projects])

  const all = notes.data
  const shown = useMemo(() => (all ? filterNotes(all, filter) : []), [all, filter])
  const perProject = useMemo(() => countByProject(all ?? []), [all])
  const filtering = isFiltering(filter)
  const pinned = shown.filter((n) => n.pinned)
  const recent = shown.filter((n) => !n.pinned)

  // En móvil la nota abierta ocupa toda la pantalla; la lista se queda debajo, sin pintarse.
  if (open && !desktop) return <Outlet />

  const create = async () => {
    // Con un proyecto filtrado, la nota nueva nace en él.
    const note = await createNote(
      m,
      qc,
      { projectId: filter.projectId ?? undefined },
      { onUndo: () => navigate({ to: '/notas', replace: true }) },
    )
    if (note) {
      setFilter(NO_FILTER)
      navigate({ to: '/notas/$noteId', params: { noteId: note.id } })
    }
  }

  const newButton = (
    <Button variant="primary" onClick={create}>
      <Icon name="plus" />
      Nueva nota
    </Button>
  )

  const list = (
    <section
      aria-label="Lista de notas"
      className="flex min-w-0 flex-col gap-3 md:sticky md:top-7 md:max-h-[calc(100dvh-3.5rem)] md:self-start md:overflow-y-auto md:pr-3"
    >
      <header className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold tracking-tight md:text-xl">Notas</h1>
        <IconButton
          aria-label="Nueva nota"
          icon={<icons.plus />}
          variant="primary"
          onClick={create}
          className="size-11 md:size-8"
        />
      </header>

      <label className="flex h-11 items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 text-fg-subtle focus-within:border-accent md:h-8 md:rounded-md md:bg-transparent md:px-2.5">
        <icons.search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label="Buscar en notas"
          placeholder="Buscar en notas"
          value={filter.query}
          onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
          className="min-w-0 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-fg-faint md:text-sm"
        />
      </label>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:gap-1.5 md:overflow-visible md:px-0">
        <FilterChip
          touch={!desktop}
          pressed={!filter.pinned && !filter.projectId}
          onClick={() => setFilter((f) => ({ ...f, pinned: false, projectId: null }))}
        >
          Todas{all ? ` · ${all.length}` : ''}
        </FilterChip>
        <FilterChip
          touch={!desktop}
          pressed={filter.pinned}
          onClick={() => setFilter((f) => ({ ...f, pinned: !f.pinned }))}
        >
          Fijadas
        </FilterChip>
        {projects
          ?.filter((p) => perProject.has(p.id))
          .map((p) => (
            <FilterChip
              key={p.id}
              touch={!desktop}
              dot={p.color}
              pressed={filter.projectId === p.id}
              onClick={() =>
                setFilter((f) => ({ ...f, projectId: f.projectId === p.id ? null : p.id }))
              }
            >
              {p.name}
            </FilterChip>
          ))}
      </div>

      {!all ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Ghost className="h-16" />
          <Ghost className="h-16 opacity-60" />
          <Ghost className="h-16 opacity-30" />
        </div>
      ) : all.length === 0 ? (
        <EmptyState icon="notes" title="Todavía no hay notas" actions={newButton}>
          Escribe en Markdown, fija las importantes y vincula cada nota a un proyecto o a una tarea.
        </EmptyState>
      ) : shown.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-fg-subtle text-pretty">
          {filter.query.trim()
            ? `Nada coincide con «${filter.query.trim()}».`
            : 'No hay notas con este filtro.'}{' '}
          {filtering ? (
            <button
              type="button"
              onClick={() => setFilter(NO_FILTER)}
              className="cursor-pointer text-accent hover:underline"
            >
              Quitar filtros
            </button>
          ) : null}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {pinned.length ? (
            <Group label="Fijadas">
              {pinned.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  project={n.projectId ? projectOf.get(n.projectId) : undefined}
                />
              ))}
            </Group>
          ) : null}
          {recent.length ? (
            <Group label={pinned.length ? 'Recientes' : filtering ? 'Resultados' : 'Recientes'}>
              {recent.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  project={n.projectId ? projectOf.get(n.projectId) : undefined}
                />
              ))}
            </Group>
          ) : null}
        </div>
      )}
    </section>
  )

  return (
    <Page className="max-w-none">
      <div className="md:grid md:flex-1 md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] md:gap-8">
        {list}
        {desktop ? (
          open ? (
            <Outlet />
          ) : (
            <div className="hidden md:flex md:flex-col">
              <EmptyState
                icon="notes"
                title="Elige una nota"
                actions={all?.length ? newButton : undefined}
                className="flex-1 justify-center"
              >
                Selecciona una de la lista o crea una nueva. Se guardan solas mientras escribes.
              </EmptyState>
            </div>
          )
        ) : null}
      </div>
    </Page>
  )
}
