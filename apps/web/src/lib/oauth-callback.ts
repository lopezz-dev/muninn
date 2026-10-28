/**
 * Vuelta del OAuth de GitHub en escritorio (ADR-0059). En Tauri, la redirección no puede volver a la
 * propia app por HTTP: GitHub → Supabase → `muninn://auth/callback?code=…`, y el sistema se lo pasa a la
 * ventana abierta (deep link). Aquí va solo lo que no toca Supabase, para poder probarlo.
 */

/** Esquema propio registrado por el instalador (`plugins.deep-link` en `tauri.conf.json`). */
export const DESKTOP_REDIRECT = 'muninn://auth/callback'

/** Cuánto se espera a que vuelvas de GitHub antes de darlo por abandonado. */
export const DESKTOP_TIMEOUT_MS = 5 * 60_000

/** Qué se pasa a `signInWithOAuth` según dónde corre la app. */
export function oauthOptions(tauri: boolean, webRedirect: string) {
  // En escritorio no se navega: la URL de GitHub se abre en el navegador del sistema.
  return tauri
    ? { redirectTo: DESKTOP_REDIRECT, skipBrowserRedirect: true }
    : { redirectTo: webRedirect }
}

/**
 * Solo PKCE: el código se canjea con el verificador que guardó esta app, así que un código ajeno no sirve.
 * Los tokens en el fragmento (flujo implícito) no se aceptan: cualquier página podría abrir
 * `muninn://auth/callback#access_token=…` y meterte en la cuenta de otro.
 */
export type AuthCallback =
  | { kind: 'code'; code: string }
  /** `cancelled`: dijiste que no en GitHub (`access_denied`). */
  | { kind: 'error'; cancelled: boolean; message: string }

/** Interpreta `muninn://auth/callback…`. Devuelve `null` si el enlace no es la vuelta del login. */
export function parseAuthCallback(raw: string): AuthCallback | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  // `muninn://auth/callback`: el host es `auth` y la ruta `/callback`.
  if (
    url.protocol !== 'muninn:' ||
    url.host !== 'auth' ||
    url.pathname.replace(/\/$/, '') !== '/callback'
  )
    return null
  // Supabase manda los errores en la query o en el fragmento según el paso que falle: se miran los dos.
  const query = url.searchParams
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const get = (k: string) => query.get(k) ?? hash.get(k)

  const error = get('error')
  if (error) {
    const code = get('error_code') ?? error
    return {
      kind: 'error',
      cancelled: error === 'access_denied' || code === 'access_denied',
      message: get('error_description') ?? error,
    }
  }
  const code = query.get('code')
  if (code) return { kind: 'code', code }
  return { kind: 'error', cancelled: false, message: 'GitHub no ha devuelto ningún código.' }
}

/** Marca de «hay un login con GitHub en marcha en esta app». Sin ella, un enlace de vuelta se ignora. */
const PENDING_KEY = 'muninn.oauth.desktop'
/** Cuánto vale la marca: la espera y un margen por si la app se cerró a medias. */
const PENDING_TTL_MS = 2 * DESKTOP_TIMEOUT_MS

type FlagStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function markPendingFlow(storage: FlagStorage, now = Date.now()) {
  storage.setItem(PENDING_KEY, String(now))
}

export function clearPendingFlow(storage: FlagStorage) {
  storage.removeItem(PENDING_KEY)
}

/** Hay un login empezado aquí y aún no ha caducado. */
export function hasPendingFlow(storage: FlagStorage, now = Date.now()) {
  const started = Number(storage.getItem(PENDING_KEY))
  return Number.isFinite(started) && started > 0 && now - started < PENDING_TTL_MS
}

/** Cómo llegan los deep links. Se inyecta en los tests. */
export interface DeepLinkDeps {
  /** `onOpenUrl` de @tauri-apps/plugin-deep-link: devuelve con qué dejar de escuchar. */
  onOpenUrl(handler: (urls: string[]) => void): Promise<() => void>
  timeoutMs?: number
}

/** El login no terminó: lo cancelaste aquí, dijiste que no en GitHub o pasó el tiempo. */
export class OAuthAbortedError extends Error {
  constructor(readonly reason: 'cancelled' | 'denied' | 'timeout') {
    super(
      reason === 'timeout'
        ? 'Se ha agotado el tiempo de espera.'
        : reason === 'denied'
          ? 'No has dado permiso en GitHub.'
          : 'Cancelado.',
    )
    this.name = 'OAuthAbortedError'
  }
}

/**
 * Espera la vuelta de GitHub. Se empieza a escuchar **antes** de abrir el navegador (`ready`), para no
 * perder un enlace que llegue rápido. Se puede cancelar con `signal`; a los cinco minutos se rinde.
 */
export function waitForAuthCallback(
  deps: DeepLinkDeps,
  signal?: AbortSignal,
): { ready: Promise<void>; result: Promise<AuthCallback> } {
  let stop: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let markReady!: () => void
  let failReady!: (err: unknown) => void
  const ready = new Promise<void>((res, rej) => {
    markReady = res
    failReady = rej
  })
  const result = new Promise<AuthCallback>((resolve, reject) => {
    let done = false
    const finish = (fn: () => void) => {
      if (done) return
      done = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      stop?.()
      fn()
    }
    const onAbort = () => finish(() => reject(new OAuthAbortedError('cancelled')))
    if (signal?.aborted) {
      onAbort()
      markReady()
      return
    }
    signal?.addEventListener('abort', onAbort)
    timer = setTimeout(
      () => finish(() => reject(new OAuthAbortedError('timeout'))),
      deps.timeoutMs ?? DESKTOP_TIMEOUT_MS,
    )
    deps
      .onOpenUrl((urls) => {
        for (const u of urls) {
          const parsed = parseAuthCallback(u)
          if (parsed) return finish(() => resolve(parsed))
        }
      })
      .then((unlisten) => {
        // Si se canceló mientras se registraba la escucha, se suelta ya.
        if (done) unlisten()
        else stop = unlisten
        markReady()
      })
      .catch((err) => {
        finish(() => reject(err))
        failReady(err)
      })
  })
  // Si nadie espera `ready` y falla, que no quede como rechazo sin capturar: el error ya viaja en `result`.
  ready.catch(() => {})
  return { ready, result }
}
