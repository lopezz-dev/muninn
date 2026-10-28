import type { Muninn } from '@muninn/core'
import { useLoaderData, useRouteContext } from '@tanstack/react-router'
import { connectAppearance } from './appearance'
import type { AuthState } from './auth'
import { loadSupabase } from './auth'
import { keys } from './queries'
import { queryClient } from './query-client'

let instance: { key: string; muninn: Promise<Muninn> } | undefined

/** Lo que hay que parar al cambiar de usuario: la caché sin conexión y el canal de tiempo real. */
let teardown: (() => void)[] = []

function stopBackground() {
  for (const stop of teardown) stop()
  teardown = []
}

async function create(auth: Exclude<AuthState, { kind: 'anonymous' }>): Promise<Muninn> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (auth.kind === 'demo') {
    const { createMemoryStore, createMuninn } = await import('@muninn/core')
    connectAppearance(null)
    const demo = createMuninn(createMemoryStore(), { timeZone })
    queryClient.setQueryData(keys.settings, await demo.settings.get())
    return demo
  }
  const [{ createMuninn }, { createSupabaseStore }, client, offline, sync] = await Promise.all([
    import('@muninn/core'),
    import('@muninn/core/supabase'),
    loadSupabase(),
    import('./offline'),
    import('./sync'),
  ])
  const m = createMuninn(createSupabaseStore(client, auth.account.id), { timeZone })
  // Lo último que vio este usuario, antes del primer pintado (ADR-0029); lo nuevo llega por detrás.
  teardown.push(await offline.enableOfflineCache(queryClient, auth.account.id))
  // La apariencia de la cuenta manda sobre la caché local; si falla la red, seguimos con la caché.
  const settings = await m.settings.get().catch(() => null)
  // Los módulos activos mandan en el menú desde el primer pintado: sin esto, parpadearía.
  if (settings) queryClient.setQueryData(keys.settings, settings)
  connectAppearance(
    (appearance) => m.settings.update({ preferences: { appearance: { ...appearance } } }),
    settings?.preferences.appearance,
  )
  // Cambios de otros dispositivos al momento.
  teardown.push(sync.startSync(client, auth.account.id, queryClient))
  return m
}

/**
 * Instancia del servicio para la UI, cargada en diferido: `@muninn/core` arrastra zod, que es de lo
 * más pesado del bundle. La pide el loader de la ruta `/_app` en paralelo con el chunk de la pantalla.
 * Con sesión, sobre Supabase con RLS (`createSupabaseStore(supabase, user.id)`); en modo demo, en
 * memoria (se pierde al recargar). Cambiar de usuario crea una instancia nueva.
 */
export function loadMuninn(auth: Exclude<AuthState, { kind: 'anonymous' }>): Promise<Muninn> {
  const key = auth.kind === 'user' ? auth.account.id : 'demo'
  if (instance?.key !== key) {
    stopBackground()
    const muninn = create(auth)
    instance = { key, muninn }
    // Si falla (red, chunk), el siguiente intento vuelve a empezar.
    muninn.catch(() => {
      if (instance?.muninn === muninn) instance = undefined
    })
  }
  return instance.muninn
}

/** La instancia ya creada, sin crear otra (para limpiar al cerrar sesión). */
export const currentMuninn = () => instance?.muninn

/** Olvida la instancia actual (al cerrar sesión o salir de la demo). */
export function resetMuninn() {
  instance = undefined
  stopBackground()
}

/** Acceso a la API de dominio desde cualquier componente. Toda lectura y escritura pasa por aquí. */
export const useMuninn = (): Muninn => useLoaderData({ from: '/_app' })

/** Quién está usando la app (o el modo demo), desde el contexto de la ruta raíz. */
export const useAuth = () =>
  useRouteContext({ from: '__root__', select: (c) => c.auth }) as Exclude<
    AuthState,
    { kind: 'anonymous' }
  >
