/**
 * Lo que necesitan las Edge Functions (`fx`, `github`, `news`, `push` y `security`, en supabase/functions), empaquetado en un solo fichero
 * con `pnpm --filter @muninn/core build:edge` (zod y fractional-indexing van dentro; supabase-js no,
 * porque aquí solo se usa su tipo y la función lo importa de npm).
 */

export { ECB_URLS, FX_HISTORY_FROM, parseEcbRates, planEcbFetch } from './fx'
export * from './github-sync'
export { runLoginAlerts } from './login-alerts'
export { TEST_ALERT } from './push'
export { createMuninn } from './service'
export {
  createSupabaseStore,
  latestFxDate,
  listKnownDevices,
  listNewsOwners,
  listPendingLogins,
  listPushOwners,
  pruneLoginAlertLog,
  pruneNews,
  prunePushLog,
  recordLogins,
  upsertFxRates,
} from './supabase-store'
