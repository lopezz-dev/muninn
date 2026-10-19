import type { Muninn } from '@muninn/core'
import { useLoaderData } from '@tanstack/react-router'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Hay credenciales de Supabase en el entorno (aún no se usan: falta el login). */
export const hasSupabase = Boolean(url && key)

/**
 * Cliente de Supabase con la sesión del usuario (RLS). Se carga bajo demanda: supabase-js pesa
 * bastante y no debe ir en el bundle inicial mientras no haya login.
 */
export async function loadSupabase() {
  if (!url || !key) return null
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key)
}

export const backendLabel = 'memoria (modo demo)'

let instance: Promise<Muninn> | undefined

/**
 * Instancia del servicio para la UI, cargada en diferido: `@muninn/core` arrastra zod, que es de lo
 * más pesado del bundle. El loader de la ruta raíz la pide en paralelo con el chunk de la pantalla.
 * Hasta que haya login usa memoria (se pierde al recargar); con sesión se creará con
 * `createSupabaseStore(supabase, user.id)`.
 */
export function loadMuninn(): Promise<Muninn> {
  instance ??= import('@muninn/core').then(({ createMemoryStore, createMuninn }) =>
    createMuninn(createMemoryStore()),
  )
  return instance
}

/** Acceso a la API de dominio desde cualquier componente. Toda lectura y escritura pasa por aquí. */
export const useMuninn = (): Muninn => useLoaderData({ from: '__root__' })
