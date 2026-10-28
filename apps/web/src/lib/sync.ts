import type { SupabaseClient } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import { isBusy } from './mutations'

/**
 * Sincronización en tiempo real entre dispositivos (ADR-0029). Un canal de Supabase Realtime escucha las
 * tablas publicadas (`supabase_realtime`; RLS ya filtra por dueño) y, por cada cambio, **invalida** la parte
 * de la caché de react-query a la que afecta: la pantalla vuelve a pedir lo suyo y se pone al día.
 *
 * Los eventos de los cambios propios también llegan. No pisan lo optimista porque nunca se refresca lo
 * que tiene escrituras en cola (ADR-0025): se espera a que se vacíe y entonces se vuelve a pedir, que
 * devuelve lo mismo que ya se ve.
 */

export type Table =
  | 'projects'
  | 'board_columns'
  | 'tasks'
  | 'task_checklist_items'
  | 'notes'
  | 'user_settings'
  | 'finance_accounts'
  | 'finance_categories'
  | 'finance_transactions'
  | 'finance_subscriptions'
  | 'news_sources'
  | 'news_items'
  | 'news_digests'

export const SYNC_TABLES: Table[] = [
  'projects',
  'board_columns',
  'tasks',
  'task_checklist_items',
  'notes',
  'user_settings',
  'finance_accounts',
  'finance_categories',
  'finance_transactions',
  'finance_subscriptions',
  'news_sources',
  'news_items',
  'news_digests',
]

export interface Change {
  table: Table
  /** Fila nueva (insert/update); vacía en un borrado. */
  row: Record<string, unknown>
  /** Fila anterior en `update` y `delete` (con la identidad de réplica por defecto, solo la clave). */
  old?: Record<string, unknown>
}

/**
 * Qué refrescar, como etiquetas:
 * `projects` · `project:<id>` (sus datos y su tablero) · `boards` (todos) · `task:<id>` · `notes` · `note:<id>` · `settings` · `finance`.
 */
export type Scope = string

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

export function scopesOf({ table, row, old }: Change): Scope[] {
  const id = str(row.id) ?? str(old?.id)
  switch (table) {
    case 'projects':
      return id ? ['projects', `project:${id}`] : ['projects']
    case 'board_columns': {
      // Un borrado solo trae la clave: no sabemos de qué proyecto era.
      const p = str(row.project_id) ?? str(old?.project_id)
      return [p ? `project:${p}` : 'boards']
    }
    case 'tasks': {
      const p = str(row.project_id) ?? str(old?.project_id)
      const out: Scope[] = [p ? `project:${p}` : 'boards']
      if (id) out.push(`task:${id}`)
      return out
    }
    case 'task_checklist_items': {
      // El progreso de las subtareas vive en los datos del tablero, y de aquí no se sabe el proyecto.
      const t = str(row.task_id) ?? str(old?.task_id)
      return t ? ['boards', `task:${t}`] : ['boards']
    }
    case 'notes':
      return id ? ['notes', `note:${id}`] : ['notes']
    case 'user_settings':
      return ['settings']
    // Saldos, listas y resumen dependen unos de otros: Finanzas se refresca entera (es poco).
    case 'finance_accounts':
    case 'finance_categories':
    case 'finance_transactions':
    case 'finance_subscriptions':
      return ['finance']
    // Fuentes, artículos (los trae el cron) y el resumen: Noticias se refresca entera.
    case 'news_sources':
    case 'news_items':
    case 'news_digests':
      return ['news']
  }
}

/** La clave de la cola de escrituras (`mutations.ts`) que protege ese refresco, si la hay. */
const busyKey = (scope: Scope): string | undefined =>
  scope.startsWith('project:')
    ? scope.slice('project:'.length)
    : scope === 'settings' || scope === 'finance' || scope === 'news'
      ? scope
      : scope.startsWith('note:')
        ? scope
        : undefined

export interface SyncOptions {
  debounceMs?: number
  /** Para los tests. */
  busy?: (key?: string) => boolean
}

export interface Sync {
  handle: (change: Change) => void
  /** Refrescarlo todo (tras reconectar: se pudieron perder eventos). */
  all: () => void
  dispose: () => void
}

/** Agrupa los cambios que llegan seguidos y los aplica sobre la caché cuando ya no hay nada propio en vuelo. */
export function createSync(qc: QueryClient, opts: SyncOptions = {}): Sync {
  const wait = opts.debounceMs ?? 400
  const busy = opts.busy ?? isBusy
  const pending = new Set<Scope>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let everything = false
  let disposed = false

  const refresh = (scope: Scope) => {
    if (scope === 'projects') {
      void qc.invalidateQueries({ queryKey: ['projects'], exact: true })
      void qc.invalidateQueries({ queryKey: ['overview'] })
    } else if (scope === 'boards') {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      void qc.invalidateQueries({ queryKey: ['overview'] })
      void qc.invalidateQueries({ queryKey: ['checklist-counts'] })
    } else if (scope.startsWith('project:')) {
      void qc.invalidateQueries({ queryKey: ['projects', scope.slice('project:'.length)] })
      void qc.invalidateQueries({ queryKey: ['projects'], exact: true })
      void qc.invalidateQueries({ queryKey: ['overview'] })
    } else if (scope.startsWith('task:')) {
      void qc.invalidateQueries({ queryKey: ['tasks', scope.slice('task:'.length)] })
    } else if (scope === 'notes' || scope.startsWith('note:')) {
      void qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'notes' || (q.queryKey[0] === 'tasks' && q.queryKey[2] === 'notes'),
      })
    } else if (scope === 'settings') {
      void qc.invalidateQueries({ queryKey: ['settings'] })
    } else if (scope === 'finance') {
      void qc.invalidateQueries({ queryKey: ['finance'] })
    } else if (scope === 'news') {
      void qc.invalidateQueries({ queryKey: ['news'] })
    }
  }

  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(flush, wait)
  }

  function flush() {
    timer = undefined
    if (disposed) return
    if (everything) {
      // Todo a la vez, y solo cuando no haya ninguna escritura propia en vuelo.
      if (busy()) return arm()
      everything = false
      pending.clear()
      void qc.invalidateQueries()
      return
    }
    let deferred = false
    for (const scope of [...pending]) {
      const key = busyKey(scope)
      if (key !== undefined && busy(key)) {
        deferred = true
        continue
      }
      pending.delete(scope)
      refresh(scope)
    }
    if (deferred) arm()
  }

  return {
    handle(change) {
      for (const s of scopesOf(change)) pending.add(s)
      arm()
    },
    all() {
      everything = true
      arm()
    },
    dispose() {
      disposed = true
      clearTimeout(timer)
      pending.clear()
    },
  }
}

/** Abre el canal de Realtime de este usuario. Devuelve cómo cerrarlo. */
export function startSync(client: SupabaseClient, ownerId: string, qc: QueryClient): () => void {
  const sync = createSync(qc)
  let channel = client.channel(`muninn:${ownerId}`)
  for (const table of SYNC_TABLES) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      sync.handle({
        table,
        row: (payload.new ?? {}) as Record<string, unknown>,
        old: (payload.old ?? {}) as Record<string, unknown>,
      })
    })
  }
  let wasConnected = false
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      // Al volver a conectar se pueden haber perdido eventos: se repone todo.
      if (wasConnected) sync.all()
      wasConnected = true
    }
  })
  return () => {
    sync.dispose()
    void client.removeChannel(channel)
  }
}
