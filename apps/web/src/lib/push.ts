import type { Muninn, PushDevice } from '@muninn/core'
import { isTauri } from './auth'

/**
 * Avisos Web Push en este navegador (ADR-0040): qué admite, el permiso y la suscripción de `pushManager`. La fila del
 * dispositivo la guarda el core (`m.push`); quien envía es la Edge Function `push`.
 */

/** Clave pública VAPID (pública por diseño). Sin ella, la app no ofrece los avisos. */
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

export const keys = {
  devices: ['push-devices'] as const,
  /** La suscripción del navegador (su `endpoint`, o `null`). */
  browser: ['push-browser'] as const,
}

/**
 * Por qué se pueden (o no) activar los avisos aquí:
 * - `available`: se puede pedir el permiso (o ya está concedido).
 * - `denied`: el usuario los bloqueó; solo se arregla en los ajustes del navegador o del sistema.
 * - `ios-install`: iPhone o iPad en Safari sin instalar; Web Push solo existe en la app añadida a la pantalla de inicio.
 * - `unsupported`: el navegador no tiene Push API (o es la app de escritorio, que no la usa).
 * - `unconfigured`: falta `VITE_VAPID_PUBLIC_KEY` en este despliegue.
 */
export type PushSupport = 'available' | 'denied' | 'ios-install' | 'unsupported' | 'unconfigured'

interface Env {
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
  hasPush: boolean
  permission: NotificationPermission | null
  vapidKey: string
  tauri: boolean
}

/** iPhone, iPod o iPad (el iPad moderno dice ser un Mac, pero con pantalla táctil). */
export const isIos = (ua: string, maxTouchPoints: number) =>
  /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)

export function pushSupport(env: Env): PushSupport {
  if (env.tauri) return 'unsupported'
  // En iOS sin instalar no existe `PushManager`: antes que «no compatible», se explica cómo instalarla.
  if (isIos(env.userAgent, env.maxTouchPoints) && !env.standalone) return 'ios-install'
  if (!env.hasPush) return 'unsupported'
  if (!env.vapidKey) return 'unconfigured'
  if (env.permission === 'denied') return 'denied'
  return 'available'
}

function browserEnv(): Env {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const win = typeof window === 'undefined' ? undefined : window
  return {
    userAgent: nav?.userAgent ?? '',
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    standalone:
      Boolean(win?.matchMedia?.('(display-mode: standalone)').matches) ||
      (nav as { standalone?: boolean } | undefined)?.standalone === true,
    hasPush: Boolean(
      nav && 'serviceWorker' in nav && win && 'PushManager' in win && 'Notification' in win,
    ),
    permission: win && 'Notification' in win ? Notification.permission : null,
    vapidKey: VAPID_PUBLIC_KEY,
    tauri: isTauri,
  }
}

export const currentSupport = () => pushSupport(browserEnv())

/** «iPhone · App», «Mac · Safari»: el nombre que enseña la lista de dispositivos. */
export function deviceLabel(ua: string, maxTouchPoints = 0, standalone = false) {
  const os = /iPhone|iPod/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux|CrOS/.test(ua)
              ? 'Linux'
              : 'Dispositivo'
  if (standalone) return `${os} · App`
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\/|FxiOS/.test(ua)
      ? 'Firefox'
      : /Chrome\/|CriOS/.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Navegador'
  return `${os} · ${browser}`
}

/** La clave VAPID en base64url, como la pide `pushManager.subscribe`. */
export function vapidKeyBytes(base64url: string) {
  const padded = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/**
 * El service worker activo, si lo hay. No se espera a `ready`: en desarrollo (o si falló el registro) no llega nunca y
 * la pantalla se quedaría cargando.
 */
async function registration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

/** La suscripción de este navegador, o `null`. */
export async function browserSubscription() {
  if (currentSupport() === 'unsupported' || currentSupport() === 'ios-install') return null
  const reg = await registration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Lo que guarda el core de una `PushSubscription`. */
function toInput(sub: PushSubscription) {
  const json = sub.toJSON()
  const env = browserEnv()
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    userAgent: env.userAgent.slice(0, 400) || null,
    label: deviceLabel(env.userAgent, env.maxTouchPoints, env.standalone),
  }
}

export class PushError extends Error {
  constructor(
    message: string,
    readonly code: 'denied' | 'dismissed' | 'no-worker',
  ) {
    super(message)
    this.name = 'PushError'
  }
}

/**
 * Activa los avisos aquí. Tiene que llamarse desde un gesto (un toque): iOS solo enseña el permiso así. Si el navegador
 * ya tenía una suscripción (p. ej. se quitó el dispositivo de la lista), se reutiliza.
 */
export async function enablePush(m: Muninn): Promise<PushDevice> {
  // Lo primero, antes de cualquier `await` largo: Safari exige que el permiso salga del mismo gesto.
  const permission = await Notification.requestPermission()
  if (permission === 'denied') throw new PushError('Has bloqueado los avisos', 'denied')
  if (permission !== 'granted') throw new PushError('No diste permiso para los avisos', 'dismissed')
  const reg = await registration()
  if (!reg)
    throw new PushError('La app aún no está lista: recárgala y vuelve a probar', 'no-worker')
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY),
    }))
  return m.push.subscribe(toInput(sub))
}

/** Desactiva los avisos aquí: quita la fila y la suscripción del navegador. */
export async function disablePush(m: Muninn) {
  const sub = await browserSubscription()
  if (!sub) return
  await m.push.forget(sub.endpoint)
  await sub.unsubscribe()
}

/**
 * Al abrir Ajustes › Notificaciones: si este dispositivo sigue en la lista, refresca sus claves y «visto por última
 * vez». Si lo quitaste desde otro, no lo vuelve a añadir: tú decides.
 */
export async function refreshThisDevice(m: Muninn, devices: PushDevice[]) {
  const sub = await browserSubscription()
  if (!sub || !devices.some((d) => d.endpoint === sub.endpoint)) return false
  await m.push.subscribe(toInput(sub))
  return true
}

/**
 * Al cerrar sesión: este dispositivo deja de recibir los avisos de esa cuenta. Sin esperar más de unos segundos (sin
 * red, la sesión se cierra igual y la fila la borrará la función al dar 410).
 */
export async function leaveThisDevice(m: Muninn | undefined) {
  const work = (async () => {
    const sub = await browserSubscription()
    if (!sub) return
    if (m) await m.push.forget(sub.endpoint).catch(() => undefined)
    await sub.unsubscribe().catch(() => undefined)
  })()
  await Promise.race([work.catch(() => undefined), new Promise((r) => setTimeout(r, 3000))])
}
