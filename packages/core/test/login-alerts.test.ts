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
const MAC_FIREFOX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0'

let n = 0
const login = (over: Partial<PendingLogin> = {}): PendingLogin => ({
  sessionId: `s${++n}`,
  ownerId: 'alex',
  createdAt: `2026-11-05T08:${String(n).padStart(2, '0')}:00Z`,
  userAgent: WIN_CHROME,
  ip: '203.0.113.7',
  appName: null,
  email: 'alex@example.com',
  locale: 'es',
  enabled: true,
  ...over,
})

/** Un «Supabase» en memoria: lo apuntado pasa a ser conocido en la siguiente pasada. */
function fakeDb(known: Array<{ ownerId: string; deviceKey: string }> = []) {
  const devices = [...known]
  const log: LoginRecord[] = []
  let queue: PendingLogin[] = []
  const sent: LoginAlertMail[] = []
  const send = vi.fn(async (mail: LoginAlertMail) => {
    sent.push(mail)
  })
  const deps = {
    pending: async () => queue.filter((p) => !log.some((l) => l.sessionId === p.sessionId)),
    known: async (owners: string[]) => devices.filter((d) => owners.includes(d.ownerId)),
    record: async (rows: LoginRecord[]) => {
      for (const r of rows) {
        log.push(r)
        if (!devices.some((d) => d.ownerId === r.ownerId && d.deviceKey === r.deviceKey))
          devices.push({ ownerId: r.ownerId, deviceKey: r.deviceKey })
      }
    },
    send,
    appUrl: 'https://app.example.com/',
    timeZone: 'Europe/Madrid',
  }
  return {
    deps,
    log,
    sent,
    send,
    push: (...p: PendingLogin[]) => {
      queue = [...queue, ...p]
    },
  }
}

describe('loginDeviceKey', () => {
  it('es el nombre de la lista de sesiones, sin la IP', () => {
    expect(loginDeviceKey({ userAgent: WIN_CHROME, appName: null })).toBe('Windows · Chrome')
    expect(loginDeviceKey({ userAgent: 'python-httpx/0.28.1', appName: 'Claude' })).toBe(
      'Claude · app conectada',
    )
  })
})

describe('planLoginAlerts', () => {
  it('la primera vez de una cuenta apunta sin avisar', () => {
    const plan = planLoginAlerts([login(), login({ userAgent: IPHONE })], [])
    expect(plan.map((p) => p.decision)).toEqual(['seed', 'seed'])
  })

  it('avisa de un dispositivo nuevo y no de uno conocido', () => {
    const known = [{ ownerId: 'alex', deviceKey: 'Windows · Chrome' }]
    const plan = planLoginAlerts([login(), login({ userAgent: IPHONE })], known)
    expect(plan.map((p) => [p.deviceKey, p.decision])).toEqual([
      ['Windows · Chrome', 'known'],
      ['iPhone · Safari', 'alert'],
    ])
  })

  it('dos sesiones del mismo dispositivo nuevo dan un solo aviso, en orden de llegada', () => {
    const known = [{ ownerId: 'alex', deviceKey: 'Windows · Chrome' }]
    const later = login({ userAgent: IPHONE, createdAt: '2026-11-05T10:00:00Z' })
    const first = login({ userAgent: IPHONE, createdAt: '2026-11-05T09:00:00Z' })
    const plan = planLoginAlerts([later, first], known)
    expect(plan.map((p) => [p.login.sessionId, p.decision])).toEqual([
      [first.sessionId, 'alert'],
      [later.sessionId, 'known'],
    ])
  })

  it('desactivado o sin correo, se apunta sin avisar', () => {
    const known = [{ ownerId: 'alex', deviceKey: 'Windows · Chrome' }]
    const plan = planLoginAlerts(
      [
        login({ userAgent: IPHONE, enabled: false }),
        login({ userAgent: MAC_FIREFOX, email: null }),
      ],
      known,
    )
    expect(plan.map((p) => p.decision)).toEqual(['muted', 'muted'])
  })

  it('cada cuenta va por su lado', () => {
    const known = [{ ownerId: 'alex', deviceKey: 'Windows · Chrome' }]
    const plan = planLoginAlerts([login({ ownerId: 'otra' }), login({ userAgent: IPHONE })], known)
    expect(plan.map((p) => [p.login.ownerId, p.decision])).toEqual([
      ['otra', 'seed'],
      ['alex', 'alert'],
    ])
  })

  it('reconectar una app OAuth no avisa otra vez', () => {
    const known = [{ ownerId: 'alex', deviceKey: 'Claude · app conectada' }]
    const plan = planLoginAlerts(
      [login({ userAgent: 'python-httpx/0.28.1', appName: 'Claude' })],
      known,
    )
    expect(plan[0]?.decision).toBe('known')
  })
})

describe('loginAlertMail', () => {
  it('en español, con dispositivo, hora local, IP y el enlace a Sesiones', () => {
    const mail = loginAlertMail(login({ userAgent: IPHONE, createdAt: '2026-11-05T08:30:00Z' }), {
      appUrl: 'https://app.example.com/',
      timeZone: 'Europe/Madrid',
    })
    expect(mail.to).toBe('alex@example.com')
    expect(mail.subject).toBe('Nuevo inicio de sesión en Muninn: iPhone · Safari')
    expect(mail.text).toContain('Dispositivo: iPhone · Safari')
    expect(mail.text).toContain('9:30') // 08:30 UTC es 09:30 en Madrid (horario de invierno)
    expect(mail.text).toContain('IP: 203.0.113.7')
    expect(mail.text).toContain('https://app.example.com/ajustes/cuenta#ajuste-sesiones')
    expect(mail.html).toContain('lang="es"')
  })

  it('en inglés por defecto, y sin IP si no la hay', () => {
    const mail = loginAlertMail(login({ locale: null, ip: null }), {
      appUrl: 'https://app.example.com',
      timeZone: 'UTC',
    })
    expect(mail.subject).toBe('New sign-in to Muninn: Windows · Chrome')
    expect(mail.text).not.toContain('IP:')
  })

  it('escapa el HTML de lo que viene del user agent o de la app', () => {
    const mail = loginAlertMail(login({ appName: '<img src=x onerror=alert(1)>' }), {
      appUrl: 'https://app.example.com',
      timeZone: 'UTC',
    })
    expect(mail.html).not.toContain('<img')
    expect(mail.html).toContain('&lt;img')
  })
})

describe('runLoginAlerts', () => {
  it('primera pasada en silencio; luego avisa solo de lo nuevo y una vez', async () => {
    const db = fakeDb()
    db.push(login())
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 1, emailed: 0, failed: 0 })

    db.push(login(), login({ userAgent: IPHONE }))
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 1, emailed: 1, failed: 0 })
    expect(db.sent.map((m) => m.subject)).toEqual([
      'Nuevo inicio de sesión en Muninn: iPhone · Safari',
    ])

    // La pasada siguiente no repite nada.
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 0, emailed: 0, failed: 0 })
    expect(db.send).toHaveBeenCalledTimes(1)
  })

  it('si el correo falla, no apunta ni esa sesión ni las del mismo dispositivo, y reintenta', async () => {
    const db = fakeDb([{ ownerId: 'alex', deviceKey: 'Windows · Chrome' }])
    db.deps.send = vi.fn(async () => {
      throw new Error('Resend 500')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.push(login({ userAgent: IPHONE }), login({ userAgent: IPHONE }), login())
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 1, emailed: 0, failed: 1 })
    expect(db.log.map((l) => l.deviceKey)).toEqual(['Windows · Chrome'])

    db.deps.send = db.send
    expect(await runLoginAlerts(db.deps)).toEqual({ recorded: 1, emailed: 1, failed: 0 })
    expect(db.log.filter((l) => l.emailed)).toHaveLength(1)
  })
})
