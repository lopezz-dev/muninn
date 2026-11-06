import type { Note } from '@muninn/core'
import {
  cn,
  copyText,
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  notify,
  screenIcons,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectMenu, type SelectOption } from '../../components/SelectMenu'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { archiveNote, createNote, patchNote } from '../../lib/note-actions'
import { noteTitle } from '../../lib/notes'
import { notesQuery, projectTasksQuery } from '../../lib/notes-queries'
import { ancestorsOf, childrenOf, treeNeighbours } from '../../lib/notes-tree'
import { projectsQuery } from '../../lib/queries'
import { applyEdit } from '../../markdown/edit'
import { applyFormat, continueList, type FormatCommand } from '../../markdown/format'
import { CommentHighlights } from './comments/highlights'
import { COMMENTS_RAIL_PX, useNoteComments } from './comments/NoteComments'
import { EditorContent, FormatBar, SelectionBar, useRichNote } from './rich/RichNote'
import { useNoteDraft } from './use-note-draft'

/** `rich`: el editor en sitio (ADR-0078). `markdown`: el texto en crudo, el escape de «⋯ › Editar como Markdown». */
type Mode = 'rich' | 'markdown'

/** Botones de la barra de formato del modo Markdown; su nombre sale de `tools.<command>`, en el idioma activo. */
interface Tool {
  command: FormatCommand
  shortcut?: string
  content: ReactNode
}

const TOOLS: Tool[] = [
  { command: 'heading', content: <span className="font-semibold">H</span> },
  {
    command: 'bold',
    shortcut: 'Ctrl B',
    content: <span className="font-bold">B</span>,
  },
  {
    command: 'italic',
    shortcut: 'Ctrl I',
    content: <span className="italic">I</span>,
  },
  { command: 'bullet', content: <screenIcons.list size={15} /> },
  { command: 'task', content: <screenIcons.checklist size={15} /> },
  { command: 'code', content: <span className="font-mono text-xs">{'</>'}</span> },
  { command: 'link', content: <icons.link size={15} /> },
]

interface EditorProps {
  note: Note
  /** Escritorio: controles compactos y barra de formato en la misma fila. Móvil: zonas de 44 px. */
  desktop: boolean
}

/**
 * Editor de una nota: título, propiedades (proyecto y tarea) y el texto, que se lee y se edita en el mismo sitio
 * (ADR-0078): en el ordenador, siempre editable; en el teléfono, lectura por defecto y el lápiz para retocar. Se guarda
 * solo (`useNoteDraft`). La barra de formato va arriba y no sobre el teclado: en iOS el teclado no avisa a la página
 * de su altura y una barra inferior quedaría tapada.
 */
export function NoteEditor({ note, desktop }: EditorProps) {
  const { t } = useTranslation(['notes', 'common'])
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { draft, status, change, save } = useNoteDraft(note)
  const empty = !note.title.trim() && !note.content.trim()
  const [mode, setMode] = useState<Mode>('rich')
  // En táctil se lee por defecto; una nota vacía se abre ya para escribir.
  const [editing, setEditing] = useState(empty)
  const editable = desktop || editing
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const isFolderish = note.kind === 'folder'
  const bodyBoxRef = useRef<HTMLDivElement>(null)

  // Los comentarios necesitan el editor y el editor les avisa: se conectan por referencias (ADR-0079).
  const commentHooks = useRef({
    activate: (_id: string) => {},
    start: (_range?: { from: number; to: number }) => {},
  })
  const commentExtensions = useMemo(
    () => [CommentHighlights.configure({ onActivate: (id) => commentHooks.current.activate(id) })],
    [],
  )
  const { editor, linkRequest } = useRichNote({
    content: draft.content,
    editable,
    placeholder: isFolderish ? t('tree.addDescription') : t('editor.richPlaceholder'),
    label: t('editor.richLabel'),
    onChange: (content) => change({ content }),
    onBlur: () => void save(),
    onComment: () => commentHooks.current.start(),
    extensions: commentExtensions,
  })
  const comments = useNoteComments({ editor, note, desktop, flush: save, bodyRef: bodyBoxRef })
  commentHooks.current = { activate: comments.activate, start: comments.startComment }

  // Una nota recién creada empieza por el título. Solo al abrir: el editor se monta de nuevo por cada nota (`key`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver arriba
  useEffect(() => {
    if (empty) titleRef.current?.focus({ preventScroll: true })
  }, [])
  /** Al texto: desde el título con Enter, o al pulsar el lápiz. */
  const edit = () => {
    if (mode === 'markdown') {
      queueMicrotask(() => bodyRef.current?.focus({ preventScroll: true }))
      return
    }
    // Ya editable (el ordenador): el foco va al texto en el acto, o se perdería la primera tecla.
    // (`commands.focus` espera a un `requestAnimationFrame`: aquí el foco va síncrono con `view.focus`).
    if (editable && editor) {
      editor.commands.setTextSelection(1)
      editor.view.focus()
      return
    }
    setEditing(true)
    // En táctil, tras el render que lo hace editable.
    setTimeout(() => editor?.commands.focus('start', { scrollIntoView: false }), 0)
  }
  const switchMode = (next: Mode) => {
    void save()
    setMode(next)
    if (next === 'markdown') queueMicrotask(() => bodyRef.current?.focus({ preventScroll: true }))
  }

  const format = (command: FormatCommand) => {
    const el = bodyRef.current
    if (el) applyEdit(el, applyFormat(command, el.value, el.selectionStart, el.selectionEnd))
  }

  const onBodyKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    const el = e.currentTarget
    const mod = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey
    if (mod && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault()
      format('bold')
    } else if (mod && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault()
      format('italic')
    } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !mod) {
      const next = continueList(el.value, el.selectionStart, el.selectionEnd)
      if (next) {
        e.preventDefault()
        applyEdit(el, next)
      }
    } else if (e.key === 'Escape') {
      void save()
      e.currentTarget.blur()
    }
  }

  // Propiedades
  const projects = useQuery(projectsQuery(m)).data ?? []
  // Su sitio en el árbol (ADR-0083), con lo que ya está en la lista: migas arriba e hijas al pie.
  const allNotes = useQuery(notesQuery(m)).data ?? []
  const ancestors = ancestorsOf(allNotes, note)
  const children = childrenOf(allNotes, note.id)
  const { prev, next } = treeNeighbours(allNotes, note.id)
  const spaceName = note.projectId
    ? (projects.find((p) => p.id === note.projectId)?.name ?? t('editor.archivedProject'))
    : t('tree.general')
  const createChild = async () => {
    await save()
    const child = await createNote(m, qc, { parentId: note.id })
    if (child) navigate({ to: '/notas/$noteId', params: { noteId: child.id } })
  }
  const projectOptions = useMemo<SelectOption<string>[]>(() => {
    const opts: SelectOption<string>[] = [
      { value: '', label: t('editor.noProject') },
      ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color })),
    ]
    // Un proyecto archivado sigue siendo el de la nota.
    if (note.projectId && !projects.some((p) => p.id === note.projectId)) {
      opts.push({ value: note.projectId, label: t('editor.archivedProject') })
    }
    return opts
  }, [projects, note.projectId, t])
  const tasks = useQuery({
    ...projectTasksQuery(m, note.projectId ?? ''),
    enabled: Boolean(note.projectId),
  }).data
  const taskOptions = useMemo<SelectOption<string>[]>(() => {
    const opts: SelectOption<string>[] = [
      { value: '', label: t('editor.noTask') },
      ...(tasks ?? []).map((task) => ({ value: task.id, label: task.title })),
    ]
    if (note.taskId && !opts.some((o) => o.value === note.taskId)) {
      opts.push({ value: note.taskId, label: t('editor.task') })
    }
    return opts
  }, [tasks, note.taskId, t])

  const setProject = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId)
    void patchNote(
      m,
      qc,
      note.id,
      { projectId: projectId || null },
      {
        message: p ? t('toast.inProject', { name: p.name }) : t('toast.noProject'),
        icon: 'link',
      },
    )
  }
  const setTask = (taskId: string) => {
    const task = tasks?.find((x) => x.id === taskId)
    void patchNote(
      m,
      qc,
      note.id,
      { taskId: taskId || null },
      {
        message: task ? t('toast.linked', { title: task.title }) : t('toast.unlinked'),
        icon: 'link',
      },
    )
  }
  const togglePin = () =>
    patchNote(
      m,
      qc,
      note.id,
      { pinned: !note.pinned },
      { message: note.pinned ? t('toast.unpinned') : t('toast.pinned'), icon: 'pin' },
    )

  const archive = async () => {
    await save()
    const ok = await archiveNote(
      m,
      qc,
      { id: note.id, title: draft.title },
      {
        onUndo: () => navigate({ to: '/notas/$noteId', params: { noteId: note.id } }),
      },
    )
    if (ok) navigate({ to: '/notas', replace: true })
  }

  const copyLink = async () => {
    if (await copyText(location.href))
      notify.success(t('link.copied', { ns: 'common' }), { icon: 'link' })
    else notify.error(t('link.copyFailed', { ns: 'common' }))
  }
  const copyMarkdown = async () => {
    const md = draft.title.trim() ? `# ${draft.title.trim()}\n\n${draft.content}` : draft.content
    if (await copyText(md)) notify.success(t('editor.markdownCopied'), { icon: 'link' })
    else notify.error(t('editor.textCopyFailed'))
  }

  const touch = !desktop
  const showRichBar = mode === 'rich' && editable && editor
  const toolBtn = cn(
    'grid cursor-pointer place-items-center rounded-sm text-sm text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
    touch ? 'size-10' : 'size-7',
  )

  return (
    <article aria-label={t('editor.label')} className="flex min-w-0 flex-col">
      <div className="glass sticky top-0 z-10 -mx-5 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border-subtle px-5 pt-[env(safe-area-inset-top)] pb-1.5 md:mx-0 md:rounded-lg md:border md:px-2 md:pt-0 md:pb-0">
        <Link
          to="/notas"
          aria-label={t('editor.back')}
          className="grid size-11 place-items-center rounded-md text-fg md:hidden"
        >
          <icons.chevronLeft size={18} />
        </Link>
        <div
          role="toolbar"
          aria-label={t('editor.format')}
          className={cn(
            'order-last -mx-1 flex w-full items-center gap-0.5 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:min-w-0 md:flex-1 md:px-0',
            mode === 'rich' && !showRichBar && 'hidden',
          )}
        >
          {showRichBar ? (
            <FormatBar editor={editor} touch={touch} onLink={() => linkRequest.current()} />
          ) : null}
          {mode === 'markdown'
            ? TOOLS.map((tool) => {
                const label = t(`tools.${tool.command}`)
                return (
                  <button
                    key={tool.command}
                    type="button"
                    aria-label={label}
                    title={tool.shortcut ? `${label} (${tool.shortcut})` : label}
                    // No quitar el foco ni la selección del texto (en iOS, tampoco cerrar el teclado).
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => format(tool.command)}
                    className={toolBtn}
                  >
                    {tool.content}
                  </button>
                )
              })
            : null}
        </div>
        <div className="ml-auto flex items-center gap-1.5 md:h-12">
          <span
            role="status"
            className={cn(
              'px-1 text-xs',
              status === 'error' ? 'text-danger' : 'text-fg-subtle',
              status === 'saved' && 'max-md:sr-only',
            )}
          >
            {t(`status.${status}`)}
          </span>
          {mode === 'rich' ? comments.counter : null}
          {touch && mode === 'rich' ? (
            // El lápiz: en el teléfono la nota se lee, y se edita solo para retocar (ADR-0078).
            <IconButton
              aria-label={editing ? t('editor.doneEditing') : t('editor.edit')}
              aria-pressed={editing}
              icon={editing ? <icons.check /> : <icons.edit />}
              onClick={() => {
                if (editing) {
                  setEditing(false)
                  void save()
                } else edit()
              }}
              className={cn('size-11', editing && 'text-accent')}
            />
          ) : null}
          <IconButton
            aria-label={note.pinned ? t('editor.unpin') : t('editor.pin')}
            aria-pressed={note.pinned}
            icon={<icons.pin weight={note.pinned ? 'fill' : 'regular'} />}
            onClick={togglePin}
            className={cn(touch && 'size-11', note.pinned && 'text-accent')}
          />
          <Menu>
            <MenuTrigger asChild>
              <IconButton
                aria-label={t('editor.more')}
                icon={<icons.dots />}
                className={cn(touch && 'size-11')}
              />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem icon={<screenIcons.page />} onSelect={createChild}>
                {t('tree.newSubpage')}
              </MenuItem>
              <MenuItem
                icon={<icons.sync />}
                onSelect={() =>
                  patchNote(
                    m,
                    qc,
                    note.id,
                    { kind: note.kind === 'folder' ? 'page' : 'folder' },
                    {
                      message: note.kind === 'folder' ? t('toast.kindPage') : t('toast.kindFolder'),
                      icon: 'notes',
                    },
                  )
                }
              >
                {note.kind === 'folder' ? t('tree.toPage') : t('tree.toFolder')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<icons.link />} onSelect={copyLink}>
                {t('link.copy', { ns: 'common' })}
              </MenuItem>
              <MenuItem icon={<screenIcons.copy />} onSelect={copyMarkdown}>
                {t('editor.copyMarkdown')}
              </MenuItem>
              <MenuItem
                icon={mode === 'rich' ? <screenIcons.codeBlock /> : <icons.edit />}
                onSelect={() => switchMode(mode === 'rich' ? 'markdown' : 'rich')}
              >
                {mode === 'rich' ? t('editor.markdownMode') : t('editor.richMode')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<icons.archive />} danger onSelect={archive}>
                {t('editor.archive')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-6 md:px-2 md:pt-9">
        {/* Migas como en la ayuda: Notas › Espacio › madres › esta nota (ADR-0083). */}
        <nav
          aria-label={t('tree.breadcrumbs')}
          className="-mb-2 flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-fg-subtle"
        >
          <Link to="/notas" className="flex items-center gap-1.5 hover:text-fg">
            <icons.notes size={14} aria-hidden="true" />
            {t('list.title')}
          </Link>
          <icons.chevronRight size={12} aria-hidden="true" className="shrink-0 text-fg-faint" />
          <span className="truncate">{spaceName}</span>
          {ancestors.map((a) => (
            <span key={a.id} className="flex min-w-0 items-center gap-1.5">
              <icons.chevronRight size={12} aria-hidden="true" className="shrink-0 text-fg-faint" />
              <Link
                to="/notas/$noteId"
                params={{ noteId: a.id }}
                className="max-w-[14rem] truncate hover:text-fg"
              >
                {noteTitle(a)}
              </Link>
            </span>
          ))}
          <icons.chevronRight size={12} aria-hidden="true" className="shrink-0 text-fg-faint" />
          <span className="max-w-[14rem] truncate text-fg-muted">{noteTitle(draft)}</span>
        </nav>
        <input
          ref={titleRef}
          aria-label={t('editor.titleLabel')}
          placeholder={t('untitled')}
          value={draft.title}
          maxLength={300}
          onChange={(e) => change({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              edit()
            }
          }}
          className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight text-fg outline-none placeholder:text-fg-faint md:text-[30px]"
        />

        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm">
          <SelectMenu
            label={t('editor.project')}
            variant={touch ? 'field' : 'inline'}
            large={touch}
            value={note.projectId ?? ''}
            options={projectOptions}
            onChange={setProject}
          />
          {note.projectId ? (
            <>
              <SelectMenu
                label={t('editor.linkedTask')}
                variant={touch ? 'field' : 'inline'}
                large={touch}
                value={note.taskId ?? ''}
                options={taskOptions}
                onChange={setTask}
                className="max-w-[16rem]"
              />
              {note.taskId ? (
                <Link
                  to="/proyectos/$projectId/tareas/$taskId"
                  params={{ projectId: note.projectId, taskId: note.taskId }}
                  aria-label={t('editor.openTask')}
                  title={t('editor.openTask')}
                  className="grid size-7 place-items-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
                >
                  <icons.external size={14} />
                </Link>
              ) : null}
            </>
          ) : null}
          <span className="px-2 text-xs text-fg-subtle">
            {t('editor.edited', { when: timeAgo(note.updatedAt) })}
          </span>
        </div>

        {mode === 'markdown' ? (
          <textarea
            ref={bodyRef}
            aria-label={t('editor.bodyLabel')}
            placeholder={t('editor.bodyPlaceholder')}
            value={draft.content}
            maxLength={200000}
            spellCheck
            onChange={(e) => change({ content: e.target.value })}
            onKeyDown={onBodyKey}
            onBlur={() => void save()}
            // 16 px en móvil: con menos, iOS hace zoom al enfocar el campo.
            className="min-h-[55dvh] w-full resize-none bg-transparent font-mono text-[16px] leading-relaxed text-fg outline-none [field-sizing:content] placeholder:text-fg-faint md:min-h-[40dvh] md:text-sm"
          />
        ) : editor ? (
          // Una carpeta o una página con hijas: su contenido son las hijas y el texto es opcional (sin alto mínimo).
          <div
            ref={bodyBoxRef}
            className={cn(
              'relative',
              (isFolderish || children.length > 0) && '[&_.note-prose]:min-h-0',
            )}
            style={comments.railOn ? { paddingRight: COMMENTS_RAIL_PX } : undefined}
          >
            <EditorContent editor={editor} />
            <SelectionBar
              editor={editor}
              linkRequest={linkRequest}
              onComment={(range) => comments.startComment(range)}
            />
            {comments.rail}
          </div>
        ) : null}

        {mode === 'rich' ? comments.sheet : null}

        {children.length || note.kind === 'folder' ? (
          <section
            aria-label={t('tree.children')}
            className="flex flex-col gap-1 border-t border-border-subtle pt-4"
          >
            <h2 className="text-xs font-semibold tracking-wider text-fg-faint uppercase">
              {t('tree.children')}
            </h2>
            {children.length === 0 ? (
              <p className="px-2 py-1 text-sm text-fg-subtle">{t('tree.emptyFolder')}</p>
            ) : null}
            <ul className="flex flex-col">
              {children.map((c) => {
                const KindIcon = c.kind === 'folder' ? screenIcons.folder : screenIcons.page
                return (
                  <li key={c.id}>
                    <Link
                      to="/notas/$noteId"
                      params={{ noteId: c.id }}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 text-fg transition-colors hover:bg-surface-hover',
                        touch ? 'min-h-11 text-md' : 'h-8 text-sm',
                      )}
                    >
                      <KindIcon size={15} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                      <span className={cn('truncate', !c.title.trim() && 'text-fg-subtle')}>
                        {noteTitle(c)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={createChild}
              className={cn(
                'flex cursor-pointer items-center gap-2 self-start rounded-md px-2 text-sm text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg',
                touch ? 'min-h-11' : 'h-8',
              )}
            >
              <icons.plus size={14} aria-hidden="true" />
              {t('tree.newSubpage')}
            </button>
          </section>
        ) : null}

        {prev || next ? (
          <nav
            aria-label={t('tree.otherNotes')}
            className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-6 sm:flex-row"
          >
            {prev ? (
              <Neighbour note={prev} dir="prev" />
            ) : (
              <span className="hidden flex-1 sm:block" />
            )}
            {next ? (
              <Neighbour note={next} dir="next" />
            ) : (
              <span className="hidden flex-1 sm:block" />
            )}
          </nav>
        ) : null}
      </div>
    </article>
  )
}

/** Nota anterior o siguiente en el árbol, como en la ayuda. */
function Neighbour({ note, dir }: { note: Note; dir: 'prev' | 'next' }) {
  const { t } = useTranslation('notes')
  const next = dir === 'next'
  const Arrow = next ? icons.move : icons.chevronLeft
  const KindIcon = note.kind === 'folder' ? screenIcons.folder : screenIcons.page
  return (
    <Link
      to="/notas/$noteId"
      params={{ noteId: note.id }}
      className={cn(
        'glass flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border px-4 py-3 text-fg outline-none transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent md:py-2.5',
        next && 'flex-row-reverse text-right',
      )}
    >
      <Arrow size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
      <KindIcon size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-fg-subtle">
          {next ? t('tree.next') : t('tree.previous')}
        </span>
        <span className="truncate text-base font-medium">{noteTitle(note)}</span>
      </span>
    </Link>
  )
}
