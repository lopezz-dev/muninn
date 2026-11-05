import { type ChatMessage, createScriptedProvider, lastToolResult } from '@muninn/assistant'
import type { OverviewReport } from '@muninn/core'
import { t } from '../i18n'

/**
 * Guion de la demo (ADR-0041): sin modelo, el asistente entiende unas pocas frases y usa las herramientas de verdad
 * sobre los datos en memoria. Sirve para ver cómo se ve la pantalla; con Ollama entiende cualquier cosa. Entiende las
 * frases en inglés y en español; contesta en el idioma de la interfaz. Los errores de las herramientas llegan del core.
 */

const errorOf = (messages: ChatMessage[]) => {
  const r = lastToolResult(messages)
  return typeof r === 'string' && r.startsWith('Error') ? r.replace(/^Error:\s*/, '') : null
}

/** Las frases de ejemplo, en el idioma activo (las sugerencias de la pantalla en la demo). */
export const demoExamples = () => [
  t('demo.examples.today', { ns: 'assistant' }),
  t('demo.examples.task', { ns: 'assistant' }),
  t('demo.examples.expense', { ns: 'assistant' }),
  t('demo.examples.subscriptions', { ns: 'assistant' }),
]

/** `delayMs`: pausa entre palabras para que se vea el streaming (0 en los tests). */
export function demoProvider(delayMs = 18) {
  return createScriptedProvider(
    [
      {
        when: /c[oó]mo voy|qu[eé] (tengo|me queda)|how am i|what do i have/i,
        steps: [
          { calls: [{ name: 'overview', arguments: {} }] },
          {
            text: (m) => {
              const o = lastToolResult(m) as OverviewReport | null
              if (!o || typeof o !== 'object') return t('demo.overviewFailed', { ns: 'assistant' })
              if (!o.projects.length) return t('demo.noProjects', { ns: 'assistant' })
              const parts = [
                t('demo.dueToday', { ns: 'assistant', count: o.dueToday.length }),
                t('demo.overdue', { ns: 'assistant', count: o.overdue.length }),
                t('demo.inProgress', { ns: 'assistant', n: o.inProgress.length }),
              ]
              const urgent = o.overdue[0] ?? o.dueToday[0]
              const first = urgent
                ? ` ${t('demo.first', { ns: 'assistant', title: urgent.title, project: urgent.projectName })}`
                : ''
              return `${parts.join(', ')}.${first}`
            },
          },
        ],
      },
      {
        when: /gast(ad)?o\s+[\d.,]+|spent\s+[\d.,]+/i,
        steps: [
          {
            calls: (m) => {
              const said = m.findLast((x) => x.role === 'user')?.content ?? ''
              const amount = /([\d.,]+)/.exec(said)?.[1] ?? '0'
              const concept = /\b(?:en|at|on) (?:el |la |los |las |the )?(.+?)[.!?]*$/i.exec(
                said,
              )?.[1]
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
                // Los errores llegan del core, en español.
                if (/desactivado/.test(error)) return t('demo.financeOff', { ns: 'assistant' })
                return /no hay cuentas/i.test(error)
                  ? t('demo.noAccounts', { ns: 'assistant' })
                  : t('demo.expenseFailed', { ns: 'assistant', error })
              }
              const r = lastToolResult(m) as { amountText?: string; account?: string }
              return t('demo.expenseLogged', {
                ns: 'assistant',
                amount: r.amountText ?? t('demo.theExpense', { ns: 'assistant' }),
                account: r.account ?? t('demo.yourAccount', { ns: 'assistant' }),
              })
            },
          },
        ],
      },
      {
        when: /suscrip|subscri/i,
        steps: [
          { calls: [{ name: 'list_subscriptions', arguments: { upcomingDays: 7 } }] },
          {
            text: (m) => {
              const list =
                (lastToolResult(m) as { name: string; amountText: string; nextDate: string }[]) ??
                []
              if (!Array.isArray(list) || !list.length)
                return t('demo.noSubscriptions', { ns: 'assistant' })
              const items = list.map((s) =>
                t('demo.subscription', {
                  ns: 'assistant',
                  name: s.name,
                  amount: s.amountText,
                  day: s.nextDate.slice(8),
                }),
              )
              return t('demo.subscriptions', { ns: 'assistant', list: items.join(', ') })
            },
          },
        ],
      },
      {
        when: /crea(r)?\s+(una\s+)?tarea|create\s+(a\s+)?task/i,
        steps: [
          { calls: [{ name: 'list_projects', arguments: {} }] },
          {
            calls: (m) => {
              const projects = (lastToolResult(m) as { name: string }[]) ?? []
              const said = m.findLast((x) => x.role === 'user')?.content ?? ''
              const title =
                /[:«"“](.+?)[»"”]?$/.exec(said)?.[1]?.trim() ??
                said.replace(/^.*?(?:tarea|task)\s*/i, '').trim()
              const project = Array.isArray(projects) ? projects[0]?.name : undefined
              return project
                ? [
                    {
                      name: 'create_task',
                      arguments: {
                        project,
                        title: title || t('demo.newTask', { ns: 'assistant' }),
                      },
                    },
                  ]
                : []
            },
            text: (m) => {
              const projects = lastToolResult(m)
              return Array.isArray(projects) && projects.length
                ? ''
                : t('demo.needProject', { ns: 'assistant' })
            },
          },
          {
            text: (m) => {
              const error = errorOf(m)
              const r = lastToolResult(m) as { title?: string } | null
              return error
                ? t('demo.taskFailed', { ns: 'assistant', error })
                : t('demo.taskCreated', {
                    ns: 'assistant',
                    title: r?.title ?? t('demo.theTask', { ns: 'assistant' }),
                  })
            },
          },
        ],
      },
    ],
    {
      delayMs,
      label: t('demo.label', { ns: 'assistant' }),
      fallback: t('demo.fallback', {
        ns: 'assistant',
        examples: demoExamples()
          .map((text) => t('demo.quoted', { ns: 'assistant', text }))
          .join(', '),
      }),
    },
  )
}
