import { notify } from '@muninn/ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdate, type PendingUpdate } from '../src/lib/desktop-update'

vi.mock('@muninn/ui', () => ({ notify: { info: vi.fn(), loading: vi.fn(), error: vi.fn() } }))

const fakeUpdate = (over: Partial<PendingUpdate> = {}): PendingUpdate => ({
  version: '0.2.0',
  download: vi.fn(async () => {}),
  install: vi.fn(async () => {}),
  ...over,
})

/** La acción «Reiniciar» de la última píldora de versión nueva. */
const restart = () => {
  const opts = vi.mocked(notify.info).mock.calls.at(-1)?.[1]
  return opts?.action
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('checkForUpdate', () => {
  it('sin versión nueva no avisa', async () => {
    await checkForUpdate({ check: async () => null, relaunch: vi.fn() })
    expect(notify.info).not.toHaveBeenCalled()
  })

  it('descarga antes de avisar y «Reiniciar» instala y vuelve a abrir', async () => {
    const update = fakeUpdate()
    const relaunch = vi.fn(async () => {})
    await checkForUpdate({ check: async () => update, relaunch })

    expect(update.download).toHaveBeenCalledOnce()
    expect(notify.info).toHaveBeenCalledWith(
      'Hay una versión nueva',
      expect.objectContaining({ description: 'Muninn 0.2.0' }),
    )
    expect(update.install).not.toHaveBeenCalled()

    expect(restart()?.label).toBe('Reiniciar')
    restart()?.onClick()
    await vi.waitFor(() => expect(relaunch).toHaveBeenCalledOnce())
    expect(update.install).toHaveBeenCalledOnce()
  })

  it('sin red o sin latest.json calla', async () => {
    await expect(
      checkForUpdate({
        check: async () => {
          throw new Error('404')
        },
        relaunch: vi.fn(),
      }),
    ).resolves.toBeUndefined()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('si la descarga falla no ofrece reiniciar', async () => {
    const update = fakeUpdate({
      download: async () => {
        throw new Error('red')
      },
    })
    await checkForUpdate({ check: async () => update, relaunch: vi.fn() })
    expect(notify.info).not.toHaveBeenCalled()
  })

  it('si la instalación falla lo dice y no reinicia', async () => {
    const update = fakeUpdate({
      install: async () => {
        throw new Error('firma')
      },
    })
    const relaunch = vi.fn(async () => {})
    await checkForUpdate({ check: async () => update, relaunch })
    restart()?.onClick()
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledOnce())
    expect(relaunch).not.toHaveBeenCalled()
  })
})
