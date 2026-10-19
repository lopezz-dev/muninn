import type { TaskWithColumn } from '@muninn/core'
import { Checkbox, cn, IconButton, icons, ProgressBar, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useMuninn } from '../../lib/muninn'
import { checklistQuery } from '../../lib/queries'
import { addChecklistItem, deleteChecklistItem, setChecklistDone } from '../../lib/task-actions'

/** Subtareas de una tarea: marcar, quitar y añadir (Enter), cada cosa con su «Deshacer». */
export function Checklist({ task, touch }: { task: TaskWithColumn; touch?: boolean }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const items = useQuery(checklistQuery(m, task.id)).data ?? []
  const [title, setTitle] = useState('')
  const done = items.filter((i) => i.done).length

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const clean = title.trim()
    if (!clean) return
    setTitle('')
    if (!(await addChecklistItem(m, qc, task, clean))) setTitle(clean)
  }

  return (
    <section aria-labelledby={`cl-${task.id}`} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <h2
          id={`cl-${task.id}`}
          className="text-xs font-semibold tracking-wider text-fg-subtle uppercase"
        >
          Subtareas
        </h2>
        {items.length ? (
          <>
            <span className="text-xs text-fg-subtle tabular">
              {done} de {items.length}
            </span>
            <ProgressBar
              value={done / items.length}
              label="Subtareas hechas"
              className="h-[3px] flex-1"
            />
          </>
        ) : null}
      </div>

      <ul className="flex flex-col">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              'group flex items-center gap-3 border-border-subtle text-base',
              touch ? 'min-h-[52px] border-t first:border-t-0' : 'min-h-8',
            )}
          >
            <Checkbox
              checked={item.done}
              onCheckedChange={(v) => setChecklistDone(m, qc, task, item, v)}
              aria-label={`${item.done ? 'Desmarcar' : 'Marcar'}: ${item.title}`}
              touch={touch}
              size={touch ? 'lg' : 'md'}
            />
            <span
              className={cn(
                'min-w-0 flex-1 break-words',
                item.done && 'text-fg-subtle line-through',
              )}
            >
              {item.title}
            </span>
            <IconButton
              aria-label={`Quitar subtarea: ${item.title}`}
              icon={<icons.close size={14} />}
              size={touch ? 'lg' : 'sm'}
              className={cn(
                !touch &&
                  'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
              )}
              onClick={() => deleteChecklistItem(m, qc, task, item, index)}
            />
          </li>
        ))}
      </ul>

      <form onSubmit={add}>
        <TextField
          label="Añadir subtarea"
          hideLabel
          placeholder="Añadir subtarea"
          leading={<icons.plus size={14} />}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          autoComplete="off"
          size={touch ? 'lg' : 'md'}
        />
      </form>
    </section>
  )
}
