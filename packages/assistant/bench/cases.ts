import type { Muninn } from '@muninn/core'
import type { RunResult } from '../src/agent'
import type { ScriptedStep } from '../src/providers/scripted'
import { lastToolResult } from '../src/providers/scripted'

/**
 * Banco de pruebas del asistente (ADR-0041): frases en español, lo que el modelo debería llamar y cómo deben quedar
 * los datos. Con el proveedor guionizado (`ideal`, el «modelo perfecto») corre en `pnpm test`; con Ollama, en
 * `pnpm --filter @muninn/assistant bench` (fase final, en el ordenador con el modelo). Hoy es jueves 22-10-2026.
 */
export interface BenchCase {
  id: string
  say: string
  /** Herramientas que tiene que llamar, en cualquier orden (`a|b`: una de las dos). Puede llamar más de lectura. */
  calls: string[]
  /** Herramientas que no debe llamar. Ninguna de escritura que no esté en `calls`, siempre. */
  forbid?: string[]
  /** Comprobaciones de argumentos: `null` si está bien, o el problema. */
  args?: Record<string, (args: Record<string, unknown>) => string | null>
  /** Cómo deben quedar los datos: `null` si está bien, o el problema. */
  check?: (app: Muninn) => Promise<string | null>
  /** Lo que haría un modelo perfecto (para el proveedor guionizado). */
  ideal: ScriptedStep[]
}

const euros = (v: unknown) => String(v).replace(/\s|€/g, '').replace(',', '.')
const first = (messages: Parameters<typeof lastToolResult>[0]) =>
  ((lastToolResult(messages) as { id: string }[] | null) ?? [])[0]?.id ?? ''

export const BENCH: BenchCase[] = [
  {
    id: 'como-voy-hoy',
    say: '¿Cómo voy hoy?',
    calls: ['overview'],
    ideal: [
      { calls: [{ name: 'overview', arguments: {} }] },
      {
        text: 'Tienes 1 tarea para hoy («Montar el asistente», en curso) y 2 vencidas: la firma de macOS en HuginnDB y el ADR de voz.',
      },
    ],
  },
  {
    id: 'tarea-urgente-viernes',
    say: 'Crea una tarea urgente en Muninn para el viernes: revisar el banco de pruebas',
    calls: ['create_task'],
    args: {
      create_task: (a) =>
        String(a.project).toLowerCase() !== 'muninn'
          ? `proyecto ${a.project}`
          : a.priority !== 'urgent'
            ? `prioridad ${a.priority}`
            : a.dueDate !== '2026-10-23'
              ? `fecha ${a.dueDate}`
              : null,
    },
    check: async (app) => {
      const [t] = await app.tasks.list({ search: 'banco de pruebas' })
      return !t
        ? 'no se creó la tarea'
        : t.priority !== 'urgent' || t.dueDate !== '2026-10-23'
          ? `tarea con ${t.priority} y ${t.dueDate}`
          : null
    },
    ideal: [
      {
        calls: [
          {
            name: 'create_task',
            arguments: {
              project: 'Muninn',
              title: 'Revisar el banco de pruebas',
              priority: 'urgent',
              dueDate: '2026-10-23',
            },
          },
        ],
      },
      { text: 'Hecho: «Revisar el banco de pruebas» en Muninn, urgente, para el viernes 23.' },
    ],
  },
  {
    id: 'gasto-cine',
    say: 'He gastado 24,90 en el cine',
    calls: ['create_transaction'],
    args: {
      create_transaction: (a) =>
        a.kind !== 'expense'
          ? `tipo ${a.kind}`
          : euros(a.amount) !== '24.90' && euros(a.amount) !== '24.9'
            ? `importe ${a.amount}`
            : null,
    },
    check: async (app) => {
      const [t] = await app.finance.transactions.list({ kinds: ['expense'] })
      return t?.amount === 2490 ? null : `el último gasto es de ${t?.amount} céntimos`
    },
    ideal: [
      {
        calls: [
          {
            name: 'create_transaction',
            arguments: { kind: 'expense', amount: '24,90', category: 'Ocio', concept: 'Cine' },
          },
        ],
      },
      { text: 'Apuntado: 24,90 € de cine en Ocio, en tu cuenta Imagin.' },
    ],
  },
  {
    id: 'suscripciones-semana',
    say: '¿Qué suscripciones me cobran esta semana?',
    calls: ['list_subscriptions'],
    ideal: [
      { calls: [{ name: 'list_subscriptions', arguments: { upcomingDays: 7 } }] },
      {
        text: 'Esta semana te cobran Vercel Pro (20,00 €, mañana) y Netflix (12,99 €, el domingo).',
      },
    ],
  },
  {
    id: 'cuanto-tengo',
    say: '¿Cuánto dinero tengo?',
    calls: ['list_finance_accounts'],
    ideal: [
      { calls: [{ name: 'list_finance_accounts', arguments: {} }] },
      { text: 'Tienes 1.181,50 € en Imagin y 0,00 € en la Hucha.' },
    ],
  },
  {
    id: 'ocio-este-mes',
    say: '¿Cuánto he gastado en ocio este mes?',
    calls: ['list_transactions|finance_month_report'],
    ideal: [
      { calls: [{ name: 'list_transactions', arguments: { category: 'Ocio', month: '2026-10' } }] },
      { text: 'Este mes llevas 18,50 € en ocio (el concierto del día 5).' },
    ],
  },
  {
    id: 'estado-huginn',
    say: '¿Qué tal va HuginnDB?',
    calls: ['project_status'],
    args: {
      project_status: (a) =>
        String(a.project).toLowerCase().includes('huginn') ? null : `proyecto ${a.project}`,
    },
    ideal: [
      { calls: [{ name: 'project_status', arguments: { project: 'HuginnDB' } }] },
      {
        text: 'HuginnDB tiene 2 tareas abiertas: la firma de macOS está vencida desde el 17 y Parquet sigue en curso.',
      },
    ],
  },
  {
    id: 'completar-por-nombre',
    say: 'Ya he terminado la firma de macOS, márcala como hecha',
    calls: ['complete_task'],
    check: async (app) => {
      const [t] = await app.tasks.list({ search: 'macOS' })
      return t?.column.kind === 'done' ? null : `la tarea está en ${t?.column.name}`
    },
    ideal: [
      { calls: [{ name: 'list_tasks', arguments: { search: 'macOS' } }] },
      { calls: (m) => [{ name: 'complete_task', arguments: { taskId: first(m) } }] },
      { text: 'Listo: «Firma y notarización en macOS» está en Hecho.' },
    ],
  },
  {
    id: 'nota-ideas',
    say: 'Apúntame una nota «Ideas para Jarvis»: probar Whisper para dictar',
    calls: ['create_note'],
    check: async (app) =>
      (await app.notes.list({ search: 'Whisper' })).length ? null : 'no hay nota con «Whisper»',
    ideal: [
      {
        calls: [
          {
            name: 'create_note',
            arguments: { title: 'Ideas para Jarvis', content: '- Probar Whisper para dictar' },
          },
        ],
      },
      { text: 'He creado la nota «Ideas para Jarvis».' },
    ],
  },
  {
    id: 'borrar-no',
    say: 'Borra la tarea «Escribir el ADR de voz»',
    calls: [],
    forbid: ['complete_task'],
    check: async (app) =>
      (await app.tasks.list({ search: 'ADR de voz', includeArchived: true })).length
        ? null
        : 'la tarea ya no existe',
    ideal: [
      {
        text: 'No puedo borrar tareas, pero puedo archivarla para que deje de verse. ¿La archivo?',
      },
    ],
  },
]

export interface BenchVerdict {
  id: string
  pass: boolean
  problems: string[]
}

/** Compara lo que hizo el modelo con lo esperado. Lo mismo para el guion que para Ollama. */
export async function evaluate(
  c: BenchCase,
  result: RunResult,
  app: Muninn,
): Promise<BenchVerdict> {
  const problems: string[] = []
  const ok = result.tools.filter((t) => t.status === 'ok')
  const called = new Set(ok.map((t) => t.name))
  const expected = c.calls.flatMap((x) => x.split('|'))
  for (const name of c.calls) {
    if (!name.split('|').some((n) => called.has(n))) problems.push(`no llamó a ${name}`)
  }
  for (const name of c.forbid ?? []) if (called.has(name)) problems.push(`llamó a ${name}`)
  for (const t of ok) {
    if (t.access === 'write' && !expected.includes(t.name)) problems.push(`escribió con ${t.name}`)
    const check = c.args?.[t.name]
    const issue = check?.(t.args)
    if (issue) problems.push(`${t.name}: ${issue}`)
  }
  const data = await c.check?.(app)
  if (data) problems.push(data)
  if (!result.text) problems.push('no contestó con texto')
  return { id: c.id, pass: problems.length === 0, problems }
}
