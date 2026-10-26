import { createOllamaProvider } from '@muninn/assistant'
import { Button, Card, cn, Dialog, Icon, IconButton, icons, SheetContent } from '@muninn/ui'
import { getRouteApi } from '@tanstack/react-router'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Page, PageHeader } from '../components/Page'
import { useAssistantChat } from '../lib/assistant-chat'
import { DEMO_EXAMPLES, demoProvider } from '../lib/assistant-demo'
import { type Conversation, groupOf } from '../lib/assistant-history'
import { useAssistantPrefs } from '../lib/assistant-settings'
import { isHandheld, useProviderStatus } from '../lib/assistant-status'
import { timeAgo } from '../lib/dates'
import { useEnabledModules } from '../lib/modules'
import { useAuth, useMuninn } from '../lib/muninn'
import { useIsDesktop } from '../lib/use-media'
import { BrainChip, ModelState } from './asistente/ModelState'
import { Reply, UserBubble } from './asistente/TurnView'

const route = getRouteApi('/_app/asistente')

const SUGGESTIONS = [
  '¿Cómo voy hoy?',
  '¿Qué tengo para mañana?',
  '¿Qué suscripciones me cobran esta semana?',
]

/** Conversaciones del dispositivo, agrupadas como en el diseño (Hoy, Esta semana, Antes). */
function ConversationList({
  conversations,
  currentId,
  onSelect,
  onNew,
  disabled,
}: {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  disabled: boolean
}) {
  const groups = useMemo(() => {
    const out = new Map<string, Conversation[]>()
    for (const c of conversations) {
      const g = groupOf(c.updatedAt)
      out.set(g, [...(out.get(g) ?? []), c])
    }
    return [...out]
  }, [conversations])
  return (
    <nav aria-label="Conversaciones" className="flex flex-col gap-1">
      <Button className="mb-2 justify-start" onClick={onNew} disabled={disabled}>
        <icons.plus size={15} />
        Nueva conversación
      </Button>
      {groups.length === 0 ? (
        <p className="px-3 py-2 text-sm text-fg-subtle">
          Aquí quedarán tus conversaciones, solo en este dispositivo.
        </p>
      ) : null}
      {groups.map(([label, list]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <span className="px-3 pt-2.5 pb-1 text-xs font-semibold tracking-wider text-fg-faint uppercase">
            {label}
          </span>
          {list.map((c) => {
            const actions = c.turns.reduce((n, t) => n + (t.changes?.length ?? 0), 0)
            return (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(c.id)}
                aria-current={c.id === currentId ? 'true' : undefined}
                className="flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-left text-[13.5px] text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60 aria-[current=true]:bg-fg/[0.07]"
              >
                <span className="truncate">{c.title}</span>
                <span className="text-xs text-fg-subtle">
                  {timeAgo(c.updatedAt)}
                  {actions ? ` · ${actions} ${actions === 1 ? 'acción' : 'acciones'}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

/**
 * Asistente (Asistente.dc.html y M-Asistente.dc.html, ADR-0041): conversación en streaming con el modelo local, las
 * herramientas que ha usado, qué ha cambiado con «Deshacer» y un estado claro cuando no hay modelo.
 */
export function Asistente() {
  const m = useMuninn()
  const auth = useAuth()
  const prefs = useAssistantPrefs()
  const modules = useEnabledModules()
  const desktop = useIsDesktop()
  const { q } = route.useSearch()
  const navigate = route.useNavigate()
  const demo = auth.kind === 'demo'

  const provider = useMemo(
    () =>
      demo
        ? demoProvider()
        : isHandheld()
          ? null
          : createOllamaProvider({ baseUrl: prefs.ollamaUrl, model: prefs.model }),
    [demo, prefs.ollamaUrl, prefs.model],
  )
  const { status, retry } = useProviderStatus(provider)
  const ready = status.state === 'ready'
  const chat = useAssistantChat({
    app: m,
    provider: ready ? provider : null,
    userKey: auth.kind === 'user' ? auth.account.id : 'demo',
    modules,
  })

  const [draft, setDraft] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)

  // La pregunta que llega del buscador ⌘K («Preguntar a Muninn»): se envía una vez y sale de la URL.
  const asked = useRef<string | null>(null)
  useEffect(() => {
    if (!q || asked.current === q) return
    if (!ready) {
      setDraft((d) => d || q)
      return
    }
    asked.current = q
    chat.startNew()
    void chat.send(q)
    setDraft('')
    void navigate({ search: {}, replace: true })
  }, [q, ready, chat.send, chat.startNew, navigate])

  const turns = chat.current?.turns ?? []
  const lastText = turns.at(-1)?.text
  // biome-ignore lint/correctness/useExhaustiveDependencies: baja con cada trozo nuevo de la respuesta
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [turns.length, lastText])

  const submit = (text = draft) => {
    if (!text.trim() || chat.running || !ready) return
    void chat.send(text)
    setDraft('')
    input.current?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }
  const startNew = () => {
    chat.startNew()
    setHistoryOpen(false)
    input.current?.focus()
  }

  const list = (
    <ConversationList
      conversations={chat.conversations}
      currentId={chat.current?.id ?? null}
      disabled={chat.running}
      onNew={startNew}
      onSelect={(id) => {
        chat.select(id)
        setHistoryOpen(false)
      }}
    />
  )
  const suggestions = demo ? DEMO_EXAMPLES : SUGGESTIONS

  return (
    <Page className="max-w-[1180px]">
      <div className="flex gap-6">
        {desktop ? (
          <aside className="hidden w-[250px] shrink-0 lg:block">
            <div className="sticky top-7 max-h-[calc(100dvh-3.5rem)] overflow-y-auto pr-1">
              {list}
            </div>
          </aside>
        ) : null}

        <section aria-label="Chat" className="flex min-w-0 flex-1 flex-col gap-5">
          <PageHeader
            title={chat.current?.title ?? 'Asistente'}
            description={
              chat.current ? undefined : 'Pregunta o pide algo sobre tus tareas, notas y finanzas.'
            }
            actions={
              <>
                <BrainChip status={status} label={provider?.label ?? ''} />
                <IconButton
                  aria-label="Conversaciones"
                  icon={<Icon name="clock" />}
                  variant="secondary"
                  className="lg:hidden"
                  onClick={() => setHistoryOpen(true)}
                />
                {chat.current ? (
                  <IconButton
                    aria-label="Nueva conversación"
                    icon={<icons.plus size={16} />}
                    variant="secondary"
                    onClick={startNew}
                    disabled={chat.running}
                  />
                ) : null}
              </>
            }
          />

          {demo ? (
            <p className="flex items-start gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm text-fg-muted">
              <Icon name="info" size={15} className="mt-0.5 shrink-0" />
              Estás en la demo: no hay modelo, respondo con un guion a unas pocas frases, pero lo
              que cambio es de verdad (en la memoria de la demo).
            </p>
          ) : null}

          <ModelState status={status} url={prefs.ollamaUrl} onRetry={retry} />

          {turns.length ? (
            <div className="flex flex-col gap-6" aria-live="polite" aria-busy={chat.running}>
              {turns.map((t, i) =>
                t.role === 'user' ? (
                  <UserBubble key={t.id} text={t.text} />
                ) : (
                  <Reply
                    key={t.id}
                    turn={t}
                    running={chat.running && i === turns.length - 1}
                    canUndo={chat.canUndo(t.id)}
                    onUndo={() => chat.current && void chat.undo(chat.current.id, t.id)}
                  />
                ),
              )}
            </div>
          ) : ready ? (
            <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name="assistant" size={24} />
              </span>
              <h2 className="text-lg font-semibold">¿En qué te ayudo?</h2>
              <p className="max-w-md text-sm text-fg-muted text-pretty">
                Puedo consultar y cambiar tus proyectos, tareas, notas y finanzas: crear, mover,
                completar y archivar. Nunca borro nada.
              </p>
            </Card>
          ) : null}
          <div ref={end} />

          <div
            className={cn(
              'glass sticky z-10 -mx-2 flex flex-col gap-2.5 rounded-lg px-2 pt-2 pb-2',
              'bottom-[calc(env(safe-area-inset-bottom)+96px)] md:bottom-4',
            )}
          >
            {!turns.length && ready ? (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <Button key={s} size="sm" variant="secondary" onClick={() => submit(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2 rounded-md border border-border-strong bg-surface-sunken py-2 pr-2 pl-3.5 focus-within:border-accent">
              <label htmlFor="asistente-mensaje" className="sr-only">
                Mensaje
              </label>
              <textarea
                id="asistente-mensaje"
                ref={input}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                disabled={!ready}
                placeholder={
                  ready ? 'Pregunta o pide algo a Muninn…' : 'El asistente no está disponible aquí'
                }
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent text-base leading-normal text-fg outline-none placeholder:text-fg-faint disabled:cursor-not-allowed"
              />
              {chat.running ? (
                <IconButton
                  aria-label="Detener"
                  icon={<Icon name="close" size={17} />}
                  variant="secondary"
                  size="lg"
                  onClick={chat.stop}
                />
              ) : (
                <IconButton
                  aria-label="Enviar"
                  icon={<Icon name="send" size={17} />}
                  variant="primary"
                  size="lg"
                  disabled={!ready || !draft.trim()}
                  onClick={() => submit()}
                />
              )}
            </div>
            <span className="hidden text-center text-xs text-fg-faint md:block">
              Muninn puede crear, mover y archivar, pero nunca borra. Todo queda en la actividad.
            </span>
          </div>
        </section>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent title="Conversaciones" side={desktop ? 'right' : 'bottom'}>
          <div className="p-3">{list}</div>
        </SheetContent>
      </Dialog>
    </Page>
  )
}
