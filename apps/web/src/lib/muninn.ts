import type { Muninn } from '@muninn/core'
import { useLoaderData, useRouteContext } from '@tanstack/react-router'
import { connectAppearance } from './appearance'
import type { AuthState } from './auth'
import { loadSupabase } from './auth'

let instance: { key: string; muninn: Promise<Muninn> } | undefined

async function create(auth: Exclude<AuthState, { kind: 'anonymous' }>): Promise<Muninn> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (auth.kind === 'demo') {
    const { createMemoryStore, createMuninn } = await import('@muninn/core')
    connectAppearance(null)
    return createMuninn(createMemoryStore(), { timeZone })
  }
  const [{ createMuninn }, { createSupabaseStore }, client] = await Promise.all([
    import('@muninn/core'),
    import('@muninn/core/supabase'),
    loadSupabase(),
  ])
  const m = createMuninn(createSupabaseStore(client, auth.account.id), { timeZone })
  // La apariencia de la cuenta manda sobre la caché local; si falla la red, seguimos con la caché.
  const settings = await m.settings.get().catch(() => null)
  connectAppearance(
    (appearance) => m.settings.update({ preferences: { appearance: { ...appearance } } }),
    settings?.preferences.appearance,
  )
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
    const muninn = create(auth)
    instance = { key, muninn }
    // Si falla (red, chunk), el siguiente intento vuelve a empezar.
    muninn.catch(() => {
      if (instance?.muninn === muninn) instance = undefined
    })
  }
  return instance.muninn
}

/** Olvida la instancia actual (al cerrar sesión o salir de la demo). */
export function resetMuninn() {
  instance = undefined
}

/** Acceso a la API de dominio desde cualquier componente. Toda lectura y escritura pasa por aquí. */
export const useMuninn = (): Muninn => useLoaderData({ from: '/_app' })

/** Quién está usando la app (o el modo demo), desde el contexto de la ruta raíz. */
export const useAuth = () =>
  useRouteContext({ from: '__root__', select: (c) => c.auth }) as Exclude<
    AuthState,
    { kind: 'anonymous' }
  >
