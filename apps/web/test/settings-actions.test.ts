// @vitest-environment jsdom
import { createMemoryStore, createMuninn } from '@muninn/core'
import { notify } from '@muninn/ui'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appearanceStore, changeAppearance } from '../src/lib/appearance'
import { assistantPrefs, saveAssistantPrefs } from '../src/lib/assistant-settings'
import { setModuleEnabled } from '../src/lib/module-actions'
import { changeReportPrefs, reportPrefs, savePrefs } from '../src/lib/morning-report-prefs'
import { keys } from '../src/lib/queries'
import { resetPrefs } from '../src/lib/settings-changes'
import { clickUndo, infos } from './undo'

vi.mock('@muninn/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@muninn/ui')>()),
  notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

async function setup() {
  const m = createMuninn(createMemoryStore())
  const qc = new QueryClient()
  qc.setQueryData(keys.settings, await m.settings.get())
  return { m, qc }
}

/** Que el próximo guardado de ajustes falle. */
const failNextSave = (m: ReturnType<typeof createMuninn>) =>
  vi.spyOn(m.settings, 'update').mockRejectedValueOnce(new Error('sin red'))

beforeEach(() => vi.clearAllMocks())

describe('módulos', () => {
  const toast = { label: 'Noticias', icon: 'news' as const }

  it('«Deshacer» lo vuelve a activar', async () => {
    const { m, qc } = await setup()
    await setModuleEnabled(m, qc, 'news', false, toast)
    expect(notify.success).toHaveBeenCalledWith(
      'Noticias desactivado',
      expect.objectContaining({ icon: 'news', id: 'module-news' }),
    )
    expect((await m.settings.get()).enabledModules).not.toContain('news')
    await clickUndo()
    expect((await m.settings.get()).enabledModules).toContain('news')
    expect(infos()).toEqual(['Cambio deshecho'])
  })

  it('si deshacer falla, avisa del fallo y no dice «deshecho»', async () => {
    const { m, qc } = await setup()
    await setModuleEnabled(m, qc, 'news', false, toast)
    failNextSave(m)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo guardar el cambio', {
      description: 'sin red',
    })
  })
})

describe('ajustes del asistente', () => {
  it('«Deshacer» devuelve lo de antes', async () => {
    const { m, qc } = await setup()
    await saveAssistantPrefs(m, qc, { model: 'llama3' }, { label: 'Modelo guardado' })
    expect(notify.success).toHaveBeenCalledWith(
      'Modelo guardado',
      expect.objectContaining({ icon: 'assistant' }),
    )
    expect(assistantPrefs(await m.settings.get()).model).toBe('llama3')
    await clickUndo()
    expect(assistantPrefs(await m.settings.get()).model).toBe('qwen3:8b')
    expect(infos()).toEqual(['Cambio deshecho'])
  })

  it('si deshacer falla, no dice «deshecho»', async () => {
    const { m, qc } = await setup()
    await saveAssistantPrefs(m, qc, { model: 'llama3' })
    failNextSave(m)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo guardar el ajuste', {
      description: 'sin red',
    })
  })
})

describe('informe de la mañana', () => {
  it('«Deshacer» devuelve la hora de antes', async () => {
    const { m, qc } = await setup()
    await changeReportPrefs(m, qc, { time: '07:15' })
    expect(notify.success).toHaveBeenCalledWith(
      'El informe se hará a las 07:15',
      expect.objectContaining({ icon: 'clock' }),
    )
    await clickUndo()
    expect(reportPrefs(await m.settings.get()).time).toBe('08:30')
    expect(infos()).toEqual(['Cambio deshecho'])
    expect(notify.success).toHaveBeenCalledOnce()
  })

  it('si deshacer falla, no dice «deshecho»', async () => {
    const { m, qc } = await setup()
    await changeReportPrefs(m, qc, { enabled: true })
    failNextSave(m)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo guardar el ajuste', {
      description: 'sin red',
    })
  })
})

describe('apariencia', () => {
  it('«Deshacer» la restaura', async () => {
    appearanceStore.set({ glass: true, accent: 'amber' })
    changeAppearance({ accent: 'teal' })
    expect(notify.success).toHaveBeenCalledWith(
      'Acento verde azulado',
      expect.objectContaining({ icon: 'palette' }),
    )
    expect(appearanceStore.get().accent).toBe('teal')
    await clickUndo()
    expect(appearanceStore.get().accent).toBe('amber')
    expect(notify.info).toHaveBeenCalledWith('Apariencia restaurada', { icon: 'palette' })
  })
})

describe('restablecer ajustes', () => {
  async function changed() {
    const s = await setup()
    appearanceStore.set({ glass: false, accent: 'blue' })
    await savePrefs(s.m, s.qc, { time: '07:00' })
    await resetPrefs(s.m, s.qc, ['glass', 'reportTime'], 'Sección restablecida')
    return s
  }

  it('vuelven a fábrica y «Deshacer» los devuelve', async () => {
    const { m } = await changed()
    expect(notify.success).toHaveBeenCalledWith(
      'Sección restablecida',
      expect.objectContaining({ icon: 'sync', description: 'Vuelven a su valor de fábrica' }),
    )
    expect(reportPrefs(await m.settings.get()).time).toBe('08:30')
    await clickUndo()
    expect(appearanceStore.get().glass).toBe(false)
    expect(reportPrefs(await m.settings.get()).time).toBe('07:00')
    expect(infos()).toEqual(['Cambio deshecho'])
  })

  it('si deshacer falla, lo dice', async () => {
    const { m } = await changed()
    failNextSave(m)
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo deshacer', { description: 'sin red' })
  })
})
