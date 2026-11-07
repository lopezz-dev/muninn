import {
  ANCHOR_CONTEXT,
  type CommentThread,
  type Note,
  type NoteComment,
  threads as toThreads,
} from '@muninn/core'
import {
  Button,
  cn,
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Dialog as Sheet,
  SheetContent,
  Switch,
  screenIcons,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  archiveThread,
  authorOf,
  commentKeys,
  createComment,
  noteCommentsQuery,
  replyComment,
  setResolved,
} from '../../../lib/comment-actions'
import { timeAgo } from '../../../lib/dates'
import { useMuninn } from '../../../lib/muninn'
import { Markdown } from '../../../markdown/Markdown'
import { readSelection } from '../rich/RichNote'
import { commentHighlightsKey, setHighlights } from './highlights'
import { textMap, toTextRange } from './text-map'

/** Ancho del margen de comentarios y lo que tiene que medir el cuerpo para que quepa al lado del texto. */
const RAIL_PX = 280
const RAIL_MIN_BODY_PX = 740

interface Draft {
  from: number
  to: number
  quote: string
  prefix: string
  suffix: string
}

/** El hilo está abierto y su cita sigue en la nota: se subraya y va en el margen. */
const isLive = (t: CommentThread) => !t.root.resolvedAt && !t.root.orphaned && !!t.root.anchor

/**
 * Comentarios de una nota (ADR-0079). Devuelve las piezas que la pantalla coloca: el botón del contador (barra de
 * arriba), el margen (al lado del texto, en pantallas anchas) y la hoja (en el resto, y la lista completa siempre).
 */
export function useNoteComments({
  editor,
  note,
  desktop,
  flush,
  bodyRef,
}: {
  editor: Editor | null
  note: Note
  desktop: boolean
  /** Guarda el texto pendiente antes de comentar: el core busca la cita en lo guardado. */
  flush: () => Promise<boolean>
  bodyRef: React.RefObject<HTMLDivElement | null>
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const list = useQuery(noteCommentsQuery(m, note.id)).data
  const all = useMemo(() => toThreads(list ?? []), [list])
  const live = useMemo(() => all.filter(isLive), [all])
  const [active, setActive] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const width = useWidth(bodyRef)
  const rail = desktop && width >= RAIL_MIN_BODY_PX
  const railOn = rail && (live.length > 0 || draft !== null)

  // Al guardar la nota, el core vuelve a anclar los hilos: se piden de nuevo (sin red, o en demo, no avisa el tiempo real).
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo cuando cambia la versión guardada
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: commentKeys.note(note.id) })
  }, [note.updatedAt])

  // Lo que se subraya en el texto.
  useEffect(() => {
    if (!editor) return
    setHighlights(editor.view, {
      highlights: live.map((t) => ({
        id: t.root.id,
        anchor: t.root.anchor as NonNullable<NoteComment['anchor']>,
        forAgent: t.root.forAgent,
      })),
      active,
      fresh,
      draft: draft ? { from: draft.from, to: draft.to } : null,
    })
  }, [editor, live, active, fresh, draft])

  // El dibujo del subrayado nuevo dura 0,6 s; después, como los demás.
  useEffect(() => {
    if (!fresh) return
    const timer = setTimeout(() => setFresh(null), 900)
    return () => clearTimeout(timer)
  }, [fresh])

  /** Empieza un comentario sobre un trozo del texto (la selección, o lo que diga la barra). */
  const startComment = useCallback(
    (range?: { from: number; to: number }) => {
      if (!editor) return
      // La que se ve manda (ProseMirror puede no haber leído un doble clic).
      const { from, to } = range ?? readSelection(editor) ?? editor.state.selection
      const map = textMap(editor.state.doc)
      const r = toTextRange(map, from, to)
      if (!r) return
      const quote = map.text.slice(r.start, r.end)
      setDraft({
        from,
        to,
        quote,
        prefix: map.text.slice(Math.max(0, r.start - ANCHOR_CONTEXT), r.start),
        suffix: map.text.slice(r.end, r.end + ANCHOR_CONTEXT),
      })
      setActive(null)
      // Que no se quede la selección (ni la barra flotante) encima del subrayado.
      editor.commands.setTextSelection(to)
      editor.view.dom.ownerDocument.getSelection()?.removeAllRanges()
      if (!rail) setSheetOpen(true)
    },
    [editor, rail],
  )

  const activate = useCallback(
    (id: string) => {
      setActive(id)
      setDraft(null)
      if (!rail) setSheetOpen(true)
    },
    [rail],
  )

  const submit = async (body: string, forAgent: boolean) => {
    if (!draft) return false
    await flush()
    const c = await createComment(m, qc, {
      noteId: note.id,
      quote: draft.quote,
      prefix: draft.prefix,
      suffix: draft.suffix,
      body,
      forAgent,
    })
    if (!c) return false
    setDraft(null)
    setFresh(c.id)
    setActive(c.id)
    return true
  }

  const counter = (
    <CommentsButton
      count={all.filter((t) => !t.root.resolvedAt).length}
      touch={!desktop}
      onClick={() => {
        setActive(null)
        setSheetOpen(true)
      }}
    />
  )

  const railNode = railOn ? (
    <Rail
      editor={editor}
      threads={live}
      active={active}
      draft={draft}
      onActivate={setActive}
      onCancelDraft={() => setDraft(null)}
      onSubmit={submit}
    />
  ) : null

  const sheet = (
    <CommentsSheet
      open={sheetOpen}
      onOpenChange={(open) => {
        setSheetOpen(open)
        if (!open) {
          setDraft(null)
          setActive(null)
        }
      }}
      side={desktop ? 'right' : 'bottom'}
      threads={all}
      active={active}
      draft={rail ? null : draft}
      onActivate={setActive}
      onCancelDraft={() => {
        setDraft(null)
        setSheetOpen(false)
      }}
      onSubmit={async (body, forAgent) => {
        const ok = await submit(body, forAgent)
        return ok
      }}
    />
  )

  return { counter, rail: railNode, railOn, sheet, startComment, activate }
}

/** Ancho de un elemento, al día. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    // Con el `padding`: el margen de comentarios lo ocupa, y sin él el ancho cambiaría al abrirlo (y lo volvería a cerrar).
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry?.borderBoxSize?.[0]?.inlineSize ?? el.getBoundingClientRect().width),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

/** `RAIL_PX` para el `padding` del cuerpo cuando el margen está a la vista. */
export const COMMENTS_RAIL_PX = RAIL_PX

function CommentsButton({
  count,
  touch,
  onClick,
}: {
  count: number
  touch: boolean
  onClick(): void
}) {
  const { t } = useTranslation('notes')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('comments.show', { count })}
      title={t('comments.show', { count })}
      className={cn(
        'flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-sm text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
        touch ? 'h-11' : 'h-8',
        count > 0 && 'text-fg',
      )}
    >
      <screenIcons.comment size={touch ? 18 : 16} aria-hidden="true" />
      {count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </button>
  )
}

/** Margen de comentarios: cada hilo a la altura de su texto, sin pisarse. */
function Rail({
  editor,
  threads,
  active,
  draft,
  onActivate,
  onCancelDraft,
  onSubmit,
}: {
  editor: Editor | null
  threads: CommentThread[]
  active: string | null
  draft: Draft | null
  onActivate(id: string | null): void
  onCancelDraft(): void
  onSubmit(body: string, forAgent: boolean): Promise<boolean>
}) {
  const { t } = useTranslation('notes')
  const ref = useRef<HTMLElement>(null)
  const [tick, setTick] = useState(0)

  // Volver a colocar cuando el texto cambia de alto o de forma.
  useEffect(() => {
    if (!editor) return
    let frame = 0
    const later = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setTick((n) => n + 1))
    }
    editor.on('update', later)
    editor.on('transaction', later)
    const ro = new ResizeObserver(later)
    ro.observe(editor.view.dom)
    window.addEventListener('resize', later)
    return () => {
      cancelAnimationFrame(frame)
      editor.off('update', later)
      editor.off('transaction', later)
      ro.disconnect()
      window.removeEventListener('resize', later)
    }
  }, [editor])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` pide volver a colocar
  useLayoutEffect(() => {
    const rail = ref.current
    if (!rail || !editor) return
    const base = rail.getBoundingClientRect().top
    const cards = [...rail.querySelectorAll<HTMLElement>('[data-card]')]
    const wanted = cards.map((card) => {
      const id = card.dataset.card as string
      const sel =
        id === '__draft' ? '.mn-comment.is-draft' : `.mn-comment[data-thread="${CSS.escape(id)}"]`
      const mark = editor.view.dom.querySelector<HTMLElement>(sel)
      return { card, top: mark ? mark.getBoundingClientRect().top - base : 0, id }
    })
    wanted.sort((a, b) => a.top - b.top)
    // El activo, en su sitio; los de debajo bajan lo que haga falta y los de encima suben.
    const pinned = wanted.findIndex((w) => w.id === active || (w.id === '__draft' && !active))
    const tops = wanted.map((w) => w.top)
    const heights = wanted.map((w) => w.card.offsetHeight)
    const gap = 8
    const start = pinned >= 0 ? pinned : 0
    for (let i = start + 1; i < tops.length; i++) {
      tops[i] = Math.max(
        tops[i] as number,
        (tops[i - 1] as number) + (heights[i - 1] as number) + gap,
      )
    }
    for (let i = start - 1; i >= 0; i--) {
      tops[i] = Math.min(tops[i] as number, (tops[i + 1] as number) - (heights[i] as number) - gap)
    }
    const shift = Math.min(0, ...tops)
    wanted.forEach((w, i) => {
      w.card.style.top = `${(tops[i] as number) - shift}px`
    })
    const bottom = Math.max(
      0,
      ...wanted.map((_w, i) => (tops[i] as number) - shift + (heights[i] as number)),
    )
    rail.style.minHeight = `${bottom}px`
  }, [editor, threads, active, draft, tick])

  return (
    <aside
      ref={ref}
      aria-label={t('comments.title')}
      className="absolute top-0 right-0 hidden md:block"
      style={{ width: RAIL_PX - 24 }}
    >
      {draft ? (
        <div data-card="__draft" className="absolute inset-x-0 transition-[top] duration-200">
          <Composer
            key={`${draft.from}-${draft.to}`}
            quote={draft.quote}
            onCancel={onCancelDraft}
            onSubmit={onSubmit}
          />
        </div>
      ) : null}
      {threads.map((x) => (
        <div
          key={x.root.id}
          data-card={x.root.id}
          className="absolute inset-x-0 transition-[top] duration-200"
        >
          <ThreadCard
            thread={x}
            active={active === x.root.id}
            compact
            onActivate={() => onActivate(active === x.root.id ? null : x.root.id)}
          />
        </div>
      ))}
    </aside>
  )
}

/** La hoja: el comentario que se escribe y todos los hilos, abiertos, sin sitio y resueltos. */
function CommentsSheet({
  open,
  onOpenChange,
  side,
  threads,
  active,
  draft,
  onActivate,
  onCancelDraft,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  side: 'right' | 'bottom'
  threads: CommentThread[]
  active: string | null
  draft: Draft | null
  onActivate(id: string | null): void
  onCancelDraft(): void
  onSubmit(body: string, forAgent: boolean): Promise<boolean>
}) {
  const { t } = useTranslation('notes')
  const [showResolved, setShowResolved] = useState(false)
  const openOnes = threads.filter((x) => !x.root.resolvedAt && !x.root.orphaned)
  const orphans = threads.filter((x) => !x.root.resolvedAt && x.root.orphaned)
  const resolved = threads.filter((x) => x.root.resolvedAt)
  const listRef = useRef<HTMLDivElement>(null)

  // Al abrir un hilo desde el texto, a la vista.
  useEffect(() => {
    if (!open || !active) return
    const timer = setTimeout(() => {
      listRef.current
        ?.querySelector(`[data-card="${CSS.escape(active)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 250)
    return () => clearTimeout(timer)
  }, [open, active])

  const section = (title: string, items: CommentThread[], extra?: ReactNode) =>
    items.length ? (
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-fg-faint uppercase">{title}</h3>
        {extra}
        {items.map((x) => (
          <div key={x.root.id} data-card={x.root.id}>
            <ThreadCard
              thread={x}
              active={active === x.root.id}
              onActivate={() => onActivate(active === x.root.id ? null : x.root.id)}
            />
          </div>
        ))}
      </section>
    ) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        title={t('comments.title')}
        className={side === 'right' ? 'w-[min(420px,100vw)]' : undefined}
      >
        <div ref={listRef} className="-mx-2 flex flex-col gap-5 pb-4">
          {draft ? (
            <Composer
              key={`${draft.from}-${draft.to}`}
              quote={draft.quote}
              onCancel={onCancelDraft}
              onSubmit={onSubmit}
              autoFocus
            />
          ) : null}
          {section(t('comments.open'), openOnes)}
          {section(
            t('comments.orphaned'),
            orphans,
            <p className="text-sm text-fg-subtle">{t('comments.orphanedHint')}</p>,
          )}
          {!draft && openOnes.length === 0 && orphans.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-subtle">{t('comments.empty')}</p>
          ) : null}
          {resolved.length ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                aria-expanded={showResolved}
                className="flex cursor-pointer items-center gap-1.5 self-start rounded-sm text-xs font-semibold tracking-wider text-fg-faint uppercase outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
              >
                {showResolved ? <icons.chevronDown size={12} /> : <icons.chevronRight size={12} />}
                {t('comments.resolvedCount', { count: resolved.length })}
              </button>
              {showResolved
                ? resolved.map((x) => (
                    <div key={x.root.id} data-card={x.root.id}>
                      <ThreadCard
                        thread={x}
                        active={active === x.root.id}
                        onActivate={() => onActivate(active === x.root.id ? null : x.root.id)}
                      />
                    </div>
                  ))
                : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Quién escribió: «Tú», «Claude»… con una inicial de color. */
function Author({ comment }: { comment: NoteComment }) {
  const { t } = useTranslation('notes')
  const who = authorOf(comment.actor)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
          who === 'you' ? 'bg-fg/[0.08] text-fg' : 'bg-accent-soft text-accent',
        )}
      >
        {who === 'claude' || who === 'assistant' ? (
          <icons.assistant size={11} />
        ) : (
          t(`comments.initial.${who}`)
        )}
      </span>
      <span className="font-medium text-fg">{t(`comments.author.${who}`)}</span>
      <span className="text-fg-faint">{timeAgo(comment.createdAt)}</span>
    </div>
  )
}

/** Un hilo: la cita, los comentarios, responder y resolver. */
function ThreadCard({
  thread,
  active,
  compact,
  onActivate,
}: {
  thread: CommentThread
  active: boolean
  /** En el margen: plegado hasta que se abre. */
  compact?: boolean
  onActivate(): void
}) {
  const { t } = useTranslation('notes')
  const m = useMuninn()
  const qc = useQueryClient()
  const { root, replies } = thread
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const folded = compact && !active
  const shown = folded ? [root] : [root, ...replies]
  const resolvedWho = root.resolvedBy ? authorOf(root.resolvedBy) : null

  const send = async () => {
    const body = reply.trim()
    if (!body || sending) return
    setSending(true)
    const ok = await replyComment(m, qc, root, body)
    setSending(false)
    if (ok) setReply('')
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: una tarjeta con controles dentro; el botón de abrir es la cita
    <article
      role="group"
      aria-label={t('comments.thread', { quote: root.anchor?.quote ?? '' })}
      className={cn(
        'glass-floating flex flex-col gap-2.5 rounded-lg border p-3 text-sm transition-[border-color,box-shadow]',
        active ? 'border-accent/60 shadow-lg' : 'border-border',
        root.resolvedAt && 'opacity-80',
      )}
    >
      <button
        type="button"
        onClick={onActivate}
        aria-expanded={active}
        className="flex cursor-pointer flex-col gap-1.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        {root.anchor ? (
          <span
            className={cn(
              'line-clamp-2 border-l-2 pl-2 text-xs text-fg-subtle',
              root.orphaned ? 'border-border-strong line-through' : 'border-accent',
            )}
          >
            {root.anchor.quote}
          </span>
        ) : null}
        <span className="flex flex-wrap items-center gap-1.5">
          {root.forAgent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
              <icons.assistant size={11} aria-hidden="true" />
              {t('comments.forClaude')}
            </span>
          ) : null}
          {root.resolvedAt && resolvedWho ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-fg/[0.06] px-2 py-0.5 text-[11px] font-medium text-fg-muted">
              <screenIcons.resolve size={11} aria-hidden="true" />
              {t('comments.resolvedBy', { who: t(`comments.author.${resolvedWho}`) })}
            </span>
          ) : null}
          {folded && replies.length ? (
            <span className="text-[11px] text-fg-subtle">
              {t('comments.replies', { count: replies.length })}
            </span>
          ) : null}
        </span>
      </button>
      {shown.map((c) => (
        <div key={c.id} className="flex flex-col gap-1">
          <Author comment={c} />
          <Markdown
            source={c.body}
            className={cn('gap-1.5 pl-7 text-sm leading-normal', folded && 'line-clamp-3')}
          />
        </div>
      ))}
      {folded ? null : (
        <>
          {root.resolvedAt ? null : (
            <div className="flex flex-col gap-1.5 pl-7">
              <textarea
                aria-label={t('comments.reply')}
                placeholder={t('comments.replyPlaceholder')}
                value={reply}
                rows={1}
                maxLength={10000}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void send()
                  }
                }}
                className="min-h-8 w-full resize-none rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-fg outline-none [field-sizing:content] placeholder:text-fg-faint focus:border-accent"
              />
              {reply.trim() ? (
                <Button
                  size="sm"
                  variant="primary"
                  className="self-end"
                  onClick={send}
                  disabled={sending}
                >
                  {t('comments.send')}
                </Button>
              ) : null}
            </div>
          )}
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void setResolved(m, qc, root, !root.resolvedAt)}
            >
              {root.resolvedAt ? (
                <>
                  <screenIcons.reset size={14} aria-hidden="true" />
                  {t('comments.reopen')}
                </>
              ) : (
                <>
                  <screenIcons.resolve size={14} aria-hidden="true" />
                  {t('comments.resolve')}
                </>
              )}
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <IconButton aria-label={t('comments.actions')} icon={<icons.dots />} />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem danger onSelect={() => void archiveThread(m, qc, root)}>
                  {t('comments.archive')}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </>
      )}
    </article>
  )
}

/** El comentario nuevo: texto, «Para Claude» y enviar (⌘↩) o cancelar (Esc). */
function Composer({
  quote,
  onCancel,
  onSubmit,
  autoFocus = true,
}: {
  quote: string
  onCancel(): void
  onSubmit(body: string, forAgent: boolean): Promise<boolean>
  autoFocus?: boolean
}) {
  const { t } = useTranslation('notes')
  const [body, setBody] = useState('')
  const [forAgent, setForAgent] = useState(false)
  const [sending, setSending] = useState(false)
  const switchId = useId()
  const send = async () => {
    if (!body.trim() || sending) return
    setSending(true)
    const ok = await onSubmit(body.trim(), forAgent)
    setSending(false)
    if (ok) setBody('')
  }
  // En todo el recuadro (también con el foco en «Para Claude»): ⌘↩ envía y Esc cancela.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void send()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: solo recoge los atajos de los controles de dentro
    <div
      onKeyDown={onKey}
      className="glass-floating flex flex-col gap-2.5 rounded-lg border border-accent/60 p-3 text-sm shadow-lg"
    >
      <span className="line-clamp-2 border-l-2 border-accent pl-2 text-xs text-fg-subtle">
        {quote}
      </span>
      <textarea
        // biome-ignore lint/a11y/noAutofocus: el campo aparece porque se ha pedido comentar
        autoFocus={autoFocus}
        aria-label={t('comments.new')}
        placeholder={t('comments.placeholder')}
        value={body}
        rows={2}
        maxLength={10000}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-16 w-full resize-none rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-fg outline-none [field-sizing:content] placeholder:text-fg-faint focus:border-accent"
      />
      <div className="flex items-start gap-2.5">
        <Switch id={switchId} checked={forAgent} onCheckedChange={setForAgent} />
        <label htmlFor={switchId} className="flex cursor-pointer flex-col gap-0.5">
          <span className="flex items-center gap-1 text-sm font-medium text-fg">
            <icons.assistant size={13} aria-hidden="true" className="text-accent" />
            {t('comments.forClaude')}
          </span>
          <span className="text-xs text-fg-subtle">{t('comments.forClaudeHint')}</span>
        </label>
      </div>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('comments.cancel')}
        </Button>
        <Button size="sm" variant="primary" onClick={send} disabled={!body.trim() || sending}>
          {t('comments.submit')}
        </Button>
      </div>
    </div>
  )
}

export { commentHighlightsKey }
