/**
 * Lo que necesita la Edge Function `github` (supabase/functions/github), empaquetado en un solo fichero
 * con `pnpm --filter @muninn/core build:edge` (zod y fractional-indexing van dentro; supabase-js no,
 * porque aquí solo se usa su tipo y la función lo importa de npm).
 */

export * from './github-sync'
export { createMuninn } from './service'
export { createSupabaseStore, listNewsOwners, pruneNews } from './supabase-store'
