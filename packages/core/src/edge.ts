/**
 * Lo que necesitan las Edge Functions (`github`, `news` y `push`, en supabase/functions), empaquetado en un solo fichero
 * con `pnpm --filter @muninn/core build:edge` (zod y fractional-indexing van dentro; supabase-js no,
 * porque aquí solo se usa su tipo y la función lo importa de npm).
 */

export * from './github-sync'
export { TEST_ALERT } from './push'
export { createMuninn } from './service'
export {
  createSupabaseStore,
  listNewsOwners,
  listPushOwners,
  pruneNews,
  prunePushLog,
} from './supabase-store'
