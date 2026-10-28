import { notify } from '@muninn/ui'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { connectAppearance } from './appearance'
import { leaveDemo, signOut } from './auth'
import { currentMuninn, resetMuninn } from './muninn'
import { queryClient } from './query-client'

/** Olvida todo lo del usuario anterior (instancia del core, caché de react-query y su apariencia). */
export function forgetUserData() {
  resetMuninn()
  queryClient.clear()
  connectAppearance(null)
  // Lo guardado para leer sin conexión es privado: se borra del dispositivo (ADR-0029).
  void import('./offline').then((o) => o.clearOfflineCache())
  // Y el historial del asistente, que también vive en este dispositivo (ADR-0041).
  void import('./assistant-history').then((h) => h.clearHistory())
}

/**
 * Cierra la sesión (o sale de la demo) con feedback. No lleva «Deshacer»: no cambia ni borra datos y
 * volver a entrar es iniciar sesión. Devuelve si se pudo; quien llama navega a /login.
 */
export async function endSession(kind: 'user' | 'demo'): Promise<boolean> {
  try {
    if (kind === 'user') {
      // Con la sesión aún abierta (RLS): este dispositivo deja de recibir los avisos de la cuenta (ADR-0040).
      const m = await currentMuninn()?.catch(() => undefined)
      await import('./push').then((p) => p.leaveThisDevice(m)).catch(() => undefined)
      await signOut()
    } else leaveDemo()
  } catch (err) {
    notify.error('No se pudo cerrar la sesión', {
      description: err instanceof Error ? err.message : undefined,
    })
    return false
  }
  forgetUserData()
  notify.success(kind === 'user' ? 'Sesión cerrada' : 'Has salido del modo demo', {
    icon: 'user',
    description: kind === 'user' ? 'Tus datos siguen guardados en tu cuenta' : undefined,
  })
  return true
}

/** Cierra la sesión (o sale de la demo) y lleva a /login. */
export function useEndSession() {
  const navigate = useNavigate()
  return useCallback(
    async (kind: 'user' | 'demo') => {
      if (await endSession(kind)) await navigate({ to: '/login', replace: true })
    },
    [navigate],
  )
}
