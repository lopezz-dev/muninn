import { createOllamaProvider } from '@muninn/assistant'
import { Button, Dialog, Icon, IconButton, icons, SheetContent } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Page, PageHeader } from '../components/Page'
import { useAssistantChat } from '../lib/assistant-chat'
import { DEMO_EXAMPLES, demoProvider } from '../lib/assistant-demo'
import { type Conversation, groupOf } from '../lib/assistant-history'
import { useAssistantPrefs } from '../lib/assistant-settings'
import { isHandheld, useProviderStatus } from '../lib/assistant-status'
import { timeAgo } from '../lib/dates'
import { useEnabledModules } from '../lib/modules'
import { reportPrefs } from '../lib/morning-report-prefs'
import { useAuth, useMuninn } from '../lib/muninn'
import { settingsQuery } from '../lib/queries'
import { useIsDesktop } from '../lib/use-media'
import { Logo } from '../shell/Logo'
import { Composer, type ComposerHandle } from './asistente/Composer'
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
  report,
}: {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  disabled: boolean
  /** El último informe de la mañana (ADR-0043): arriba, como «automático». */
  report: { noteId: string; date: string } | null
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
      {report ? (
        <Link
          to="/notas/$noteId"
          params={{ noteId: report.noteId }}
          className="flex flex-col gap-0.5 rounded-md px-3 py-2 text-[13.5px] text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Icon name="clock" size={13} className="text-accent" />
            Informe de la mañana
          </span>
          <span className="text-xs text-fg-subtle">{report.date} · automático</span>
        </Link>
      ) : null}
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
  const report = reportPrefs(useQuery(settingsQuery(m)).data)
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

  const [historyOpen, setHistoryOpen] = useState(false)
  const composer = useRef<ComposerHandle>(null)
  const end = useRef<HTMLDivElement>(null)

  // La pregunta que llega del buscador ⌘K («Preguntar a Muninn»): se envía una vez y sale de la URL. El borrador vive
  // en el Composer: aquí solo se le pide que la ponga (sin modelo aún) o que se vacíe.
  const asked = useRef<string | null>(null)
  useEffect(() => {
    if (!q || asked.current === q) return
    if (!ready) {
      composer.current?.prefill(q)
      return
    }
    asked.current = q
    chat.startNew()
    void chat.send(q)
    composer.current?.clear()
    void navigate({ search: {}, replace: true })
  }, [q, ready, chat.send, chat.startNew, navigate])

  const turns = chat.current?.turns ?? []
  const lastText = turns.at(-1)?.text
  // biome-ignore lint/correctness/useExhaustiveDependencies: baja con cada trozo nuevo de la respuesta
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [turns.length, lastText])

  // Estable para que `Reply` (memo) no se repinte con cada trozo de otra respuesta.
  const currentId = chat.current?.id ?? null
  const { send, undo } = chat
  const onUndo = useCallback(
    (turnId: string) => {
      if (currentId) void undo(currentId, turnId)
    },
    [currentId, undo],
  )
  const onSend = useCallback((text: string, images: string[]) => void send(text, images), [send])

  const startNew = () => {
    chat.startNew()
    setHistoryOpen(false)
    composer.current?.focus()
  }

  const list = (
    <ConversationList
      report={
        report.lastNoteId && report.lastDate
          ? { noteId: report.lastNoteId, date: report.lastDate }
          : null
      }
      conversations={chat.conversations}
      currentId={currentId}
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
    <Page>
      <div className="flex flex-1 gap-6">
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

          {/* La conversación va en una columna de lectura (~75 caracteres por línea), como en los chats. */}
          <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col gap-5">
            {turns.length ? (
              <div className="flex flex-col gap-7" aria-live="polite" aria-busy={chat.running}>
                {turns.map((t, i) =>
                  t.role === 'user' ? (
                    <UserBubble key={t.id} text={t.text} images={t.images} />
                  ) : (
                    <Reply
                      key={t.id}
                      turn={t}
                      running={chat.running && i === turns.length - 1}
                      canUndo={chat.canUndo(t.id)}
                      onUndo={onUndo}
                    />
                  ),
                )}
              </div>
            ) : ready ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
                <Logo className="size-14 drop-shadow-[0_8px_24px_var(--mn-color-accent-soft)]" />
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-2xl font-semibold tracking-tight">¿En qué te ayudo?</h2>
                  <p className="max-w-md text-[15px] text-fg-muted text-pretty">
                    Consulto y cambio tus proyectos, tareas, notas y finanzas: crear, mover,
                    completar y archivar. Nunca borro nada.
                  </p>
                </div>
                <div className="mt-2 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {suggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => composer.current?.submit(sug)}
                      className="cursor-pointer rounded-lg border border-border bg-surface px-3.5 py-3 text-left text-sm text-fg-muted transition-[background-color,color,border-color,scale] duration-150 ease-out hover:border-border-strong hover:bg-surface-hover hover:text-fg active:scale-[0.98]"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={end} />

            <Composer
              ref={composer}
              ready={ready}
              running={chat.running}
              provider={provider}
              noVisionMessage={
                demo
                  ? 'La demo no ve imágenes: no hay modelo detrás.'
                  : `«${prefs.model}» no ve imágenes. Elige un modelo con visión (gemma3, qwen2.5vl, llama3.2-vision) en Ajustes › Asistente e IA.`
              }
              onSend={onSend}
              onStop={chat.stop}
            />
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
