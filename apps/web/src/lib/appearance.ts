import {
  ACCENTS,
  type AccentName,
  type Appearance,
  applyAppearance,
  DEFAULT_APPEARANCE,
  notify,
  prefersReducedTransparency,
} from '@muninn/ui'
import { useSyncExternalStore } from 'react'
import { notifyUndo } from './feedback'

/**
 * Apariencia (cristal y acento). Con sesión, la fuente es `user_settings.preferences.appearance`
 * (te sigue a todos tus dispositivos) y localStorage es la caché para el primer render, sin parpadeo.
 * En modo demo solo existe la copia local.
 */
export const APPEARANCE_KEY = 'muninn.appearance'

/** Lo mínimo de `Storage` que usamos (inyectable en tests). */
export type AppearanceStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Por defecto, cristal encendido salvo que el sistema pida reducir transparencias. */
export const defaultAppearance = (): Appearance => ({
  ...DEFAULT_APPEARANCE,
  glass: !prefersReducedTransparency(),
})

/** Valida campo a campo lo que venga (localStorage, la cuenta); lo que no encaje, del `fallback`. */
export function toAppearance(value: unknown, fallback: Appearance): Appearance {
  if (!value || typeof value !== 'object') return fallback
  const data = value as Partial<Record<keyof Appearance, unknown>>
  return {
    glass: typeof data.glass === 'boolean' ? data.glass : fallback.glass,
    accent:
      typeof data.accent === 'string' && data.accent in ACCENTS
        ? (data.accent as AccentName)
        : fallback.accent,
  }
}

/** Lee lo guardado; ignora valores corruptos o de versiones antiguas campo a campo. */
export function parseAppearance(raw: string | null, fallback: Appearance): Appearance {
  if (!raw) return fallback
  try {
    return toAppearance(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}

/** localStorage puede no existir o lanzar (modo privado, almacenamiento bloqueado). */
function safeStorage(): AppearanceStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function createAppearanceStore(storage: AppearanceStorage | null = safeStorage()) {
  const read = () => {
    try {
      return parseAppearance(storage?.getItem(APPEARANCE_KEY) ?? null, defaultAppearance())
    } catch {
      return defaultAppearance()
    }
  }
  let current = read()
  const listeners = new Set<() => void>()
  const emit = () => {
    for (const l of listeners) l()
  }

  return {
    get: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Aplica al documento, guarda y avisa a los suscriptores. Devuelve la apariencia anterior. */
    set(next: Appearance | ((prev: Appearance) => Appearance)) {
      const prev = current
      current = typeof next === 'function' ? next(prev) : next
      applyAppearance(current)
      try {
        storage?.setItem(APPEARANCE_KEY, JSON.stringify(current))
      } catch {
        // Sin almacenamiento la preferencia dura hasta recargar; no es un error para el usuario.
      }
      emit()
      return prev
    },
    /** Otra pestaña cambió la apariencia: la seguimos sin volver a guardar. */
    reload() {
      current = read()
      applyAppearance(current)
      emit()
    },
  }
}

export const appearanceStore = createAppearanceStore()

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === APPEARANCE_KEY) appearanceStore.reload()
  })
}

const same = (a: Appearance, b: Appearance) => a.glass === b.glass && a.accent === b.accent

/** Guarda en la cuenta. */
export type AppearanceRemote = (appearance: Appearance) => Promise<unknown>
let remote: AppearanceRemote | null = null

/**
 * Conecta la apariencia con la cuenta al iniciar sesión (`null` en modo demo). Si la cuenta tiene
 * una guardada, gana y actualiza la caché local; si no, se sube la de este dispositivo.
 */
export function connectAppearance(
  save: AppearanceRemote | null,
  saved?: unknown,
  store = appearanceStore,
) {
  remote = save
  if (!save) return
  const local = store.get()
  if (saved && typeof saved === 'object') {
    const next = toAppearance(saved, local)
    if (!same(next, local)) store.set(next)
  } else {
    save(local).catch(() => {})
  }
}

/** Guarda en la cuenta (si hay); si falla, avisa y se queda en este dispositivo. */
export function saveAppearanceRemote(appearance: Appearance) {
  remote?.(appearance).catch(() => {
    notify.error('No se pudo guardar en tu cuenta', {
      description: 'El cambio se queda en este dispositivo',
    })
  })
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(appearanceStore.subscribe, appearanceStore.get)
}

export const ACCENT_LABEL: Record<AccentName, string> = {
  amber: 'Ámbar',
  blue: 'Azul',
  violet: 'Violeta',
  teal: 'Verde azulado',
  pink: 'Rosa',
}

/** Cambia la apariencia con feedback y «Deshacer» (ADR-0019). */
export function changeAppearance(patch: Partial<Appearance>) {
  const prev = appearanceStore.set((a) => ({ ...a, ...patch }))
  const now = appearanceStore.get()
  saveAppearanceRemote(now)
  const isGlass = patch.glass !== undefined
  notifyUndo(
    isGlass
      ? `Cristal ${now.glass ? 'activado' : 'desactivado'}`
      : `Acento ${ACCENT_LABEL[now.accent].toLowerCase()}`,
    {
      icon: isGlass ? 'glass' : 'palette',
      description: remote ? 'Guardado en tu cuenta' : 'Guardado en este dispositivo',
      // Local al instante; si la cuenta falla, avisa `saveAppearanceRemote`.
      undo: () => {
        appearanceStore.set(prev)
        saveAppearanceRemote(prev)
      },
      undone: ['Apariencia restaurada', { icon: isGlass ? 'glass' : 'palette' }],
    },
  )
}
