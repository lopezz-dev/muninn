import type { Note } from '@muninn/core'
import {
  cn,
  copyText,
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  notify,
  SegmentedControl,
  screenIcons,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { SelectMenu, type SelectOption } from '../../components/SelectMenu'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { archiveNote, patchNote } from '../../lib/note-actions'
import { projectTasksQuery } from '../../lib/notes-queries'
import { projectsQuery } from '../../lib/queries'
import { applyEdit } from '../../markdown/edit'
import { applyFormat, continueList, type FormatCommand } from '../../markdown/format'
import { Markdown } from '../../markdown/Markdown'
import { type SaveStatus, useNoteDraft } from './use-note-draft'

type Mode = 'edit' | 'preview'

const STATUS: Record<SaveStatus, string> = {
  saved: 'Guardado',
  saving: 'Guardando…',
  dirty: 'Sin guardar',
  error: 'No se pudo guardar',
}

interface Tool {
  command: FormatCommand
  label: string
  shortcut?: string
  content: ReactNode
}

const TOOLS: Tool[] = [
  { command: 'heading', label: 'Título', content: <span className="font-semibold">H</span> },
  {
    command: 'bold',
    label: 'Negrita',
    shortcut: 'Ctrl B',
    content: <span className="font-bold">B</span>,
  },
  {
    command: 'italic',
    label: 'Cursiva',
    shortcut: 'Ctrl I',
    content: <span className="italic">I</span>,
  },
  { command: 'bullet', label: 'Lista', content: <screenIcons.list size={15} /> },
  { command: 'task', label: 'Lista de tareas', content: <screenIcons.checklist size={15} /> },
  { command: 'code', label: 'Código', content: <span className="font-mono text-xs">{'</>'}</span> },
  { command: 'link', label: 'Enlace', content: <icons.link size={15} /> },
]

interface EditorProps {
  note: Note
  /** Escritorio: controles compactos y barra de formato en la misma fila. Móvil: zonas de 44 px. */
  desktop: boolean
}

/**
 * Editor de una nota: título, propiedades (proyecto y tarea), y el texto en Markdown con barra de formato
 * o vista previa. Se guarda solo (`useNoteDraft`). La barra de formato va arriba y no sobre el teclado:
 * en iOS el teclado no avisa a la página de su altura y una barra inferior quedaría tapada.
 */
export function NoteEditor({ note, desktop }: EditorProps) {
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { draft, status, change, toggle, save } = useNoteDraft(note)
  const empty = !note.title.trim() && !note.content.trim()
  const [mode, setMode] = useState<Mode>(empty ? 'edit' : 'preview')
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Una nota recién creada empieza por el título; al pasar a editar, el cursor va al texto.
  // Solo al abrir: el editor se monta de nuevo por cada nota (`key`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver arriba
  useEffect(() => {
    if (empty) titleRef.current?.focus({ preventScroll: true })
  }, [])
  const edit = () => {
    setMode('edit')
    queueMicrotask(() => bodyRef.current?.focus({ preventScroll: true }))
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
      setMode('preview')
      void save()
    }
  }

  // Propiedades
  const projects = useQuery(projectsQuery(m)).data ?? []
  const projectOptions = useMemo<SelectOption<string>[]>(() => {
    const opts: SelectOption<string>[] = [
      { value: '', label: 'Sin proyecto' },
      ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color })),
    ]
    // Un proyecto archivado sigue siendo el de la nota.
    if (note.projectId && !projects.some((p) => p.id === note.projectId)) {
      opts.push({ value: note.projectId, label: 'Proyecto archivado' })
    }
    return opts
  }, [projects, note.projectId])
  const tasks = useQuery({
    ...projectTasksQuery(m, note.projectId ?? ''),
    enabled: Boolean(note.projectId),
  }).data
  const taskOptions = useMemo<SelectOption<string>[]>(() => {
    const opts: SelectOption<string>[] = [
      { value: '', label: 'Sin tarea' },
      ...(tasks ?? []).map((t) => ({ value: t.id, label: t.title })),
    ]
    if (note.taskId && !opts.some((o) => o.value === note.taskId)) {
      opts.push({ value: note.taskId, label: 'Tarea' })
    }
    return opts
  }, [tasks, note.taskId])

  const setProject = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId)
    void patchNote(
      m,
      qc,
      note.id,
      { projectId: projectId || null },
      { message: p ? `Nota en «${p.name}»` : 'Nota sin proyecto', icon: 'link' },
    )
  }
  const setTask = (taskId: string) => {
    const t = tasks?.find((x) => x.id === taskId)
    void patchNote(
      m,
      qc,
      note.id,
      { taskId: taskId || null },
      { message: t ? `Vinculada a «${t.title}»` : 'Tarea desvinculada', icon: 'link' },
    )
  }
  const togglePin = () =>
    patchNote(
      m,
      qc,
      note.id,
      { pinned: !note.pinned },
      { message: note.pinned ? 'Nota desfijada' : 'Nota fijada', icon: 'pin' },
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
    if (await copyText(location.href)) notify.success('Enlace copiado', { icon: 'link' })
    else notify.error('No se pudo copiar el enlace')
  }
  const copyMarkdown = async () => {
    const md = draft.title.trim() ? `# ${draft.title.trim()}\n\n${draft.content}` : draft.content
    if (await copyText(md)) notify.success('Markdown copiado', { icon: 'link' })
    else notify.error('No se pudo copiar el texto')
  }

  const touch = !desktop
  const toolBtn = cn(
    'grid cursor-pointer place-items-center rounded-sm text-sm text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
    touch ? 'size-10' : 'size-7',
  )

  return (
    <article aria-label="Nota" className="flex min-w-0 flex-col">
      <div className="glass sticky top-0 z-10 -mx-5 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border-subtle px-5 pt-[env(safe-area-inset-top)] pb-1.5 md:mx-0 md:rounded-lg md:border md:px-2 md:pt-0 md:pb-0">
        <Link
          to="/notas"
          aria-label="Volver a la lista"
          className="grid size-11 place-items-center rounded-md text-fg md:hidden"
        >
          <icons.chevronLeft size={18} />
        </Link>
        <div
          role="toolbar"
          aria-label="Formato"
          className={cn(
            'order-last -mx-1 flex w-full gap-0.5 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:px-0',
            mode === 'preview' && 'hidden',
          )}
        >
          {TOOLS.map((t) => (
            <button
              key={t.command}
              type="button"
              aria-label={t.label}
              title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
              // No quitar el foco ni la selección del texto (en iOS, tampoco cerrar el teclado).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format(t.command)}
              className={toolBtn}
            >
              {t.content}
            </button>
          ))}
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
            {STATUS[status]}
          </span>
          <SegmentedControl<Mode>
            aria-label="Modo"
            size={touch ? 'lg' : 'md'}
            value={mode}
            onValueChange={(v) => (v === 'edit' ? edit() : setMode('preview'))}
            options={[
              { value: 'edit', label: 'Editar' },
              { value: 'preview', label: 'Vista previa' },
            ]}
          />
          <IconButton
            aria-label={note.pinned ? 'Desfijar' : 'Fijar'}
            aria-pressed={note.pinned}
            icon={<icons.pin weight={note.pinned ? 'fill' : 'regular'} />}
            onClick={togglePin}
            className={cn(touch && 'size-11', note.pinned && 'text-accent')}
          />
          <Menu>
            <MenuTrigger asChild>
              <IconButton
                aria-label="Más acciones"
                icon={<icons.dots />}
                className={cn(touch && 'size-11')}
              />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={copyLink}>Copiar enlace</MenuItem>
              <MenuItem onSelect={copyMarkdown}>Copiar Markdown</MenuItem>
              <MenuItem danger onSelect={archive}>
                Archivar nota
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-6 md:px-2 md:pt-9">
        <input
          ref={titleRef}
          aria-label="Título de la nota"
          placeholder="Sin título"
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
            label="Proyecto"
            variant={touch ? 'field' : 'inline'}
            large={touch}
            value={note.projectId ?? ''}
            options={projectOptions}
            onChange={setProject}
          />
          {note.projectId ? (
            <>
              <SelectMenu
                label="Tarea vinculada"
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
                  aria-label="Abrir la tarea"
                  title="Abrir la tarea"
                  className="grid size-7 place-items-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
                >
                  <icons.external size={14} />
                </Link>
              ) : null}
            </>
          ) : null}
          <span className="px-2 text-xs text-fg-subtle">Editada {timeAgo(note.updatedAt)}</span>
        </div>

        {mode === 'edit' ? (
          <textarea
            ref={bodyRef}
            aria-label="Texto de la nota, en Markdown"
            placeholder="Escribe en Markdown…"
            value={draft.content}
            maxLength={200000}
            spellCheck
            onChange={(e) => change({ content: e.target.value })}
            onKeyDown={onBodyKey}
            onBlur={() => void save()}
            // 16 px en móvil: con menos, iOS hace zoom al enfocar el campo.
            className="min-h-[55dvh] w-full resize-none bg-transparent font-mono text-[16px] leading-relaxed text-fg outline-none [field-sizing:content] placeholder:text-fg-faint md:min-h-[40dvh] md:text-sm"
          />
        ) : draft.content.trim() ? (
          // Un clic en el texto (no en un enlace ni en una casilla) pasa a editar.
          // biome-ignore lint/a11y/useKeyWithClickEvents: el botón «Editar» del modo es la vía de teclado
          // biome-ignore lint/a11y/noStaticElementInteractions: ver arriba
          <div
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('a, input, button')) edit()
            }}
            className="min-h-[40dvh] cursor-text"
          >
            <Markdown source={draft.content} onToggleTask={toggle} />
          </div>
        ) : (
          <button
            type="button"
            onClick={edit}
            className="min-h-[30dvh] cursor-text text-left text-md text-fg-faint"
          >
            Esta nota está vacía. Pulsa para escribir.
          </button>
        )}
      </div>
    </article>
  )
}
