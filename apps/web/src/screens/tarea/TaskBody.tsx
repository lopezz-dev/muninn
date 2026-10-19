import type { TaskWithColumn } from '@muninn/core'
import { Checkbox, Chip, cn, columnKinds, Icon, icons, TextArea } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { SelectMenu } from '../../components/SelectMenu'
import { PRIORITY_TEXT, SourceBadge } from '../../components/task-meta'
import { actorName, describeActivity } from '../../lib/activity'
import { type BoardData, PRIORITIES } from '../../lib/board'
import { dueLabel, timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { createNote } from '../../lib/note-actions'
import { taskActivityQuery, taskNotesQuery } from '../../lib/queries'
import { completeTask, moveTask, patchTask, reopenTask } from '../../lib/task-actions'
import { toggleTask } from '../../markdown/tasks'
import { Checklist } from './Checklist'

const h3 = 'text-xs font-semibold tracking-wider text-fg-subtle uppercase'

interface BodyProps {
  task: TaskWithColumn
  board: BoardData
  /** Móvil: zonas táctiles de 44 px y propiedades en fila de píldoras. */
  touch?: boolean
}

/** Casilla y título editable. Se guarda al salir del campo o con Enter. */
function TitleRow({ task, touch }: Pick<BodyProps, 'task' | 'touch'>) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [title, setTitle] = useState(task.title)
  useEffect(() => setTitle(task.title), [task.title])
  const done = task.column.kind === 'done'

  const commit = () => {
    const clean = title.trim()
    if (!clean) return setTitle(task.title)
    if (clean !== task.title) {
      void patchTask(m, qc, task, { title: clean }, { message: 'Título actualizado' })
    }
  }

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        checked={done}
        onCheckedChange={(v) => (v ? completeTask(m, qc, task) : reopenTask(m, qc, task))}
        aria-label={done ? 'Reabrir tarea' : 'Completar tarea'}
        size="lg"
        touch={touch}
        className={cn('mt-1.5', !touch && 'size-5')}
      />
      <textarea
        aria-label="Título de la tarea"
        value={title}
        rows={1}
        maxLength={300}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            setTitle(task.title)
            e.currentTarget.blur()
          }
        }}
        // `field-sizing` hace crecer el campo con el texto, sin medir nada en JS.
        className={cn(
          'min-w-0 flex-1 resize-none rounded-md bg-transparent px-1 font-semibold tracking-tight outline-none [field-sizing:content] focus:bg-surface-sunken',
          touch ? 'text-2xl leading-tight' : 'text-xl leading-snug',
          done && 'text-fg-muted',
        )}
      />
    </div>
  )
}

/** Fecha de vencimiento: el selector nativo de fechas (teclado, calendario y móvil ya resueltos). */
function DueField({ task, touch }: Pick<BodyProps, 'task' | 'touch'>) {
  const m = useMuninn()
  const qc = useQueryClient()
  const today = m.today()
  const set = (value: string) =>
    patchTask(
      m,
      qc,
      task,
      { dueDate: value || null },
      {
        message: value
          ? `Vence: ${dueLabel(value, today).toLowerCase()}`
          : 'Fecha de vencimiento quitada',
        icon: 'calendar',
      },
    )
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="date"
        aria-label="Fecha de vencimiento"
        value={task.dueDate ?? ''}
        onChange={(e) => {
          if (e.target.value !== (task.dueDate ?? '')) void set(e.target.value)
        }}
        className={cn(
          'rounded-md border border-transparent bg-transparent px-2 text-sm font-medium outline-none transition-colors hover:bg-surface-hover focus-visible:border-accent',
          touch ? 'h-[38px] border-border-strong bg-surface-raised' : '-ml-2 h-7',
          task.dueDate ? 'text-fg' : 'text-fg-subtle',
        )}
      />
      {task.dueDate ? (
        <button
          type="button"
          aria-label="Quitar la fecha de vencimiento"
          onClick={() => set('')}
          className="grid size-6 cursor-pointer place-items-center rounded-sm text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <icons.close size={12} />
        </button>
      ) : null}
    </span>
  )
}

/** Etiquetas: chips que se quitan con su × y un campo para añadir (Enter o coma). */
function LabelsField({ task }: Pick<BodyProps, 'task'>) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [text, setText] = useState('')

  const add = () => {
    const label = text.trim().replace(/,$/, '').trim()
    setText('')
    if (!label || task.labels.some((l) => l.toLowerCase() === label.toLowerCase())) return
    void patchTask(
      m,
      qc,
      task,
      { labels: [...task.labels, label.slice(0, 40)] },
      { message: `Etiqueta «${label}» añadida`, icon: 'plus' },
    )
  }
  const remove = (label: string) =>
    patchTask(
      m,
      qc,
      task,
      { labels: task.labels.filter((l) => l !== label) },
      { message: `Etiqueta «${label}» quitada` },
    )

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {task.labels.map((l) => (
        <Chip key={l} className="gap-1 pr-1">
          {l}
          <button
            type="button"
            aria-label={`Quitar la etiqueta ${l}`}
            onClick={() => remove(l)}
            className="grid size-4 cursor-pointer place-items-center rounded-xs text-fg-faint transition-colors hover:text-fg"
          >
            <icons.close size={10} />
          </button>
        </Chip>
      ))}
      <input
        aria-label="Añadir etiqueta"
        placeholder="+ Añadir"
        value={text}
        maxLength={41}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
        className="h-[22px] w-20 rounded-sm border border-dashed border-border-strong bg-transparent px-2 text-xs text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent"
      />
    </span>
  )
}

/** Estado, prioridad, fecha, etiquetas y origen. En escritorio, filas; en móvil, píldoras. */
function Properties({ task, board, touch }: BodyProps) {
  const m = useMuninn()
  const qc = useQueryClient()

  const status = (
    <SelectMenu
      label="Estado"
      variant={touch ? 'field' : 'inline'}
      large={touch}
      value={task.columnId}
      options={board.columns.map((c) => ({ value: c.id, label: c.name, dot: columnKinds[c.kind] }))}
      onChange={(columnId) => {
        if (columnId === task.columnId) return
        const to = board.columns.find((c) => c.id === columnId)
        void moveTask(m, qc, {
          projectId: task.projectId,
          taskId: task.id,
          columnId,
          verb: to?.kind === 'done' ? 'completed' : 'moved',
        })
      }}
    />
  )
  const priority = (
    <SelectMenu
      label="Prioridad"
      variant={touch ? 'field' : 'inline'}
      large={touch}
      value={task.priority}
      options={PRIORITIES.map((p) => ({ ...p, tone: PRIORITY_TEXT[p.value] }))}
      onChange={(value) => {
        if (value === task.priority) return
        void patchTask(
          m,
          qc,
          task,
          { priority: value },
          {
            message: `Prioridad: ${PRIORITIES.find((p) => p.value === value)?.label.toLowerCase()}`,
            icon: 'flag',
          },
        )
      }}
    />
  )

  if (touch) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {status}
          {priority}
          <DueField task={task} touch />
        </div>
        <LabelsField task={task} />
        <SourceBadge source={task.source} className="text-sm text-fg-subtle" />
      </div>
    )
  }

  const row = 'grid min-h-[34px] grid-cols-[120px_1fr] items-center text-sm'
  return (
    <dl className="flex flex-col">
      <div className={row}>
        <dt className="text-fg-subtle">Estado</dt>
        <dd>{status}</dd>
      </div>
      <div className={row}>
        <dt className="text-fg-subtle">Prioridad</dt>
        <dd>{priority}</dd>
      </div>
      <div className={row}>
        <dt className="text-fg-subtle">Vence</dt>
        <dd>
          <DueField task={task} />
        </dd>
      </div>
      <div className={row}>
        <dt className="text-fg-subtle">Etiquetas</dt>
        <dd>
          <LabelsField task={task} />
        </dd>
      </div>
      <div className={row}>
        <dt className="text-fg-subtle">Origen</dt>
        <dd className="flex items-center gap-2 font-medium">
          {task.source === 'manual' ? (
            <>
              <Icon name="user" size={14} className="text-fg-subtle" />
              Manual
            </>
          ) : (
            <SourceBadge source={task.source} />
          )}
          <span className="font-normal text-fg-subtle">· creada {timeAgo(task.createdAt)}</span>
        </dd>
      </div>
    </dl>
  )
}

// El renderizador de Markdown (marked) solo se descarga si alguna descripción lo necesita.
const Markdown = lazy(() =>
  import('../../markdown/Markdown').then((m) => ({ default: m.Markdown })),
)

/**
 * Descripción en Markdown (ADR-0026). Si tiene texto se ve ya con su formato y se edita con «Editar» o
 * pulsando sobre el texto; las casillas de tarea se marcan sin entrar a editar. Se guarda al salir del campo.
 */
function Description({ task }: Pick<BodyProps, 'task'>) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [text, setText] = useState(task.description)
  const [editing, setEditing] = useState(false)
  useEffect(() => setText(task.description), [task.description])
  const hasText = task.description.trim().length > 0
  const showing = hasText && !editing

  const toggleBox = (index: number) => {
    const next = toggleTask(task.description, index)
    if (next !== null) {
      void patchTask(m, qc, task, { description: next }, { message: 'Casilla actualizada' })
    }
  }

  return (
    <section className="flex flex-col gap-2">
      {showing ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className={h3}>Descripción</h2>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="-mr-2 h-7 cursor-pointer rounded-md px-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              Editar
            </button>
          </div>
          {/* Un clic en el texto (no en un enlace ni en una casilla) pasa a editar. */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: el botón «Editar» es la vía de teclado */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: ver arriba */}
          <div
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('a, input, button')) setEditing(true)
            }}
            className="cursor-text"
          >
            <Suspense
              fallback={
                <p className="text-base whitespace-pre-wrap text-fg-muted">{task.description}</p>
              }
            >
              <Markdown source={task.description} onToggleTask={toggleBox} className="text-base" />
            </Suspense>
          </div>
        </>
      ) : (
        <TextArea
          label="Descripción"
          hideLabel
          rows={4}
          placeholder="Añade una descripción… (se entiende Markdown)"
          value={text}
          maxLength={20000}
          autoFocus={editing}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== task.description) {
              void patchTask(
                m,
                qc,
                task,
                { description: text },
                { message: 'Descripción guardada' },
              )
            }
            setEditing(false)
          }}
          className="[&_textarea]:[field-sizing:content] [&_textarea]:min-h-24"
        />
      )}
    </section>
  )
}

function Notes({ task, touch }: Pick<BodyProps, 'task' | 'touch'>) {
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const notes = useQuery(taskNotesQuery(m, task.id)).data ?? []

  // La nota nace vinculada a esta tarea (y a su proyecto) y se abre para escribir.
  const add = async () => {
    const note = await createNote(m, qc, { taskId: task.id })
    if (note) navigate({ to: '/notas/$noteId', params: { noteId: note.id } })
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className={h3}>Notas vinculadas</h2>
        <button
          type="button"
          onClick={add}
          className={cn(
            '-mr-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg',
            touch ? 'h-9' : 'h-7',
          )}
        >
          <icons.plus size={13} />
          Añadir nota
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-fg-subtle">Apuntes, decisiones o pasos de esta tarea.</p>
      ) : null}
      {notes.map((n) => (
        <Link
          key={n.id}
          to="/notas/$noteId"
          params={{ noteId: n.id }}
          className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-base transition-colors hover:border-border-strong"
        >
          <Icon name="notes" className="text-fg-subtle" />
          <span className="min-w-0 flex-1 truncate">{n.title || 'Sin título'}</span>
          <span className="text-xs text-fg-subtle">{timeAgo(n.updatedAt)}</span>
        </Link>
      ))}
    </section>
  )
}

function ActivityLog({ task }: Pick<BodyProps, 'task'>) {
  const m = useMuninn()
  const events = useQuery(taskActivityQuery(m, task.id)).data ?? []
  return (
    <section className="flex flex-col gap-3">
      <h2 className={h3}>Actividad</h2>
      {events.length === 0 ? (
        <p className="text-sm text-fg-subtle">Todavía no hay actividad.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((a) => (
            <li key={a.id} className="flex gap-2.5 text-sm leading-snug text-fg-muted">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-px grid size-5 shrink-0 place-items-center rounded-sm bg-surface-raised',
                  a.actor !== 'user' && 'text-accent',
                )}
              >
                <Icon name={a.actor === 'user' ? 'user' : 'assistant'} size={12} />
              </span>
              <span>
                <b className="font-medium text-fg">{actorName(a.actor)}</b> {describeActivity(a)} ·{' '}
                {timeAgo(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Todo el contenido del detalle, igual en el panel de escritorio y en la pantalla de móvil. */
export function TaskBody({ task, board, touch }: BodyProps) {
  return (
    <div className="flex flex-col gap-6">
      <TitleRow task={task} touch={touch} />
      <Properties task={task} board={board} touch={touch} />
      <Description task={task} />
      <Checklist task={task} touch={touch} />
      <Notes task={task} touch={touch} />
      <ActivityLog task={task} />
    </div>
  )
}
