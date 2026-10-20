import type { Activity, ActorKind } from '@muninn/core'

/** Quién hizo algo, para el historial de una tarea. */
export const actorName = (actor: ActorKind) =>
  actor === 'user'
    ? 'Tú'
    : actor === 'mcp'
      ? 'Claude'
      : actor === 'agent'
        ? 'Un agente'
        : actor === 'github'
          ? 'GitHub'
          : 'Muninn'

/** [segunda persona (tú), tercera (otro actor)] */
const VERBS: Record<string, [string, string]> = {
  created: ['creaste', 'creó'],
  moved: ['moviste', 'movió'],
  completed: ['completaste', 'completó'],
  reopened: ['reabriste', 'reabrió'],
  archived: ['archivaste', 'archivó'],
  restored: ['recuperaste', 'recuperó'],
  updated: ['cambiaste', 'cambió'],
}

const FIELDS: Record<string, string> = {
  title: 'el título',
  description: 'la descripción',
  priority: 'la prioridad',
  labels: 'las etiquetas',
  dueDate: 'la fecha de vencimiento',
}

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`

/** «moviste la tarea de Pendiente a En curso», «Claude cambió el título». Sin el nombre del actor. */
export function describeActivity(a: Pick<Activity, 'action' | 'actor' | 'payload'>): string {
  const verb = VERBS[a.action]?.[a.actor === 'user' ? 0 : 1] ?? a.action
  const p = a.payload as { from?: string; to?: string; number?: number }
  const pr = p.number ? `el PR #${p.number}` : 'el PR'
  switch (a.action) {
    // Columna «Para el agente» (ADR-0032): el actor es el agente o GitHub, nunca tú.
    case 'agent_pr_opened':
      return `abrió ${pr} y pasó la tarea a revisión`
    case 'agent_pr_merged':
      return `completó la tarea al fusionarse ${pr}`
    case 'agent_pr_closed':
      return `devolvió la tarea: ${pr} se cerró sin fusionar`
    case 'agent_stopped':
      return 'sacó la tarea del agente: terminó sin abrir un PR'
    case 'moved':
      return p.from && p.to
        ? `${verb} la tarea de ${p.from} a ${p.to}`
        : `${verb} la tarea de columna`
    case 'updated': {
      const fields = Object.keys(a.payload)
        .map((k) => FIELDS[k])
        .filter((f): f is string => Boolean(f))
      return fields.length ? `${verb} ${list(fields)}` : `${verb} la tarea`
    }
    case 'created':
    case 'completed':
    case 'reopened':
    case 'archived':
    case 'restored':
      return `${verb} la tarea`
    default:
      return verb
  }
}

/** El enlace al PR de un evento del agente, si es de GitHub (nunca se enlaza una URL cualquiera). */
export function activityLink(a: Pick<Activity, 'payload'>): string | null {
  const url = (a.payload as { url?: unknown }).url
  return typeof url === 'string' && url.startsWith('https://github.com/') ? url : null
}
