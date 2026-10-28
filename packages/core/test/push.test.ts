import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMemoryStore,
  createMuninn,
  type PushSender,
  TEST_ALERT,
  ValidationError,
  whenText,
} from '../src'

let clock = new Date('2026-10-28T07:00:00Z')
beforeEach(() => {
  clock = new Date('2026-10-28T07:00:00Z')
})

function setup() {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  const app = createMuninn(store, { now: () => clock, timeZone: 'UTC' })
  return { app, store, push: app.push }
}

const sub = (n: number) => ({
  endpoint: `https://web.push.apple.com/dispositivo-${n}`,
  keys: { p256dh: `clave-${n}`, auth: `auth-${n}` },
  userAgent: 'Mozilla/5.0 (iPhone)',
  label: 'iPhone · Safari',
})

describe('dispositivos', () => {
  it('suscribir guarda el dispositivo; repetirlo en el mismo navegador lo actualiza sin duplicar', async () => {
    const { push } = setup()
    const first = await push.subscribe(sub(1))
    expect(first).toMatchObject({
      endpoint: sub(1).endpoint,
      p256dh: 'clave-1',
      auth: 'auth-1',
      label: 'iPhone · Safari',
      lastSeenAt: '2026-10-28T07:00:00.000Z',
    })
    clock = new Date('2026-10-29T07:00:00Z')
    const again = await push.subscribe({ ...sub(1), keys: { p256dh: 'nueva', auth: 'auth-1' } })
    expect(again.id).toBe(first.id)
    expect(again.p256dh).toBe('nueva')
    expect(again.lastSeenAt).toBe('2026-10-29T07:00:00.000Z')
    expect(await push.devices()).toHaveLength(1)
  })

  it('lista del visto más recientemente al más antiguo', async () => {
    const { push } = setup()
    await push.subscribe(sub(1))
    clock = new Date('2026-10-29T07:00:00Z')
    await push.subscribe(sub(2))
    expect((await push.devices()).map((d) => d.endpoint)).toEqual([
      sub(2).endpoint,
      sub(1).endpoint,
    ])
  })

  it('quitar y deshacer (restore) devuelve el dispositivo con sus claves', async () => {
    const { push } = setup()
    const d = await push.subscribe(sub(1))
    await push.unsubscribe(d.id)
    expect(await push.devices()).toEqual([])
    const back = await push.restore(d)
    expect(back).toMatchObject({ endpoint: d.endpoint, p256dh: d.p256dh, label: d.label })
  })

  it('forget borra por dirección (404/410 o cerrar sesión)', async () => {
    const { push } = setup()
    await push.subscribe(sub(1))
    await push.subscribe(sub(2))
    await push.forget(sub(1).endpoint)
    expect((await push.devices()).map((d) => d.endpoint)).toEqual([sub(2).endpoint])
  })

  it('valida la suscripción: solo https y con claves', async () => {
    const { push } = setup()
    await expect(
      push.subscribe({ ...sub(1), endpoint: 'http://inseguro.example/x' }),
    ).rejects.toThrow(ValidationError)
    await expect(push.subscribe({ ...sub(1), keys: { p256dh: '', auth: 'a' } })).rejects.toThrow(
      ValidationError,
    )
  })

  it('solo servicios de push conocidos (contra SSRF)', async () => {
    const { push } = setup()
    for (const endpoint of [
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/x',
      'https://fcm.googleapis.com.evil.example/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
    ]) {
      await expect(push.subscribe({ ...sub(1), endpoint })).rejects.toThrow(ValidationError)
    }
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-db5p.notify.windows.com/w/?token=abc',
    ]) {
      await expect(push.subscribe({ ...sub(1), endpoint })).resolves.toMatchObject({ endpoint })
    }
  })

  it('deliver no envía a una fila con otra dirección: la borra', async () => {
    const { push, store } = setup()
    await store.pushDevices.upsert({
      endpoint: 'https://169.254.169.254/x',
      p256dh: 'k',
      auth: 'a',
      userAgent: null,
      label: null,
      lastSeenAt: clock.toISOString(),
    })
    let calls = 0
    const res = await push.deliver([TEST_ALERT], async () => {
      calls++
      return 201
    })
    expect(calls).toBe(0)
    expect(res).toEqual({ sent: 0, removed: 1, failed: 0 })
    expect(await push.devices()).toEqual([])
  })

  it('sin la función push (memoria), no hay aviso de prueba', async () => {
    const { push } = setup()
    expect(push.canTest()).toBe(false)
    await expect(push.test()).rejects.toThrow()
  })
})

describe('avisos de cobro', () => {
  async function withSubscriptions() {
    const ctx = setup()
    const f = ctx.app.finance
    const account = await f.accounts.create({ name: 'Imagin', kind: 'checking' })
    const make = (name: string, nextDate: string, remindDays = 3, amount = 999) =>
      f.subscriptions.create({
        name,
        amount,
        frequency: 'monthly',
        accountId: account.id,
        nextDate,
        remindDays,
      })
    return { ...ctx, f, make }
  }

  it('avisa de los cobros dentro de sus días de aviso, con texto y enlace', async () => {
    const { push, make } = await withSubscriptions()
    const vercel = await make('Vercel Pro', '2026-10-29', 3, 2000)
    await make('Spotify', '2026-10-28')
    await make('Dominio', '2026-11-20')
    const alerts = await push.chargeAlerts()
    // `Intl` separa el euro con un espacio duro.
    expect(alerts.map((a) => a.body.replace(/\s/g, ' '))).toEqual([
      'Hoy te cobran Spotify · 9,99 €',
      'Mañana te cobran Vercel Pro · 20,00 €',
    ])
    expect(alerts[1]).toMatchObject({
      key: `charge:${vercel.id}:2026-10-29`,
      tag: `charge:${vercel.id}`,
      title: 'Próximo cobro',
      url: '/finanzas?vista=suscripciones',
    })
  })

  it('no repite un aviso ya enviado, pero sí avisa del ciclo siguiente', async () => {
    const { push, make, f } = await withSubscriptions()
    const s = await make('Spotify', '2026-10-30')
    const [alert] = await push.chargeAlerts()
    if (!alert) throw new Error('sin aviso')
    await push.markSent([alert.key])
    expect(await push.chargeAlerts()).toEqual([])
    // Apuntado el cobro, la próxima fecha (30 de noviembre) avisará cuando entre en su ventana.
    await f.subscriptions.skip(s.id, { expected: '2026-10-30' })
    clock = new Date('2026-11-28T07:00:00Z')
    expect((await push.chargeAlerts()).map((a) => a.key)).toEqual([`charge:${s.id}:2026-11-30`])
  })

  it('no avisa de las vencidas ni de las archivadas', async () => {
    const { push, make, f } = await withSubscriptions()
    await make('Vencida', '2026-10-20')
    const archived = await make('Archivada', '2026-10-29')
    await f.subscriptions.archive(archived.id)
    expect(await push.chargeAlerts()).toEqual([])
  })

  it('deliver: borra los dispositivos que ya no existen y apunta lo entregado', async () => {
    const { push, make } = await withSubscriptions()
    await make('Spotify', '2026-10-29')
    await push.subscribe(sub(1))
    await push.subscribe(sub(2))
    const calls: string[] = []
    const send: PushSender = async (device, payload) => {
      calls.push(`${device.endpoint}|${payload.tag}`)
      return device.endpoint === sub(1).endpoint ? 410 : 201
    }
    const alerts = await push.chargeAlerts()
    expect(await push.deliver(alerts, send)).toEqual({ sent: 1, removed: 1, failed: 0 })
    expect(calls).toHaveLength(2)
    expect((await push.devices()).map((d) => d.endpoint)).toEqual([sub(2).endpoint])
    expect(await push.chargeAlerts()).toEqual([])
  })

  it('deliver: si ningún dispositivo lo acepta, el aviso se reintenta', async () => {
    const { push, make } = await withSubscriptions()
    await make('Spotify', '2026-10-29')
    await push.subscribe(sub(1))
    const down: PushSender = async () => {
      throw new Error('sin red')
    }
    expect(await push.deliver(await push.chargeAlerts(), down)).toEqual({
      sent: 0,
      removed: 0,
      failed: 1,
    })
    expect(await push.chargeAlerts()).toHaveLength(1)
    // El de prueba no lleva clave: no se apunta.
    expect(await push.deliver([TEST_ALERT], async () => 201)).toMatchObject({ sent: 1 })
  })

  it('texto de cuándo', () => {
    expect(whenText(0)).toBe('Hoy')
    expect(whenText(1)).toBe('Mañana')
    expect(whenText(4)).toBe('En 4 días')
  })
})
