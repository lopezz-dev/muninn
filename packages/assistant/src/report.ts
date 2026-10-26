import {
  formatEuros,
  type Muninn,
  type NewsDigest,
  type OverviewReport,
  type UpcomingCharge,
  withActor,
} from '@muninn/core'
import { spokenDate } from './prompt'
import type { ChatProvider } from './provider'

/**
 * Informe de la mañana (ADR-0043): lo que hay que saber al empezar el día, en Markdown. La parte con datos es fija y
 * se calcula sin modelo (se puede comprobar y no inventa nada); el modelo, si está, solo añade una entradilla.
 */

export interface MorningReportData {
  today: string
  /** Sin el módulo de tareas, `null`. */
  overview: OverviewReport | null
  /** Cobros de los próximos días (y vencidos); sin Finanzas, `null`. */
  charges: UpcomingCharge[] | null
  /** El resumen de noticias de hoy; sin Noticias o sin resumen, `null`. */
  digest: NewsDigest | null
  /** Cuándo se genera de verdad y a qué hora tocaba (HH:MM): si va tarde, se dice. */
  generatedAt: Date
  scheduledTime: string
  timeZone?: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const when = (days: number) =>
  days < 0
    ? `vencido hace ${plural(-days, 'día', 'días')}`
    : days === 0
      ? 'hoy'
      : days === 1
        ? 'mañana'
        : `en ${days} días`

/** «08:30» en la zona del usuario. */
export function clockOf(d: Date, timeZone?: string) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(d)
}

/** Minutos entre la hora a la que tocaba y la de verdad; positivo si va tarde. */
export function minutesLate(scheduled: string, actual: string) {
  const [sh = 0, sm = 0] = scheduled.split(':').map(Number)
  const [ah = 0, am = 0] = actual.split(':').map(Number)
  return ah * 60 + am - (sh * 60 + sm)
}

export function reportTitle(today: string) {
  const d = new Date(`${today}T12:00:00Z`)
  const day = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d)
  return `Informe de la mañana · ${day}`
}

/** El cuerpo del informe, solo con datos. Las secciones de módulos desactivados no salen. */
export function buildMorningReport(data: MorningReportData): string {
  const out: string[] = []
  const at = clockOf(data.generatedAt, data.timeZone)
  const late = minutesLate(data.scheduledTime, at)
  out.push(
    late > 15
      ? `_Hecho a las ${at}: a las ${data.scheduledTime} el ordenador estaba apagado o Muninn cerrado._`
      : `_Hecho a las ${at}, ${spokenDate(data.today).replace(/ \(.*\)$/, '')}._`,
  )

  if (data.overview) {
    const o = data.overview
    out.push('', '## Tareas')
    if (!o.dueToday.length && !o.overdue.length && !o.inProgress.length) {
      out.push('Nada para hoy ni vencido. Buen momento para adelantar algo.')
    }
    if (o.overdue.length) {
      out.push('', `**Vencidas (${o.overdue.length})**`)
      for (const t of o.overdue.slice(0, 8))
        out.push(`- ${t.title} · ${t.projectName} · desde el ${t.dueDate}`)
    }
    if (o.dueToday.length) {
      out.push('', `**Para hoy (${o.dueToday.length})**`)
      for (const t of o.dueToday.slice(0, 8)) out.push(`- ${t.title} · ${t.projectName}`)
    }
    if (o.inProgress.length) {
      out.push('', `**En curso (${o.inProgress.length})**`)
      for (const t of o.inProgress.slice(0, 5)) out.push(`- ${t.title} · ${t.projectName}`)
    }
  }

  if (data.charges) {
    out.push('', '## Cobros próximos')
    if (!data.charges.length) out.push('Ningún cobro de suscripciones en los próximos días.')
    for (const c of data.charges)
      out.push(`- ${c.name} · ${formatEuros(c.amount)} · ${when(c.daysUntil)}`)
  }

  if (data.digest) {
    out.push('', '## Noticias', data.digest.content.trim())
  }
  return out.join('\n')
}

/**
 * Una entradilla de una o dos frases escrita por el modelo a partir del informe (sin herramientas). Si falla o tarda
 * más de `timeoutMs`, `null`: el informe sale igual, sin ella.
 */
export async function reportIntro(
  provider: ChatProvider,
  body: string,
  timeoutMs = 60_000,
): Promise<string | null> {
  const signal = AbortSignal.timeout(timeoutMs)
  let text = ''
  try {
    for await (const chunk of provider.chat({
      signal,
      messages: [
        {
          role: 'system',
          content:
            'Eres Muninn, el asistente personal del usuario. Con su informe de la mañana, escribe UNA o DOS frases en español, de tú, con lo más importante del día (lo urgente primero). Sin saludos largos ni listas, y sin inventar nada que no esté en el informe.',
        },
        { role: 'user', content: body },
      ],
    })) {
      if (chunk.type === 'text') text += chunk.text
    }
  } catch {
    return null
  }
  const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  return clean ? clean.slice(0, 500) : null
}

/**
 * Guarda el informe como **nota fijada** (se lee en cualquier dispositivo y la busca el MCP) con actor `assistant`, y
 * desfija el del día anterior para que solo quede arriba el último. Devuelve la nota.
 */
export async function saveMorningReport(
  app: Muninn,
  report: { title: string; content: string; previousNoteId?: string | null },
) {
  const assistant = withActor(app, 'assistant', { activityContext: () => ({ report: 'morning' }) })
  const note = await assistant.notes.create({
    title: report.title,
    content: report.content,
    pinned: true,
  })
  if (report.previousNoteId && report.previousNoteId !== note.id) {
    await assistant.notes.update(report.previousNoteId, { pinned: false }).catch(() => {})
  }
  return note
}
