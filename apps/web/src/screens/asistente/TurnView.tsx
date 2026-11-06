import type { ChangeTarget, ToolRun } from '@muninn/assistant'
import { Button, cn, Icon } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { t as tr } from '../../i18n'
import type { Turn } from '../../lib/assistant-history'
import { isTauri } from '../../lib/auth'
import { openImage } from '../../lib/external-link'
import { Markdown } from '../../markdown/Markdown'
import { Logo } from '../../shell/Logo'

/**
 * Frases del estado «pensando»: rotan mientras el modelo trabaja. Muninn es el cuervo de la memoria de Odín: algunas
 * guiñan a eso. Las de `toolPhrases` salen cuando ya está usando herramientas. Funciones: en el idioma activo.
 */
export const thinkingPhrases = () => [
  tr('thinking.thinking', { ns: 'assistant' }),
  tr('thinking.ordering', { ns: 'assistant' }),
  tr('thinking.remembering', { ns: 'assistant' }),
  tr('thinking.connecting', { ns: 'assistant' }),
  tr('thinking.refining', { ns: 'assistant' }),
  tr('thinking.hugin', { ns: 'assistant' }),
  tr('thinking.wings', { ns: 'assistant' }),
  tr('thinking.day', { ns: 'assistant' }),
]
export const toolPhrases = () => [
  tr('working.data', { ns: 'assistant' }),
  tr('working.numbers', { ns: 'assistant' }),
  tr('working.tasks', { ns: 'assistant' }),
  tr('working.tidying', { ns: 'assistant' }),
  tr('working.notes', { ns: 'assistant' }),
]
const PHRASE_MS = 2400

/** «Pensando…» con una ola del color de acento y frases que cambian (empieza en una al azar). */
export function Thinking({ working }: { working: boolean }) {
  const list = working ? toolPhrases() : thinkingPhrases()
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
  const { t } = useTranslation('assistant')
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
          ? t('tool.running')
          : run.status === 'ok'
            ? t('tool.ok')
            : t('tool.failed', { error: run.error ?? '' })}
      </span>
    </span>
  )
}

function TargetLink({ target }: { target: ChangeTarget }) {
  const { t } = useTranslation('assistant')
  const cls = 'text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline'
  switch (target.kind) {
    case 'task':
      return (
        <Link
          to="/projects/$projectId/tasks/$taskId"
          params={{ projectId: target.projectId, taskId: target.id }}
          className={cls}
        >
          {t('open')}
        </Link>
      )
    case 'project':
      return (
        <Link to="/projects/$projectId" params={{ projectId: target.id }} className={cls}>
          {t('open')}
        </Link>
      )
    case 'note':
      return (
        <Link to="/notes/$noteId" params={{ noteId: target.id }} className={cls}>
          {t('open')}
        </Link>
      )
    default:
      return (
        <Link to="/finance" className={cls}>
          {t('open')}
        </Link>
      )
  }
}

function AttachedImage({ src, n }: { src: string; n: number }) {
  const { t } = useTranslation('assistant')
  return (
    <img
      src={src}
      alt={t('attachedImage', { n })}
      className="max-h-44 max-w-56 rounded-lg border border-border object-cover"
    />
  )
}

/** Memo: con la conversación en streaming, los mensajes anteriores no se repintan. */
export const UserBubble = memo(function UserBubble({
  text,
  images,
}: {
  text: string
  images?: string[]
}) {
  const { t } = useTranslation('assistant')
  return (
    <div className="flex max-w-[86%] flex-col items-end gap-1.5 self-end md:max-w-[75%]">
      {images?.length ? (
        <ul aria-label={t('imagesLabel')} className="flex flex-wrap justify-end gap-1.5">
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
})

interface ReplyProps {
  turn: Turn
  running: boolean
  canUndo: boolean
  /** Estable (useCallback) para que el memo sirva: recibe el turno a deshacer. */
  onUndo: (turnId: string) => void
}

/** Respuesta del asistente: herramientas usadas, el texto (Markdown) y qué ha cambiado, con «Deshacer». */
/** Memo: solo se repinta la respuesta que cambia (los turnos sin cambios conservan su objeto). */
export const Reply = memo(function Reply({ turn, running, canUndo, onUndo }: ReplyProps) {
  const { t } = useTranslation('assistant')
  const tools = turn.tools ?? []
  const changes = turn.changes ?? []
  const undone = changes.length > 0 && changes.every((c) => c.undone)
  return (
    <div className="flex gap-3.5">
      <MuninnAvatar busy={running && !turn.text} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">
        {tools.length ? (
          <ul aria-label={t('toolsUsed')} className="flex flex-wrap gap-1.5">
            {tools.map((run) => (
              <li key={run.id} className="max-w-full">
                <ToolChip run={run} />
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
              {undone ? t('undone') : t('changed', { count: changes.length })}
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
                <Button size="sm" onClick={() => onUndo(turn.id)}>
                  <Icon name="sync" size={13} />
                  {t('undoChanges', { count: changes.length })}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {turn.stopped ? <p className="text-xs text-fg-subtle">{t('stopped')}</p> : null}
        {turn.error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {turn.error}
          </p>
        ) : null}
      </div>
    </div>
  )
})
