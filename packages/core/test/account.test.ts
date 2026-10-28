import { describe, expect, it } from 'vitest'
import {
  type AccountSession,
  createMemoryStore,
  createMuninn,
  type MemoryAccountSeed,
  sessionDeviceLabel,
  ValidationError,
} from '../src'

const session = (over: Partial<AccountSession>): AccountSession => ({
  id: crypto.randomUUID(),
  createdAt: '2026-10-20T08:00:00.000Z',
  lastActiveAt: '2026-10-20T08:00:00.000Z',
  userAgent: null,
  ip: null,
  aal: 'aal1',
  current: false,
  ...over,
})

function setup(seed?: MemoryAccountSeed) {
  const store = createMemoryStore(undefined, { account: seed })
  return createMuninn(store, { timeZone: 'UTC' }).account
}

describe('sesiones', () => {
  it('sin sesiones de partida, está la de este dispositivo', async () => {
    const account = setup()
    expect(account.available()).toBe(true)
    const list = await account.sessions.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.current).toBe(true)
  })

  it('la de este dispositivo va primero y las demás, de la más reciente a la más antigua', async () => {
    const old = session({ lastActiveAt: '2026-10-01T08:00:00.000Z' })
    const recent = session({ lastActiveAt: '2026-10-27T08:00:00.000Z' })
    const here = session({ current: true, lastActiveAt: '2026-10-10T08:00:00.000Z' })
    const account = setup({ sessions: [old, here, recent] })
    expect((await account.sessions.list()).map((s) => s.id)).toEqual([here.id, recent.id, old.id])
  })

  it('cierra la sesión de otro dispositivo, pero no la de este', async () => {
    const other = session({})
    const here = session({ current: true })
    const account = setup({ sessions: [other, here] })
    expect(await account.sessions.revoke(other.id)).toBe(true)
    expect(await account.sessions.revoke(other.id)).toBe(false)
    await expect(account.sessions.revoke(here.id)).rejects.toThrow(/Cerrar sesión/)
    expect((await account.sessions.list()).map((s) => s.id)).toEqual([here.id])
  })

  it('cerrar en los demás deja solo esta; en todos, ninguna', async () => {
    const account = setup({ sessions: [session({}), session({}), session({ current: true })] })
    await account.sessions.signOut('others')
    expect(await account.sessions.list()).toHaveLength(1)
    await account.sessions.signOut('global')
    expect(await account.sessions.list()).toHaveLength(0)
  })

  it('valida el alcance de cerrar sesión', async () => {
    const account = setup()
    // @ts-expect-error alcance que no existe
    await expect(account.sessions.signOut('local')).rejects.toBeInstanceOf(ValidationError)
  })

  it('sin seguridad en el store (fichero local del MCP), no está disponible', async () => {
    const store = createMemoryStore()
    const { account: _, ...rest } = store
    const account = createMuninn(rest, { timeZone: 'UTC' }).account
    expect(account.available()).toBe(false)
    await expect(account.sessions.list()).rejects.toThrow(/con una cuenta/)
  })
})

describe('nombre del dispositivo', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Mac · Chrome',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'iPhone · Safari',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
      'Windows · Edge',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Tauri/2.0',
      'Muninn para Windows',
    ],
    ['node', 'Programa o servidor'],
    [null, 'Dispositivo desconocido'],
  ])('%s → %s', (ua, label) => {
    expect(sessionDeviceLabel(ua)).toBe(label)
  })
})
