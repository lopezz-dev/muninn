import { describe, expect, it, vi } from 'vitest'
import {
  type LoginAlertMail,
  type LoginRecord,
  loginAlertMail,
  loginDeviceKey,
  type PendingLogin,
  planLoginAlerts,
  runLoginAlerts,
} from '../src'

const WIN_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36 Edg/156.0 Muninn/0.10.0 (PC-ALEX)'

let n = 0
const login = (over: Partial<PendingLogin> = {}): PendingLogin => ({
  sessionId: `s${++n}`,
  ownerId: 'alex',
  createdAt: `2026-11-05T08:${String(n % 60).padStart(2, '0')}:00Z`,
  userAgent: WIN_CHROME,
  ip: '203.0.113.7',
  appName: null,
  deviceName: null,
  email: 'alex@example.com',
  locale: 'es',
  enabled: true,
  lastEmailedAt: null,
  ...over,
})

const PORTATIL = { ownerId: 'alex', deviceKey: 'Portátil del curro' }

/** Un «Supabase» en memoria: lo apuntado con nombre pasa a ser conocido, y `emailed` cuenta para el tope diario. */
function fakeDb(
  known: Array<{ ownerId: string; deviceKey: string }> = [],
  now = '2026-11-05T12:00:00Z',
) {
  const devices = [...known]
  const log: Array<LoginRecord & { at: string }> = []
  let queue: PendingLogin[] = []
  const sent: LoginAlertMail[] = []
  const send = vi.fn(async (mail: LoginAlertMail) => {
    sent.push(mail)
  })
  const clock = { now }
  const deps = {
    pending: async () =>
      queue
        .filter((p) => !log.some((l) => l.sessionId === p.sessionId))
        .map((p) => {
          const emailed = log.filter((l) => l.ownerId === p.ownerId && l.emailed).map((l) => l.at)
          return { ...p, lastEmailedAt: emailed.sort().at(-1) ?? null }
        }),
    known: async (owners: string[]) => devices.filter((d) => owners.includes(d.ownerId)),
    record: async (rows: LoginRecord[]) => {
      for (const r of rows) {
        log.push({ ...r, at: clock.now })
        if (
          r.deviceKey &&
          !devices.some((d) => d.ownerId === r.ownerId && d.deviceKey === r.deviceKey)
        )
          devices.push({ ownerId: r.ownerId, deviceKey: r.deviceKey })
      }
    },
    send,
    appUrl: 'https://app.example.com/',
    timeZone: 'Europe/Madrid',
    now: () => clock.now,
  }
  return {
    deps,
    log,
    sent,
    send,
    clock,
    devices,
    push: (...p: PendingLogin[]) => {
      queue = [...queue, ...p]
    },
  }
}

describe('loginDeviceKey', () => {
  it('es el nombre: el que pusiste, el del equipo o el de la app; sin nombre, nada', () => {
    expect(
      loginDeviceKey({ userAgent: WIN_CHROME, appName: null, deviceName: 'Portátil del curro' }),
    ).toBe('Portátil del curro')
    expect(loginDeviceKey({ userAgent: DESKTOP, appName: null, deviceName: null })).toBe('PC-ALEX')
    expect(
      loginDeviceKey({ userAgent: 'python-httpx/0.28.1', appName: 'Claude', deviceName: null }),
    ).toBe('Claude · app conectada')
    expect(loginDeviceKey({ userAgent: WIN_CHROME, appName: null, deviceName: null })).toBeNull()
  })
})

describe('planLoginAlerts', () => {
  it('la primera vez de una cuenta apunta sin avisar', () => {
    const plan = planLoginAlerts([login(), login({ userAgent: IPHONE })], [])
    expect(plan.map((p) => p.decision)).toEqual(['seed', 'seed'])
  })

  it('un nombre conocido no avisa; uno sin nombre, siempre', () => {
    const plan = planLoginAlerts(
      [login({ deviceName: 'Portátil del curro' }), login(), login()],
      [PORTATIL],
    )
    expect(plan.map((p) => p.decision)).toEqual(['known', 'alert', 'alert'])
  })

  it('un nombre nuevo avisa una vez, y en orden de llegada', () => {
    const later = login({ userAgent: DESKTOP, createdAt: '2026-11-05T10:00:00Z' })
    const first = login({ userAgent: DESKTOP, createdAt: '2026-11-05T09:00:00Z' })
    const plan = planLoginAlerts([later, first], [PORTATIL])
    expect(plan.map((p) => [p.login.sessionId, p.decision])).toEqual([
      [first.sessionId, 'alert'],
      [later.sessionId, 'known'],
    ])
  })

  it('desactivado o sin correo, se apunta sin avisar', () => {
    const plan = planLoginAlerts([login({ enabled: false }), login({ email: null })], [PORTATIL])
    expect(plan.map((p) => p.decision)).toEqual(['muted', 'muted'])
  })

  it('reconectar una app que ya usabas no avisa', () => {
    const known = [{ ownerId: 'alex', deviceKey: 'Claude · app conectada' }]
    const plan = planLoginAlerts(
      [login({ userAgent: 'python-httpx/0.28.1', appName: 'Claude' })],
      known,
    )
    expect(plan[0]?.decision).toBe('known')
  })
})

describe('loginAlertMail', () => {
  it('en español, con el dispositivo, la hora local, la IP, el enlace y cómo dejar de recibirlo', () => {
    const mail = loginAlertMail([login({ userAgent: IPHONE, createdAt: '2026-11-05T08:30:00Z' })], {
      appUrl: 'https://app.example.com/',
      timeZone: 'Europe/Madrid',
    })
    expect(mail.to).toBe('alex@example.com')
    expect(mail.subject).toBe('Inicio de sesión en Muninn: iPhone · Safari')
    expect(mail.text).toContain('Dispositivo: iPhone · Safari')
    expect(mail.text).toContain('9:30') // 08:30 UTC es 09:30 en Madrid (horario de invierno)
    expect(mail.text).toContain('IP: 203.0.113.7')
    expect(mail.text).toContain('ponle nombre')
    expect(mail.text).toContain('https://app.example.com/ajustes/cuenta#ajuste-sesiones')
    expect(mail.html).toContain('lang="es"')
  })

  it('varias sesiones van en el mismo correo; en inglés por defecto', () => {
    const mail = loginAlertMail(
      [login({ locale: null }), login({ locale: null, ip: null, userAgent: IPHONE })],
      {
        appUrl: 'https://app.example.com',
        timeZone: 'UTC',
      },
    )
    expect(mail.subject).toBe('2 sign-ins to Muninn we don’t recognise')
    expect(mail.text.match(/Device:/g)).toHaveLength(2)
    expect(mail.text.match(/IP:/g)).toHaveLength(1)
  })

  it('escapa el HTML de lo que viene del nombre o de la app', () => {
    const mail = loginAlertMail([login({ deviceName: '<img src=x onerror=alert(1)>' })], {
      appUrl: 'https://app.example.com',
      timeZone: 'UTC',
    })
    expect(mail.html).not.toContain('<img')
    expect(mail.html).toContain('&lt;img')
  })
})

describe('runLoginAlerts', () => {
  it('primera pasada en silencio; luego un solo correo con lo que no se reconoce', async () => {
    const db = fakeDb()
    db.push(login({ deviceName: 'Portátil del curro' }), login())
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 2, emailed: 0, capped: 0, failed: 0 })
    expect(db.devices.map((d) => d.deviceKey)).toEqual(['Portátil del curro'])

    db.push(login({ deviceName: 'Portátil del curro' }), login(), login({ userAgent: IPHONE }))
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 1, emailed: 1, capped: 0, failed: 0 })
    expect(db.sent).toHaveLength(1)
    expect(db.sent[0]?.subject).toBe('2 inicios de sesión en Muninn que no reconocemos')

    // La pasada siguiente no repite nada.
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 0, emailed: 0, capped: 0, failed: 0 })
  })

  it('como mucho un correo al día por cuenta: lo que llega antes de 24 h solo se apunta', async () => {
    const db = fakeDb([PORTATIL], '2026-11-05T09:00:00Z')
    db.push(login())
    expect((await runLoginAlerts(db.deps)).emailed).toBe(1)

    db.clock.now = '2026-11-05T20:00:00Z'
    db.push(login({ userAgent: IPHONE }))
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 0, emailed: 0, capped: 1, failed: 0 })

    db.clock.now = '2026-11-06T09:30:00Z'
    db.push(login())
    expect((await runLoginAlerts(db.deps)).emailed).toBe(1)
    expect(db.send).toHaveBeenCalledTimes(2)
  })

  it('si el correo falla, no apunta esas sesiones ni las del mismo nombre, y reintenta', async () => {
    const db = fakeDb([PORTATIL])
    db.deps.send = vi.fn(async () => {
      throw new Error('Resend 500')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.push(
      login({ userAgent: DESKTOP }),
      login({ userAgent: DESKTOP }),
      login({ deviceName: 'Portátil del curro' }),
    )
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 1, emailed: 0, capped: 0, failed: 1 })
    expect(db.log.map((l) => l.deviceKey)).toEqual(['Portátil del curro'])
    expect(db.devices.map((d) => d.deviceKey)).toEqual(['Portátil del curro'])

    db.deps.send = db.send
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 1, emailed: 1, capped: 0, failed: 0 })
    expect(db.devices.map((d) => d.deviceKey)).toEqual(['Portátil del curro', 'PC-ALEX'])
  })
})
