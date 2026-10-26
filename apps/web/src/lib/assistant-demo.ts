import { type ChatMessage, createScriptedProvider, lastToolResult } from '@muninn/assistant'
import type { OverviewReport } from '@muninn/core'

/**
 * Guion de la demo (ADR-0041): sin modelo, el asistente entiende unas pocas frases y usa las herramientas de verdad
 * sobre los datos en memoria. Sirve para ver cómo se ve la pantalla; con Ollama entiende cualquier cosa.
 */

const errorOf = (messages: ChatMessage[]) => {
  const r = lastToolResult(messages)
  return typeof r === 'string' && r.startsWith('Error') ? r.replace(/^Error:\s*/, '') : null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const DEMO_EXAMPLES = [
  '¿Cómo voy hoy?',
  'Crea una tarea: probar el asistente',
  'He gastado 24,90 en el cine',
  '¿Qué suscripciones me cobran esta semana?',
]

/** `delayMs`: pausa entre palabras para que se vea el streaming (0 en los tests). */
export function demoProvider(delayMs = 18) {
  return createScriptedProvider(
    [
      {
        when: /c[oó]mo voy|qu[eé] (tengo|me queda)/i,
        steps: [
          { calls: [{ name: 'overview', arguments: {} }] },
          {
            text: (m) => {
              const o = lastToolResult(m) as OverviewReport | null
              if (!o || typeof o !== 'object') return 'No he podido leer tu resumen.'
              if (!o.projects.length) {
                return 'Aún no tienes proyectos. Crea uno en Proyectos y te digo cómo vas.'
              }
              const parts = [
                `Tienes ${plural(o.dueToday.length, 'tarea', 'tareas')} para hoy`,
                `${plural(o.overdue.length, 'vencida', 'vencidas')}`,
                `${o.inProgress.length} en curso`,
              ]
              const urgent = o.overdue[0] ?? o.dueToday[0]
              return `${parts.join(', ')}.${urgent ? ` Lo primero: «${urgent.title}» (${urgent.projectName}).` : ''}`
            },
          },
        ],
      },
      {
        when: /gast(ad)?o\s+[\d.,]+/i,
        steps: [
          {
            calls: (m) => {
              const said = m.findLast((x) => x.role === 'user')?.content ?? ''
              const amount = /([\d.,]+)/.exec(said)?.[1] ?? '0'
              const concept = /\ben (?:el |la |los |las )?(.+?)[.!?]*$/i.exec(said)?.[1]
              return [
                {
                  name: 'create_transaction',
                  arguments: { kind: 'expense', amount, ...(concept ? { concept } : {}) },
                },
              ]
            },
          },
          {
            text: (m) => {
              const error = errorOf(m)
              if (error) {
                if (/desactivado/.test(error)) {
                  return 'Finanzas está desactivado: actívalo en Ajustes › Módulos y vuelve a decírmelo.'
                }
                return /no hay cuentas/i.test(error)
                  ? 'Aún no tienes ninguna cuenta: crea una en Finanzas › Cuentas y vuelve a decírmelo.'
                  : `No he podido apuntarlo: ${error}`
              }
              const t = lastToolResult(m) as { amountText?: string; account?: string }
              return `Apuntado: ${t.amountText ?? 'el gasto'} en ${t.account ?? 'tu cuenta'}.`
            },
          },
        ],
      },
      {
        when: /suscrip/i,
        steps: [
          { calls: [{ name: 'list_subscriptions', arguments: { upcomingDays: 7 } }] },
          {
            text: (m) => {
              const list =
                (lastToolResult(m) as { name: string; amountText: string; nextDate: string }[]) ??
                []
              if (!Array.isArray(list) || !list.length)
                return 'Esta semana no te cobran ninguna suscripción.'
              return `Esta semana: ${list.map((s) => `${s.name} (${s.amountText}, el ${s.nextDate.slice(8)})`).join(', ')}.`
            },
          },
        ],
      },
      {
        when: /crea(r)?\s+(una\s+)?tarea/i,
        steps: [
          { calls: [{ name: 'list_projects', arguments: {} }] },
          {
            calls: (m) => {
              const projects = (lastToolResult(m) as { name: string }[]) ?? []
              const said = m.findLast((x) => x.role === 'user')?.content ?? ''
              const title =
                /[:«"](.+?)[»"]?$/.exec(said)?.[1]?.trim() ??
                said.replace(/^.*?tarea\s*/i, '').trim()
              const project = Array.isArray(projects) ? projects[0]?.name : undefined
              return project
                ? [{ name: 'create_task', arguments: { project, title: title || 'Tarea nueva' } }]
                : []
            },
            text: (m) => {
              const projects = lastToolResult(m)
              return Array.isArray(projects) && projects.length
                ? ''
                : 'Primero necesitas un proyecto: créalo en Proyectos y te creo la tarea.'
            },
          },
          {
            text: (m) => {
              const error = errorOf(m)
              const t = lastToolResult(m) as { title?: string } | null
              return error
                ? `No he podido crearla: ${error}`
                : `Hecho: «${t?.title ?? 'la tarea'}» está en Pendiente.`
            },
          },
        ],
      },
    ],
    {
      delayMs,
      label: 'Demo · respuestas guionizadas',
      fallback: `En la demo no hay modelo: respondo con un guion a frases como ${DEMO_EXAMPLES.map((e) => `«${e}»`).join(', ')}. Con Ollama en tu ordenador entiende cualquier cosa.`,
    },
  )
}
