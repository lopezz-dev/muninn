import {
  type Change,
  type ChatMessage,
  type ChatProvider,
  runAssistant,
  type ToolRun,
  toolsFor,
} from '@muninn/assistant'
import type { ModuleName, Muninn } from '@muninn/core'
import { notify } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Conversation,
  loadHistory,
  saveHistory,
  type Turn,
  titleFrom,
  upsertConversation,
} from './assistant-history'
import { reason } from './mutations'

/** Turnos anteriores que se le mandan al modelo (solo texto): con 16k de contexto, los últimos bastan. */
export const HISTORY_TURNS = 10

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

/** El historial para el modelo: preguntas y respuestas, sin herramientas ni turnos con error. */
export function historyFor(turns: Turn[]): ChatMessage[] {
  return turns
    .filter((t) => t.text.trim() && !t.error)
    .slice(-HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: t.text }))
}

/** Aplica un evento del bucle al turno que se está escribiendo. */
export function applyRun(tools: ToolRun[] | undefined, run: ToolRun): ToolRun[] {
  const list = tools ?? []
  return list.some((t) => t.id === run.id)
    ? list.map((t) => (t.id === run.id ? run : t))
    : [...list, run]
}

interface Options {
  app: Muninn
  provider: ChatProvider | null
  /** Clave del historial en este dispositivo (id de usuario o `demo`). */
  userKey: string
  modules: ReadonlySet<ModuleName> | null
}

/**
 * Estado de la pantalla Asistente: conversaciones del dispositivo, el turno en curso en streaming y «Deshacer» de lo
 * que cambió (ADR-0041, ADR-0019). Las inversas viven en memoria: tras recargar, los cambios se ven pero no se deshacen
 * desde aquí (siguen en la actividad).
 */
export function useAssistantChat({ app, provider, userKey, modules }: Options) {
  const qc = useQueryClient()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const undos = useRef(new Map<string, Change[]>())
  const loaded = useRef(false)

  useEffect(() => {
    let alive = true
    void loadHistory(userKey).then((list) => {
      if (!alive) return
      loaded.current = true
      setConversations((cur) => (cur.length ? cur : list))
    })
    return () => {
      alive = false
    }
  }, [userKey])

  const current = conversations.find((c) => c.id === currentId) ?? null

  const update = useCallback(
    (id: string, fn: (c: Conversation) => Conversation, persist = false) => {
      setConversations((list) => {
        const c = list.find((x) => x.id === id)
        if (!c) return list
        const next = upsertConversation(list, fn(c))
        if (persist) void saveHistory(userKey, next)
        return next
      })
    },
    [userKey],
  )

  const patchTurn = useCallback(
    (convId: string, turnId: string, fn: (t: Turn) => Turn, persist = false) =>
      update(
        convId,
        (c) => ({ ...c, turns: c.turns.map((t) => (t.id === turnId ? fn(t) : t)) }),
        persist,
      ),
    [update],
  )

  /** Deshace lo que cambió un turno, en orden inverso, con el core del usuario (en la actividad, `user`). */
  const undo = useCallback(
    async (convId: string, turnId: string) => {
      const list = undos.current.get(turnId)
      if (!list?.length) return
      undos.current.delete(turnId)
      try {
        for (const c of [...list].reverse()) await c.undo(app)
        patchTurn(
          convId,
          turnId,
          (t) => ({ ...t, changes: t.changes?.map((c) => ({ ...c, undone: true })) }),
          true,
        )
        void qc.invalidateQueries()
        notify.success(list.length === 1 ? 'Cambio deshecho' : 'Cambios deshechos', {
          icon: 'sync',
        })
      } catch (err) {
        undos.current.set(turnId, list)
        notify.error('No se pudo deshacer', { description: reason(err) })
      }
    },
    [app, patchTurn, qc],
  )

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || running || !provider) return
      const prior = current?.turns ?? []
      const conv: Conversation = current ?? {
        id: uid(),
        title: titleFrom(question),
        createdAt: now(),
        updatedAt: now(),
        turns: [],
      }
      const userTurn: Turn = { id: uid(), role: 'user', text: question, createdAt: now() }
      const reply: Turn = { id: uid(), role: 'assistant', text: '', createdAt: now(), tools: [] }
      setConversations((list) =>
        upsertConversation(list, { ...conv, updatedAt: now(), turns: [...prior, userTurn, reply] }),
      )
      setCurrentId(conv.id)
      setRunning(true)
      const controller = new AbortController()
      abort.current = controller
      const changes: Change[] = []
      try {
        await runAssistant([...historyFor(prior), { role: 'user', content: question }], {
          provider,
          app,
          conversationId: conv.id,
          tools: toolsFor(modules ? [...modules] : null),
          signal: controller.signal,
          onEvent: (e) => {
            if (e.type === 'text')
              patchTurn(conv.id, reply.id, (t) => ({ ...t, text: t.text + e.text }))
            else if (e.type === 'change') {
              changes.push(e.change)
              patchTurn(conv.id, reply.id, (t) => ({
                ...t,
                changes: [
                  ...(t.changes ?? []),
                  { summary: e.change.summary, target: e.change.target },
                ],
              }))
            } else patchTurn(conv.id, reply.id, (t) => ({ ...t, tools: applyRun(t.tools, e.run) }))
          },
        })
        patchTurn(conv.id, reply.id, (t) => ({ ...t, text: t.text.trim() }), true)
      } catch (err) {
        const stopped = controller.signal.aborted
        patchTurn(
          conv.id,
          reply.id,
          (t) => ({
            ...t,
            stopped: stopped || undefined,
            error: stopped ? undefined : (reason(err) ?? 'Algo ha fallado'),
          }),
          true,
        )
        if (stopped) notify.info('Respuesta detenida', { icon: 'close' })
        else notify.error('El asistente no ha podido terminar', { description: reason(err) })
      } finally {
        abort.current = null
        setRunning(false)
      }
      if (changes.length) {
        undos.current.set(reply.id, changes)
        // Puede haber tocado cualquier cosa: tablero, notas, finanzas, Inicio.
        void qc.invalidateQueries()
        notify.success(
          changes.length === 1
            ? (changes[0]?.summary ?? 'Hecho')
            : `${changes.length} cambios hechos`,
          {
            icon: 'assistant',
            action: { label: 'Deshacer', onClick: () => void undo(conv.id, reply.id) },
          },
        )
      }
    },
    [app, current, modules, patchTurn, provider, qc, running, undo],
  )

  const stop = useCallback(() => abort.current?.abort(), [])

  const startNew = useCallback(() => {
    if (running) return
    setCurrentId(null)
  }, [running])

  return {
    conversations,
    current,
    running,
    send,
    stop,
    undo,
    canUndo: (turnId: string) => undos.current.has(turnId),
    select: (id: string) => !running && setCurrentId(id),
    startNew,
  }
}
