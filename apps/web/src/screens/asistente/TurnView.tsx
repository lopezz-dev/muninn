import type { ChangeTarget, ToolRun } from '@muninn/assistant'
import { Button, cn, Icon } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import type { Turn } from '../../lib/assistant-history'
import { Markdown } from '../../markdown/Markdown'

/** El chip de una herramienta: nombre técnico (como en el diseño), detalle y si fue bien. */
function ToolChip({ run }: { run: ToolRun }) {
  return (
    <span
      title={run.error ?? run.title}
      className="inline-flex h-[26px] max-w-full items-center gap-1.5 rounded-sm border border-border bg-surface-sunken px-2 text-xs text-fg-muted"
    >
      {run.status === 'running' ? (
        <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-accent" />
      ) : (
        <Icon
          name={run.status === 'ok' ? 'check' : 'close'}
          size={13}
          className={run.status === 'ok' ? 'text-success' : 'text-danger'}
        />
      )}
      <span className="font-mono">{run.name}</span>
      {run.detail ? <span className="truncate">{run.detail}</span> : null}
      <span className="sr-only">
        {run.status === 'running'
          ? 'en marcha'
          : run.status === 'ok'
            ? 'hecho'
            : `falló: ${run.error}`}
      </span>
    </span>
  )
}

function TargetLink({ target }: { target: ChangeTarget }) {
  const cls = 'text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline'
  switch (target.kind) {
    case 'task':
      return (
        <Link
          to="/proyectos/$projectId/tareas/$taskId"
          params={{ projectId: target.projectId, taskId: target.id }}
          className={cls}
        >
          Abrir
        </Link>
      )
    case 'project':
      return (
        <Link to="/proyectos/$projectId" params={{ projectId: target.id }} className={cls}>
          Abrir
        </Link>
      )
    case 'note':
      return (
        <Link to="/notas/$noteId" params={{ noteId: target.id }} className={cls}>
          Abrir
        </Link>
      )
    default:
      return (
        <Link to="/finanzas" className={cls}>
          Abrir
        </Link>
      )
  }
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[84%] self-end whitespace-pre-wrap break-words rounded-md bg-surface-raised px-3.5 py-2.5 text-base leading-relaxed md:max-w-[80%]">
      {text}
    </div>
  )
}

interface ReplyProps {
  turn: Turn
  running: boolean
  canUndo: boolean
  onUndo: () => void
}

/** Respuesta del asistente: herramientas usadas, el texto (Markdown) y qué ha cambiado, con «Deshacer». */
export function Reply({ turn, running, canUndo, onUndo }: ReplyProps) {
  const tools = turn.tools ?? []
  const changes = turn.changes ?? []
  const undone = changes.length > 0 && changes.every((c) => c.undone)
  return (
    <div className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
        <Icon name="assistant" size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {tools.length ? (
          <ul aria-label="Herramientas usadas" className="flex flex-wrap gap-1.5">
            {tools.map((t) => (
              <li key={t.id} className="max-w-full">
                <ToolChip run={t} />
              </li>
            ))}
          </ul>
        ) : null}
        {turn.text ? (
          <div className="text-base leading-relaxed text-fg">
            <Markdown source={turn.text} />
          </div>
        ) : running ? (
          <p className="text-sm text-fg-subtle" aria-live="polite">
            {tools.length ? 'Trabajando…' : 'Pensando…'}
          </p>
        ) : null}
        {changes.length ? (
          <div className="overflow-hidden rounded-md border border-border bg-surface-sunken">
            <p className="flex items-center gap-2 px-3 pt-2.5 pb-1 text-xs font-semibold tracking-wider text-fg-faint uppercase">
              {undone
                ? 'Deshecho'
                : changes.length === 1
                  ? 'Ha cambiado'
                  : `Ha cambiado (${changes.length})`}
            </p>
            <ul>
              {changes.map((c, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: la lista de cambios de un turno solo crece
                  key={i}
                  className={cn(
                    'flex items-center gap-2.5 border-t border-border-subtle px-3 py-2 text-sm first:border-t-0',
                    c.undone && 'text-fg-subtle line-through',
                  )}
                >
                  <Icon
                    name={c.undone ? 'sync' : 'check'}
                    size={14}
                    className="shrink-0 text-success"
                  />
                  <span className="min-w-0 flex-1 truncate">{c.summary}</span>
                  {c.target && !c.undone ? <TargetLink target={c.target} /> : null}
                </li>
              ))}
            </ul>
            {canUndo && !undone ? (
              <div className="border-t border-border-subtle px-3 py-2">
                <Button size="sm" onClick={onUndo}>
                  <Icon name="sync" size={13} />
                  Deshacer {changes.length === 1 ? 'el cambio' : 'los cambios'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {turn.stopped ? <p className="text-xs text-fg-subtle">Detenido.</p> : null}
        {turn.error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {turn.error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
