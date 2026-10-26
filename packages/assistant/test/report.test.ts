import { createMemoryStore, createMuninn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import { benchFixture } from '../bench/fixture'
import {
  buildMorningReport,
  createScriptedProvider,
  minutesLate,
  reportIntro,
  reportTitle,
  saveMorningReport,
} from '../src'

describe('informe de la mañana', () => {
  it('tareas, cobros y noticias con los datos de verdad; sin módulos, sin sus secciones', async () => {
    const app = await benchFixture()
    const body = buildMorningReport({
      today: app.today(),
      overview: await app.overview(),
      charges: await app.finance.subscriptions.upcoming({ days: 7 }),
      digest: { content: '- **Tauri**: guía nueva.' } as never,
      generatedAt: new Date('2026-10-22T06:30:00Z'),
      scheduledTime: '08:30',
      timeZone: 'Europe/Madrid',
    })
    expect(body).toContain('_Hecho a las 08:30, jueves, 22 de octubre de 2026._')
    expect(body).toContain('**Vencidas (2)**')
    expect(body).toContain('- Firma y notarización en macOS · HuginnDB · desde el 17 oct')
    expect(body).toContain('**Para hoy (1)**')
    expect(body).toMatch(/- Vercel Pro · 20,00\s€ · mañana/)
    expect(body).toMatch(/- Netflix · 12,99\s€ · en 3 días/)
    expect(body).toContain('## Noticias\n- **Tauri**: guía nueva.')

    const solo = buildMorningReport({
      today: app.today(),
      overview: null,
      charges: null,
      digest: null,
      generatedAt: new Date('2026-10-22T08:42:00Z'),
      scheduledTime: '08:30',
      timeZone: 'Europe/Madrid',
    })
    expect(solo).toBe(
      '_Hecho a las 10:42: a las 08:30 el ordenador estaba apagado o Muninn cerrado._',
    )
  })

  it('título y retraso', () => {
    expect(reportTitle('2026-10-22')).toBe('Informe de la mañana · jueves, 22 oct')
    expect(minutesLate('08:30', '10:42')).toBe(132)
    expect(minutesLate('08:30', '08:31')).toBe(1)
  })

  it('se guarda como nota fijada del asistente y desfija la anterior', async () => {
    const app = createMuninn(createMemoryStore())
    const ayer = await saveMorningReport(app, { title: 'Ayer', content: 'x' })
    const hoy = await saveMorningReport(app, {
      title: 'Hoy',
      content: 'y',
      previousNoteId: ayer.id,
    })
    expect(hoy.pinned).toBe(true)
    expect((await app.notes.get(ayer.id)).pinned).toBe(false)
    const [last] = await app.recentActivity({ limit: 1 })
    expect(last).toMatchObject({ actor: 'assistant', payload: { context: { report: 'morning' } } })
  })

  it('la entradilla la escribe el modelo; si falla, null', async () => {
    const ok = createScriptedProvider([
      { when: () => true, steps: [{ text: '<think>x</think>Hoy, lo urgente es la firma.' }] },
    ])
    expect(await reportIntro(ok, 'informe')).toBe('Hoy, lo urgente es la firma.')
    const broken = {
      ...ok,
      chat: () => ({
        [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('caído')) }),
      }),
    }
    expect(await reportIntro(broken, 'informe')).toBeNull()
  })
})
