import type { ChangeTarget, ToolRun } from '@muninn/assistant'
import { Button, cn, Icon } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { Turn } from '../../lib/assistant-history'
import { isTauri } from '../../lib/auth'
import { openImage } from '../../lib/external-link'
import { Markdown } from '../../markdown/Markdown'
import { Logo } from '../../shell/Logo'

/**
 * Frases del estado «pensando»: rotan mientras el modelo trabaja. Muninn es el cuervo de la memoria de Odín: algunas
 * guiñan a eso. Las de `TOOL_PHRASES` salen cuando ya está usando herramientas.
 */
export const THINKING_PHRASES = [
  'Pensando…',
  'Ordenando ideas…',
  'Recordando…',
  'Atando cabos…',
  'Hilando fino…',
  'Consultando a Hugin…',
  'Batiendo las alas…',
  'Repasando tu día…',
]
export const TOOL_PHRASES = [
  'Mirando tus datos…',
  'Echando cuentas…',
  'Repasando tus tareas…',
  'Poniendo orden…',
  'Tomando nota…',
]
const PHRASE_MS = 2400

/** «Pensando…» con una ola del color de acento y frases que cambian (empieza en una al azar). */
export function Thinking({ working }: { working: boolean }) {
  const list = working ? TOOL_PHRASES : THINKING_PHRASES
  const [i, setI] = useState(() => Math.floor(Math.random() * list.length))
  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), PHRASE_MS)
    return () => clearInterval(t)
  }, [])
  return (
    <p className="text-[15px] font-medium" aria-live="polite">
      <span className="mn-shimmer">{list[i % list.length]}</span>
    </p>
  )
}

/** Avatar del asistente: la marca de Muninn (sigue al color de acento). Late mientras piensa. */
export function MuninnAvatar({ busy }: { busy?: boolean }) {
  return (
    <span className="relative grid size-7 shrink-0 place-items-center">
      {busy ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-md bg-accent/30 [animation-duration:1.6s] motion-reduce:hidden"
        />
      ) : null}
      <Logo className="relative size-7" />
    </span>
  )
}

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

function AttachedImage({ src, n }: { src: string; n: number }) {
  return (
    <img
      src={src}
      alt={`Imagen ${n} adjunta`}
      className="max-h-44 max-w-56 rounded-lg border border-border object-cover"
    />
  )
}

export function UserBubble({ text, images }: { text: string; images?: string[] }) {
  return (
    <div className="flex max-w-[86%] flex-col items-end gap-1.5 self-end md:max-w-[75%]">
      {images?.length ? (
        <ul aria-label="Imágenes" className="flex flex-wrap justify-end gap-1.5">
          {images.map((src, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: las imágenes de un mensaje no cambian
            <li key={i}>
              {isTauri ? (
                <AttachedImage src={src} n={i + 1} />
              ) : (
                <a
                  href={src}
                  onClick={(e) => {
                    e.preventDefault()
                    openImage(src)
                  }}
                  className="block"
                >
                  <AttachedImage src={src} n={i + 1} />
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {text ? (
        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-border-subtle bg-surface-raised px-4 py-2.5 text-[15px] leading-relaxed text-fg">
          {text}
        </div>
      ) : null}
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
    <div className="flex gap-3.5">
      <MuninnAvatar busy={running && !turn.text} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">
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
          // El Markdown de las notas va en gris de lectura; aquí, el texto principal (se leía apagado).
          <Markdown source={turn.text} className="text-[15px] leading-[1.7] text-fg" />
        ) : running ? (
          <Thinking working={tools.length > 0} />
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
