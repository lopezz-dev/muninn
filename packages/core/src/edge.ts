/**
 * Lo que necesitan las Edge Functions (`github`, `news`, `push` y `security`, en supabase/functions), empaquetado en un solo fichero
 * con `pnpm --filter @muninn/core build:edge` (zod y fractional-indexing van dentro; supabase-js no,
 * porque aquí solo se usa su tipo y la función lo importa de npm).
 */

export * from './github-sync'
export { runLoginAlerts } from './login-alerts'
export { TEST_ALERT } from './push'
export { createMuninn } from './service'
export {
  createSupabaseStore,
  listKnownDevices,
  listNewsOwners,
  listPendingLogins,
  listPushOwners,
  pruneLoginAlertLog,
  pruneNews,
  prunePushLog,
  recordLogins,
} from './supabase-store'
