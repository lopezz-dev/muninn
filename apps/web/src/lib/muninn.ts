import { createMemoryStore, createMuninn } from '@muninn/core'
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Cliente de Supabase con la sesión del usuario (RLS). `null` en modo demo sin backend. */
export const supabase = url && key ? createClient(url, key) : null

export const backendLabel = supabase ? 'Supabase' : 'memoria (modo demo)'

/**
 * Instancia del servicio para la UI. Hasta que haya login, en modo demo usa memoria;
 * con sesión se creará con `createSupabaseStore(supabase, user.id)`.
 */
export const demoMuninn = createMuninn(createMemoryStore())
