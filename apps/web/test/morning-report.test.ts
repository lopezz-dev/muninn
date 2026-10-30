import { type ChatProvider, createScriptedProvider } from '@muninn/assistant'
import { createMemoryStore, createMuninn } from '@muninn/core'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { generateMorningReport } from '../src/lib/morning-report'
import {
  changeReportPrefs,
  DEFAULT_REPORT,
  nowClock,
  reportDue,
  reportPrefs,
} from '../src/lib/morning-report-prefs'

/** Sin modelo: así el informe no depende del Ollama que haya en el equipo. */
const offline: ChatProvider = {
  id: 'offline',
  label: 'Sin modelo',
  status: async () => ({ state: 'offline', detail: 'apagado' }),
  async *chat() {},
}

/** Dice estar listo pero falla al escribir (red caída a mitad, modelo que se cae…). */
const broken: ChatProvider = {
  id: 'broken',
  label: 'Roto',
  status: async () => ({ state: 'ready', model: 'x', models: ['x'] }),
  // biome-ignore lint/correctness/useYield: falla antes de dar nada
  async *chat() {
    throw new Error('se cayó')
  },
}

async function setup() {
  const m = createMuninn(createMemoryStore())
  await m.settings.update({ preferences: { morningReport: { enabled: true, time: '00:00' } } })
  const p = await m.projects.create({ name: 'Prueba F4' })
  await m.tasks.create({ projectId: p.id, title: 'Prueba F4 para hoy', dueDate: m.today() })
  return { m, qc: new QueryClient(), modules: new Set(['tasks', 'notes'] as const) }
}

describe('informe de la mañana', () => {
  it('ajustes validados, desactivado por defecto', () => {
    expect(reportPrefs(undefined)).toEqual(DEFAULT_REPORT)
    expect(
      reportPrefs({
        preferences: {
          morningReport: { enabled: true, time: '07:05', lastDate: '2026-10-22', lastNoteId: 'n' },
        },
      }),
    ).toEqual({ enabled: true, time: '07:05', lastDate: '2026-10-22', lastNoteId: 'n' })
    expect(
      reportPrefs({
        preferences: { morningReport: { enabled: 'sí', time: '25:00', lastDate: 'ayer' } },
      }),
    ).toEqual(DEFAULT_REPORT)
  })

  it('toca si está activado, ya es la hora y no se hizo hoy (también si va tarde)', () => {
    const p = { ...DEFAULT_REPORT, enabled: true }
    expect(reportDue(p, '08:29', '2026-10-22')).toBe(false)
    expect(reportDue(p, '08:30', '2026-10-22')).toBe(true)
    expect(reportDue(p, '19:00', '2026-10-22')).toBe(true)
    expect(reportDue({ ...p, lastDate: '2026-10-22' }, '19:00', '2026-10-22')).toBe(false)
    expect(reportDue({ ...p, enabled: false }, '19:00', '2026-10-22')).toBe(false)
    expect(nowClock(new Date(2026, 9, 22, 7, 5))).toBe('07:05')
  })

  it('la hora y el interruptor a la vez no se pisan', async () => {
    // Lo que pasa al cambiar la hora y pulsar el interruptor sin salir del campo: los dos guardados salen juntos.
    const m = createMuninn(createMemoryStore())
    const qc = new QueryClient()
    await Promise.all([
      changeReportPrefs(m, qc, { time: '20:30' }),
      changeReportPrefs(m, qc, { enabled: true }),
    ])
    expect(reportPrefs(await m.settings.get())).toMatchObject({ enabled: true, time: '20:30' })
  })

  it('se guarda como nota, apunta el día y no se repite sin «Hacer ahora»', async () => {
    const { m, qc, modules } = await setup()

    const note = await generateMorningReport(m, qc, { modules, provider: offline })
    expect(note?.pinned).toBe(true)
    expect(note?.content).toContain('- Prueba F4 para hoy · Prueba F4')
    expect(note?.content).not.toContain('## Cobros')
    expect(reportPrefs(await m.settings.get())).toMatchObject({
      lastDate: m.today(),
      lastNoteId: note?.id,
    })

    expect(await generateMorningReport(m, qc, { modules, provider: offline })).toBeNull()
    const again = await generateMorningReport(m, qc, { modules, force: true, provider: offline })
    expect(again?.id).not.toBe(note?.id)
    expect((await m.notes.get(note?.id ?? '')).pinned).toBe(false)
  })
  it('con modelo, la nota empieza por la entradilla', async () => {
    const { m, qc, modules } = await setup()
    const provider = createScriptedProvider([], { fallback: 'Hoy toca la Prueba F4.' })
    const note = await generateMorningReport(m, qc, { modules, provider })
    expect(note?.content).toMatch(/^Hoy toca la Prueba F4\.\n\n/)
    expect(note?.content).toContain('- Prueba F4 para hoy · Prueba F4')
  })

  it('si el modelo falla, se guarda sin entradilla', async () => {
    const { m, qc, modules } = await setup()
    const note = await generateMorningReport(m, qc, { modules, provider: broken })
    expect(note?.pinned).toBe(true)
    // Sin entradilla, la nota arranca directamente con la línea «Hecho a las…» del cuerpo.
    expect(note?.content).toMatch(/^_Hecho a las /)
    expect(note?.content).toContain('- Prueba F4 para hoy · Prueba F4')
  })
})
