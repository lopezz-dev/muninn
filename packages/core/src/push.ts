import type { z } from 'zod'
import { formatEuros } from './finance'
import {
  isPushServiceUrl,
  type PushDevice,
  type PushSubscribeInput,
  pushSubscribeInput,
} from './schemas'
import type { PushSendSummary, Store } from './store'
import { daysBetween } from './subscriptions'

export interface PushContext {
  store: Store
  nowIso: () => string
  today: () => string
  parse: <S extends z.ZodType>(schema: S, value: unknown) => z.output<S>
}

/** Un aviso listo para enviar: lo que lee `push-sw.js` (`title`, `body`, `url`, `tag`) y su clave en `push_log`. */
export interface PushAlert {
  key: string
  title: string
  body: string
  url: string
  /** El mismo `tag` sustituye al aviso anterior en el dispositivo en lugar de apilarse. */
  tag: string
}

/**
 * Entrega un aviso a un dispositivo y devuelve el código HTTP del servicio de push (201 si lo aceptó). Lo pone la Edge
 * Function con `web-push` y la clave VAPID; los tests, uno falso.
 */
export type PushSender = (
  device: Pick<PushDevice, 'endpoint' | 'p256dh' | 'auth'>,
  payload: Omit<PushAlert, 'key'>,
) => Promise<number>

/** El servicio de push ya no conoce la suscripción (se desinstaló la PWA o se retiró el permiso): se borra. */
export const isGone = (status: number) => status === 404 || status === 410

export const SUBSCRIPTIONS_URL = '/finanzas?vista=suscripciones'

/** El aviso de «Probar» en Ajustes › Notificaciones. Sin clave: no se apunta en `push_log`. */
export const TEST_ALERT: PushAlert = {
  key: '',
  title: 'Muninn',
  body: 'Los avisos funcionan en este dispositivo.',
  url: '/ajustes/notificaciones',
  tag: 'test',
}

/** «Hoy», «Mañana» o «En 3 días»: cuándo es el cobro, para el texto del aviso. */
export function whenText(daysUntil: number) {
  if (daysUntil <= 0) return 'Hoy'
  if (daysUntil === 1) return 'Mañana'
  return `En ${daysUntil} días`
}

/**
 * Avisos push (ADR-0040): los dispositivos de este usuario y los avisos de cobro que tocan. Enviar lo hace la Edge
 * Function `push` (con la clave privada VAPID); aquí solo se decide qué y a quién.
 */
export function createPush({ store, nowIso, today, parse }: PushContext) {
  const devices = () => store.pushDevices.list()

  /** Guarda (o refresca) la suscripción de este navegador. Volver a activar en el mismo dispositivo no duplica. */
  async function subscribe(input: PushSubscribeInput): Promise<PushDevice> {
    const data = parse(pushSubscribeInput, input)
    return store.pushDevices.upsert({
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      userAgent: data.userAgent ?? null,
      label: data.label ?? null,
      lastSeenAt: nowIso(),
    })
  }

  /** Quita un dispositivo: deja de recibir avisos. «Deshacer» es `subscribe` con sus mismos datos (`restore`). */
  const unsubscribe = (id: string) => store.pushDevices.remove(id)

  /** Vuelve a guardar un dispositivo quitado, con sus claves y su nombre. */
  const restore = (device: PushDevice) =>
    subscribe({
      endpoint: device.endpoint,
      keys: { p256dh: device.p256dh, auth: device.auth },
      userAgent: device.userAgent,
      label: device.label,
    })

  /** Olvida una suscripción por su dirección: el navegador ya no la reconoce (404/410) o se cerró la sesión. */
  const forget = (endpoint: string) => store.pushDevices.removeEndpoint(endpoint)

  /**
   * Los avisos de cobro que tocan hoy y aún no se enviaron: uno por suscripción sin archivar cuyo próximo cobro está
   * dentro de sus días de aviso (`remind_days`), sin contar las ya vencidas (esas se ven en Inicio). La clave lleva la
   * fecha del cobro: tras «Apuntar» o «Saltar», el siguiente ciclo vuelve a avisar.
   */
  async function chargeAlerts(): Promise<PushAlert[]> {
    const t0 = today()
    const due = (await store.financeSubscriptions.list({}))
      .filter((s) => !s.archivedAt)
      .map((s) => ({ s, daysUntil: daysBetween(t0, s.nextDate) }))
      .filter(({ s, daysUntil }) => daysUntil >= 0 && daysUntil <= s.remindDays)
    if (!due.length) return []
    const alerts = due.map(({ s, daysUntil }) => ({
      key: `charge:${s.id}:${s.nextDate}`,
      title: 'Próximo cobro',
      body: `${whenText(daysUntil)} te cobran ${s.name} · ${formatEuros(s.amount)}`,
      url: SUBSCRIPTIONS_URL,
      tag: `charge:${s.id}`,
    }))
    const sent = new Set(await store.pushLog.sent(alerts.map((a) => a.key)))
    return alerts.filter((a) => !sent.has(a.key))
  }

  /** Apunta los avisos como enviados (tras entregarlos a algún dispositivo). */
  const markSent = (keys: string[]) => store.pushLog.record(keys)

  /**
   * Envía cada aviso a cada dispositivo. Los que respondan 404 o 410 se borran; un aviso queda apuntado como enviado
   * si llegó al menos a un dispositivo (si todos fallan, se reintenta en la siguiente pasada del cron).
   */
  async function deliver(alerts: PushAlert[], send: PushSender): Promise<PushSendSummary> {
    const summary: PushSendSummary = { sent: 0, removed: 0, failed: 0 }
    if (!alerts.length) return summary
    let targets = await devices()
    const delivered = new Set<string>()
    for (const { key, ...payload } of alerts) {
      const alive = []
      for (const device of targets) {
        // Segunda barrera contra SSRF: una fila escrita sin pasar por `subscribe` tampoco se envía; se borra.
        const status = isPushServiceUrl(device.endpoint)
          ? await send(device, payload).catch(() => 0)
          : 410
        if (isGone(status)) {
          await forget(device.endpoint)
          summary.removed++
          continue
        }
        alive.push(device)
        if (status >= 200 && status < 300) {
          summary.sent++
          if (key) delivered.add(key)
        } else summary.failed++
      }
      targets = alive
    }
    if (delivered.size) await markSent([...delivered])
    return summary
  }

  /** Aviso de prueba a todos tus dispositivos. Sin la función `push` (modo demo), no hay con qué enviarlo. */
  const canTest = () => Boolean(store.pushDelivery)
  async function test() {
    if (!store.pushDelivery) throw new Error('Los avisos de prueba solo salen con una cuenta')
    return store.pushDelivery.test()
  }

  return {
    devices,
    subscribe,
    unsubscribe,
    restore,
    forget,
    chargeAlerts,
    markSent,
    deliver,
    canTest,
    test,
  }
}
