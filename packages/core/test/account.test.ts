import { describe, expect, it } from 'vitest'
import {
  type AccountSession,
  createMemoryStore,
  createMuninn,
  MEMORY_WRONG_MFA_CODE,
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
  appName: null,
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

describe('segundo factor', () => {
  it('el alta no cuenta hasta confirmarla con un primer código', async () => {
    const account = setup()
    expect(await account.mfa.assurance()).toEqual({ current: 'aal1', next: 'aal1' })
    const enrollment = await account.mfa.enroll()
    expect(enrollment.secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(enrollment.uri).toMatch(/^otpauth:\/\/totp\//)
    expect(await account.mfa.active()).toBeNull()

    await expect(account.mfa.confirm(enrollment.factorId, MEMORY_WRONG_MFA_CODE)).rejects.toThrow(
      /no es correcto/,
    )
    await account.mfa.confirm(enrollment.factorId, '123 456')
    expect((await account.mfa.active())?.id).toBe(enrollment.factorId)
    expect(await account.mfa.assurance()).toEqual({ current: 'aal2', next: 'aal2' })
  })

  it('valida el código: seis cifras', async () => {
    const account = setup()
    const { factorId } = await account.mfa.enroll()
    await expect(account.mfa.confirm(factorId, '12345')).rejects.toBeInstanceOf(ValidationError)
    await expect(account.mfa.confirm(factorId, 'abcdef')).rejects.toBeInstanceOf(ValidationError)
  })

  it('un alta a medias se sustituye al empezar otra', async () => {
    const account = setup()
    const first = await account.mfa.enroll()
    const second = await account.mfa.enroll()
    expect((await account.mfa.factors()).map((f) => f.id)).toEqual([second.factorId])
    expect(second.factorId).not.toBe(first.factorId)
  })

  it('con el segundo factor activado, no se puede dar de alta otro', async () => {
    const account = setup()
    const { factorId } = await account.mfa.enroll()
    await account.mfa.confirm(factorId, '123456')
    await expect(account.mfa.enroll()).rejects.toThrow(/Ya tienes/)
  })

  it('desactivarlo pide un código actual', async () => {
    const account = setup({
      factors: [
        { id: crypto.randomUUID(), name: 'App', status: 'verified', createdAt: '2026-10-01' },
      ],
    })
    await expect(account.mfa.disable(MEMORY_WRONG_MFA_CODE)).rejects.toThrow(/no es correcto/)
    expect(await account.mfa.active()).not.toBeNull()
    await account.mfa.disable('654321')
    expect(await account.mfa.active()).toBeNull()
    expect(await account.mfa.assurance()).toEqual({ current: 'aal1', next: 'aal1' })
    await expect(account.mfa.disable('654321')).rejects.toThrow(/No tienes/)
  })
})

describe('apps con acceso', () => {
  const grant = (name: string, grantedAt: string) => ({
    clientId: crypto.randomUUID(),
    name,
    uri: `https://${name}`,
    logoUri: null,
    scopes: ['email'],
    grantedAt,
  })

  it('lista las apps, la más reciente primero, y quita una', async () => {
    const claude = grant('claude.ai', '2026-10-21T10:00:00.000Z')
    const code = grant('Claude Code', '2026-10-25T10:00:00.000Z')
    const account = setup({ grants: [claude, code] })
    expect((await account.apps.list()).map((g) => g.name)).toEqual(['Claude Code', 'claude.ai'])
    await account.apps.revoke(claude.clientId)
    expect((await account.apps.list()).map((g) => g.name)).toEqual(['Claude Code'])
  })

  it('valida el id de la app', async () => {
    const account = setup()
    await expect(account.apps.revoke('claude')).rejects.toBeInstanceOf(ValidationError)
    await expect(account.apps.approveWithMfa('  ')).rejects.toBeInstanceOf(ValidationError)
  })

  it('solo apunta la aprobación con el segundo factor si la sesión es aal2', async () => {
    const claude = grant('claude.ai', '2026-10-21T10:00:00.000Z')
    expect(await setup({ grants: [claude] }).apps.approveWithMfa('auth-1')).toBe(false)
    const withFactor = setup({
      grants: [claude],
      factors: [
        { id: crypto.randomUUID(), name: 'App', status: 'verified', createdAt: claude.grantedAt },
      ],
    })
    expect(await withFactor.apps.approveWithMfa('auth-1')).toBe(true)
    await withFactor.apps.revoke(claude.clientId)
    expect(await withFactor.apps.list()).toEqual([])
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
    // UA real de WebView2: igual que el de Edge. Sin la marca de Muninn, la app de escritorio no se distingue.
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0',
      'Windows · Edge',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0 Muninn/0.4.0',
      'Muninn para Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Muninn/0.4.0',
      'Muninn para Mac',
    ],
    ['node', 'Programa o servidor'],
    ['python-httpx/0.28.1', 'Programa o servidor'],
    [null, 'Dispositivo desconocido'],
  ])('%s → %s', (ua, label) => {
    expect(sessionDeviceLabel(ua)).toBe(label)
  })

  it('una sesión abierta por una app OAuth lleva su nombre, diga lo que diga el user agent', () => {
    expect(sessionDeviceLabel('python-httpx/0.28.1', 'Claude')).toBe('Claude · app conectada')
    expect(sessionDeviceLabel(null, 'Claude')).toBe('Claude · app conectada')
    expect(sessionDeviceLabel('python-httpx/0.28.1', null)).toBe('Programa o servidor')
  })
})
