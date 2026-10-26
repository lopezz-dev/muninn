import { createMemoryStore, createMuninn } from '@muninn/core'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { generateMorningReport } from '../src/lib/morning-report'
import { DEFAULT_REPORT, nowClock, reportDue, reportPrefs } from '../src/lib/morning-report-prefs'

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

  it('se guarda como nota, apunta el día y no se repite sin «Hacer ahora»', async () => {
    const m = createMuninn(createMemoryStore())
    await m.settings.update({ preferences: { morningReport: { enabled: true, time: '00:00' } } })
    const p = await m.projects.create({ name: 'Prueba F4' })
    await m.tasks.create({ projectId: p.id, title: 'Prueba F4 para hoy', dueDate: m.today() })
    const qc = new QueryClient()
    const modules = new Set(['tasks', 'notes'] as const)

    const note = await generateMorningReport(m, qc, { modules })
    expect(note?.pinned).toBe(true)
    expect(note?.content).toContain('- Prueba F4 para hoy · Prueba F4')
    expect(note?.content).not.toContain('## Cobros')
    expect(reportPrefs(await m.settings.get())).toMatchObject({
      lastDate: m.today(),
      lastNoteId: note?.id,
    })

    expect(await generateMorningReport(m, qc, { modules })).toBeNull()
    const again = await generateMorningReport(m, qc, { modules, force: true })
    expect(again?.id).not.toBe(note?.id)
    expect((await m.notes.get(note?.id ?? '')).pinned).toBe(false)
  })
})
