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

/**
 * Apariencia (cristal y acento) guardada en este dispositivo. Vive en localStorage hasta que exista
 * `user_settings.preferences` en Supabase; entonces esta capa leerá y escribirá allí.
 */
export const APPEARANCE_KEY = 'muninn.appearance'

/** Lo mínimo de `Storage` que usamos (inyectable en tests). */
export type AppearanceStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Por defecto, cristal encendido salvo que el sistema pida reducir transparencias. */
export const defaultAppearance = (): Appearance => ({
  ...DEFAULT_APPEARANCE,
  glass: !prefersReducedTransparency(),
})

/** Lee lo guardado; ignora valores corruptos o de versiones antiguas campo a campo. */
export function parseAppearance(raw: string | null, fallback: Appearance): Appearance {
  if (!raw) return fallback
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof Appearance, unknown>>
    return {
      glass: typeof data.glass === 'boolean' ? data.glass : fallback.glass,
      accent:
        typeof data.accent === 'string' && data.accent in ACCENTS
          ? (data.accent as AccentName)
          : fallback.accent,
    }
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
  const isGlass = patch.glass !== undefined
  notify.success(
    isGlass
      ? `Cristal ${now.glass ? 'activado' : 'desactivado'}`
      : `Acento ${ACCENT_LABEL[now.accent].toLowerCase()}`,
    {
      icon: isGlass ? 'glass' : 'palette',
      description: 'Guardado en este dispositivo',
      action: {
        label: 'Deshacer',
        onClick: () => {
          appearanceStore.set(prev)
          notify.info('Apariencia restaurada', { icon: isGlass ? 'glass' : 'palette' })
        },
      },
    },
  )
}
