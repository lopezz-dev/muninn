import { createMemoryStore, createMuninn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import { BENCH } from '../bench/cases'
import { benchFixture } from '../bench/fixture'
import { runBench } from '../bench/run'
import {
  type AssistantEvent,
  catalog,
  createScriptedProvider,
  parametersOf,
  runAssistant,
  type ScriptedStep,
  toolsFor,
} from '../src'

const say = (content: string) => [{ role: 'user' as const, content }]
const scripted = (steps: ScriptedStep[]) => createScriptedProvider([{ when: () => true, steps }])

describe('catálogo', () => {
  it('no tiene borrados y cada herramienta tiene esquema JSON', () => {
    expect(catalog.some((t) => /^delete|remove/.test(t.name))).toBe(false)
    for (const t of catalog) {
      const schema = parametersOf(t)
      expect(schema.type).toBe('object')
      expect(schema.$schema).toBeUndefined()
    }
    expect(new Set(catalog.map((t) => t.name)).size).toBe(catalog.length)
  })

  it('filtra por módulos activos, sin quitar lo común', () => {
    const names = toolsFor(['tasks']).map((t) => t.name)
    expect(names).toContain('create_task')
    expect(names).toContain('overview')
    expect(names).not.toContain('create_transaction')
    expect(names).not.toContain('create_note')
    expect(toolsFor(null)).toHaveLength(catalog.length)
  })
})

describe('bucle de herramientas', () => {
  it('ejecuta, anota la actividad como assistant con contexto y ofrece deshacer', async () => {
    const app = await benchFixture()
    const events: AssistantEvent['type'][] = []
    const res = await runAssistant(say('crea una tarea'), {
      app,
      conversationId: 'c1',
      onEvent: (e) => events.push(e.type),
      provider: scripted([
        {
          calls: [
            { name: 'create_task', arguments: { project: 'muninn', title: 'Prueba F4 tarea' } },
          ],
        },
        { text: 'Hecha.' },
      ]),
    })
    expect(res.text).toBe('Hecha.')
    expect(res.tools.map((t) => [t.name, t.status, t.detail])).toEqual([
      ['create_task', 'ok', 'Prueba F4 tarea'],
    ])
    expect(events).toEqual(['tool', 'change', 'tool_done', 'text'])
    const [task] = await app.tasks.list({ search: 'Prueba F4' })
    expect(task?.source).toBe('mcp')
    const [created] = await app.recentActivity({ limit: 1 })
    expect(created).toMatchObject({ actor: 'assistant', action: 'created' })
    expect(created?.payload.context).toEqual({ conversation: 'c1', tool: 'create_task' })

    // «Deshacer» con el core del usuario: queda como `user` y la tarea, archivada.
    expect(res.changes).toHaveLength(1)
    await res.changes[0]?.undo(app)
    expect(await app.tasks.list({ search: 'Prueba F4' })).toHaveLength(0)
    expect((await app.recentActivity({ limit: 1 }))[0]).toMatchObject({
      actor: 'user',
      action: 'archived',
    })
  })

  it('devuelve los errores al modelo para que se corrija', async () => {
    const app = await benchFixture()
    const res = await runAssistant(say('x'), {
      app,
      provider: scripted([
        { calls: [{ name: 'create_task', arguments: { project: 'Inexistente', title: 'a' } }] },
        { calls: [{ name: 'create_task', arguments: { project: 'HuginnDB', title: 'a' } }] },
        { text: 'Corregido.' },
      ]),
    })
    expect(res.tools.map((t) => t.status)).toEqual(['error', 'ok'])
    expect(res.tools[0]?.error).toContain('Muninn, HuginnDB')
    expect(res.messages.find((m) => m.role === 'tool')?.content).toMatch(
      /^Error: No hay ningún proyecto/,
    )
  })

  it('argumentos inválidos y herramientas que no existen, como error; `null` en lo opcional se tolera', async () => {
    const app = await benchFixture()
    const res = await runAssistant(say('x'), {
      app,
      provider: scripted([
        {
          calls: [
            { name: 'delete_task', arguments: { taskId: 'x' } },
            { name: 'create_task', arguments: { project: 'Muninn' } },
            { name: 'create_task', arguments: { project: 'Muninn', title: 'b', dueDate: null } },
          ],
        },
        { text: 'Vale.' },
      ]),
    })
    expect(res.tools.map((t) => t.status)).toEqual(['error', 'error', 'ok'])
    expect(res.tools[0]?.error).toContain('no existe la herramienta')
    expect(res.tools[1]?.error).toContain('title')
  })

  it('no repite la misma escritura en un turno', async () => {
    const app = await benchFixture()
    const call = { name: 'create_task', arguments: { project: 'Muninn', title: 'Una sola' } }
    const res = await runAssistant(say('x'), {
      app,
      provider: scripted([{ calls: [call] }, { calls: [call] }, { text: 'Ok.' }]),
    })
    expect(res.tools.map((t) => t.status)).toEqual(['ok', 'ok'])
    expect(await app.tasks.list({ search: 'Una sola' })).toHaveLength(1)
    expect(res.changes).toHaveLength(1)
  })

  it('tras el máximo de vueltas obliga a contestar sin herramientas', async () => {
    const app = await benchFixture()
    const loop: ScriptedStep = {
      text: '',
      calls: [{ name: 'overview', arguments: {} }],
    }
    const res = await runAssistant(say('x'), {
      app,
      maxSteps: 2,
      provider: createScriptedProvider([
        { when: () => true, steps: [loop, loop, { text: 'Hasta aquí.' }] },
      ]),
    })
    expect(res.tools).toHaveLength(2)
    expect(res.stoppedAtLimit).toBe(true)
    expect(res.text).toBe('Hasta aquí.')
  })

  it('ignora herramientas de módulos que no se le ofrecen', async () => {
    const app = createMuninn(createMemoryStore())
    const res = await runAssistant(say('x'), {
      app,
      tools: toolsFor(['tasks']),
      provider: scripted([
        { calls: [{ name: 'create_transaction', arguments: { kind: 'expense', amount: 3 } }] },
        { text: 'No puedo.' },
      ]),
    })
    expect(res.tools[0]?.status).toBe('error')
  })

  it('deshacer de mover, completar y editar devuelve la tarea a como estaba', async () => {
    const app = await benchFixture()
    const [t] = await app.tasks.list({ search: 'Parquet' })
    if (!t) throw new Error('falta la tarea')
    const res = await runAssistant(say('x'), {
      app,
      provider: scripted([
        {
          calls: [
            { name: 'update_task', arguments: { taskId: t.id, priority: 'urgent', dueDate: null } },
            { name: 'complete_task', arguments: { taskId: t.id } },
          ],
        },
        { text: 'Ok.' },
      ]),
    })
    expect((await app.tasks.get(t.id)).priority).toBe('urgent')
    for (const c of [...res.changes].reverse()) await c.undo(app)
    const back = await app.tasks.get(t.id)
    expect(back).toMatchObject({
      columnId: t.columnId,
      priority: t.priority,
      dueDate: t.dueDate,
      completedAt: null,
    })
  })
})

describe('banco de pruebas (con el guion ideal)', () => {
  it('cubre las frases pedidas', () => {
    const phrases = BENCH.map((c) => c.say)
    expect(phrases).toContain('¿Cómo voy hoy?')
    expect(phrases).toContain('He gastado 24,90 en el cine')
    expect(phrases).toContain('¿Qué suscripciones me cobran esta semana?')
    expect(phrases.some((p) => /urgente en Muninn para el viernes/.test(p))).toBe(true)
  })

  it('el modelo perfecto pasa todos los casos', async () => {
    const rows = await runBench()
    const failed = rows.filter((r) => !r.pass).map((r) => `${r.id}: ${r.problems.join('; ')}`)
    expect(failed).toEqual([])
  })

  it('un modelo que se equivoca no pasa', async () => {
    const rows = await runBench(
      () =>
        scripted([
          { calls: [{ name: 'create_transaction', arguments: { kind: 'expense', amount: 2490 } }] },
          { text: 'Apuntado.' },
        ]),
      { only: ['gasto-cine', 'como-voy-hoy'] },
    )
    expect(rows.map((r) => r.pass)).toEqual([false, false])
    expect(rows.find((r) => r.id === 'gasto-cine')?.problems.join()).toContain('importe')
  })
})
