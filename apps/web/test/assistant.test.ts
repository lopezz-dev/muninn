import { runAssistant } from '@muninn/assistant'
import { createMemoryStore, createMuninn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import { applyRun, HISTORY_TURNS, historyFor, IMAGE_ONLY_QUESTION } from '../src/lib/assistant-chat'
import { demoProvider } from '../src/lib/assistant-demo'
import {
  type Conversation,
  groupOf,
  MAX_CONVERSATIONS,
  titleFrom,
  upsertConversation,
} from '../src/lib/assistant-history'
import { base64Of } from '../src/lib/assistant-images'
import { assistantPrefs, DEFAULT_ASSISTANT, normalizeUrl } from '../src/lib/assistant-settings'
import { THINKING_PHRASES, TOOL_PHRASES } from '../src/screens/asistente/TurnView'

const conv = (id: string, updatedAt: string): Conversation => ({
  id,
  title: id,
  createdAt: updatedAt,
  updatedAt,
  turns: [],
})

describe('ajustes del asistente', () => {
  it('valida lo guardado y vuelve a los valores por defecto', () => {
    expect(assistantPrefs(undefined)).toEqual(DEFAULT_ASSISTANT)
    expect(
      assistantPrefs({
        preferences: { assistant: { ollamaUrl: 'http://pc.local:11434/', model: ' qwen3:14b ' } },
      }),
    ).toEqual({ ollamaUrl: 'http://pc.local:11434', model: 'qwen3:14b' })
    expect(
      assistantPrefs({
        preferences: { assistant: { ollamaUrl: 'javascript:alert(1)', model: 3 } },
      }),
    ).toEqual(DEFAULT_ASSISTANT)
    expect(normalizeUrl('ftp://x')).toBe(DEFAULT_ASSISTANT.ollamaUrl)
    expect(normalizeUrl('http://localhost:11434/api')).toBe(DEFAULT_ASSISTANT.ollamaUrl)
  })
})

describe('historial del asistente', () => {
  it('título de una línea y como mucho 60 caracteres', () => {
    expect(titleFrom('  ¿Cómo\nvoy hoy?  ')).toBe('¿Cómo voy hoy?')
    expect(titleFrom('x'.repeat(80))).toHaveLength(60)
    expect(titleFrom('   ')).toBe('Conversación')
  })

  it('la más reciente primero, sin repetir y sin pasar del máximo', () => {
    let list: Conversation[] = []
    for (let i = 0; i < MAX_CONVERSATIONS + 5; i++) {
      list = upsertConversation(
        list,
        conv(`c${i}`, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString()),
      )
    }
    expect(list).toHaveLength(MAX_CONVERSATIONS)
    expect(list[0]?.id).toBe(`c${MAX_CONVERSATIONS + 4}`)
    list = upsertConversation(list, conv('c10', '2026-10-30T00:00:00Z'))
    expect(list[0]?.id).toBe('c10')
    expect(list.filter((c) => c.id === 'c10')).toHaveLength(1)
  })

  it('agrupa en Hoy, Esta semana y Antes', () => {
    const now = new Date(2026, 9, 22, 18)
    expect(groupOf(new Date(2026, 9, 22, 8).toISOString(), now)).toBe('Hoy')
    expect(groupOf(new Date(2026, 9, 17, 8).toISOString(), now)).toBe('Esta semana')
    expect(groupOf(new Date(2026, 9, 10).toISOString(), now)).toBe('Antes')
  })
})

describe('chat', () => {
  it('al modelo solo le llegan preguntas y respuestas, sin errores y las últimas', () => {
    const turns = Array.from({ length: HISTORY_TURNS + 4 }, (_, i) => ({
      id: String(i),
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      text: `t${i}`,
      createdAt: '',
    }))
    turns.push({ id: 'e', role: 'assistant', text: 'roto', createdAt: '', error: 'x' } as never)
    const h = historyFor(turns)
    expect(h).toHaveLength(HISTORY_TURNS)
    expect(h.some((m) => m.content === 'roto')).toBe(false)
  })

  it('las imágenes de turnos anteriores no se vuelven a mandar (ADR-0051)', () => {
    const h = historyFor([
      {
        id: '1',
        role: 'user',
        text: IMAGE_ONLY_QUESTION,
        images: ['data:image/jpeg;base64,aGk='],
        createdAt: '',
      },
      { id: '2', role: 'assistant', text: 'Un ticket de 24,90 €.', createdAt: '' },
    ])
    expect(h).toEqual([
      { role: 'user', content: IMAGE_ONLY_QUESTION },
      { role: 'assistant', content: 'Un ticket de 24,90 €.' },
    ])
    expect(base64Of('data:image/jpeg;base64,aGk=')).toBe('aGk=')
  })

  it('frases de «pensando»: cortas, sin repetir y acabadas en «…»', () => {
    for (const list of [THINKING_PHRASES, TOOL_PHRASES]) {
      expect(new Set(list).size).toBe(list.length)
      for (const p of list) {
        expect(p.endsWith('…')).toBe(true)
        expect(p.length).toBeLessThanOrEqual(24)
      }
    }
  })

  it('aplica los eventos de herramientas por id', () => {
    const run = {
      id: '0.0',
      name: 'overview',
      title: 'R',
      access: 'read' as const,
      args: {},
      status: 'running' as const,
    }
    const a = applyRun(undefined, run)
    expect(applyRun(a, { ...run, status: 'ok' })).toEqual([{ ...run, status: 'ok' }])
    expect(applyRun(a, { ...run, id: '0.1' })).toHaveLength(2)
  })
})

describe('guion de la demo', () => {
  const ask = async (
    text: string,
    setup?: (m: ReturnType<typeof createMuninn>) => Promise<void>,
  ) => {
    const app = createMuninn(createMemoryStore())
    await setup?.(app)
    return {
      app,
      res: await runAssistant([{ role: 'user', content: text }], {
        app,
        provider: demoProvider(0),
      }),
    }
  }

  it('«¿Cómo voy hoy?» usa el resumen', async () => {
    const { res } = await ask('¿Cómo voy hoy?', async (m) => {
      const p = await m.projects.create({ name: 'Prueba F4' })
      await m.tasks.create({ projectId: p.id, title: 'Prueba F4 tarea', dueDate: m.today() })
    })
    expect(res.tools.map((t) => t.name)).toEqual(['overview'])
    expect(res.text).toContain('1 tarea para hoy')
  })

  it('apunta un gasto en euros y dice dónde', async () => {
    const { app, res } = await ask('He gastado 24,90 en el cine', async (m) => {
      await m.finance.accounts.create({ name: 'Prueba F4 Cuenta', kind: 'checking' })
    })
    expect(res.text).toMatch(/24,90\s€ en Prueba F4 Cuenta/)
    expect((await app.finance.transactions.list())[0]).toMatchObject({
      amount: 2490,
      concept: 'cine',
    })
  })

  it('sin cuentas, lo explica en vez de fallar', async () => {
    const { res } = await ask('He gastado 3 en café')
    expect(res.text).toContain('Finanzas › Cuentas')
  })

  it('crea la tarea en el primer proyecto', async () => {
    const { app, res } = await ask('Crea una tarea: Prueba F4 demo', async (m) => {
      await m.projects.create({ name: 'Prueba F4' })
    })
    expect(res.changes).toHaveLength(1)
    expect((await app.tasks.list({ search: 'Prueba F4 demo' }))[0]?.source).toBe('mcp')
  })

  it('lo demás: explica qué entiende', async () => {
    const { res } = await ask('Cuéntame un chiste')
    expect(res.text).toContain('En la demo no hay modelo')
    expect(res.tools).toHaveLength(0)
  })
})
