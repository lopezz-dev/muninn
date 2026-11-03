import type { Activity, ActorKind } from '@muninn/core'
import { i18n, t } from '../i18n'

// Los textos viven en `home` (ADR-0077), un namespace diferido. Lo usa también el historial del detalle de tarea, que
// puede pintarse sin haber pasado por Inicio: se pide al cargar este módulo, antes de que llegue la actividad.
void i18n.loadNamespaces('home')

/** Quién hizo algo, para el historial de una tarea. */
export const actorName = (actor: ActorKind) =>
  actor === 'user' || actor === 'assistant' || actor === 'agent'
    ? t(`activity.actor.${actor}`, { ns: 'home' })
    : actor === 'mcp'
      ? 'Claude'
      : actor === 'github'
        ? 'GitHub'
        : 'Muninn'

const VERBS = [
  'created',
  'moved',
  'completed',
  'reopened',
  'archived',
  'restored',
  'deleted',
  'updated',
] as const
type Verb = (typeof VERBS)[number]
const isVerb = (action: string): action is Verb => (VERBS as readonly string[]).includes(action)

const FIELDS = ['title', 'description', 'priority', 'labels', 'dueDate'] as const
type Field = (typeof FIELDS)[number]
const isField = (key: string): key is Field => (FIELDS as readonly string[]).includes(key)

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : t('activity.list', {
        ns: 'home',
        items: items.slice(0, -1).join(', '),
        last: items[items.length - 1] ?? '',
      })

/** «moviste la tarea de Pendiente a En curso», «Claude cambió el título». Sin el nombre del actor. */
export function describeActivity(a: Pick<Activity, 'action' | 'actor' | 'payload'>): string {
  // [segunda persona (tú), tercera (otro actor)]
  const verb = isVerb(a.action)
    ? t(`activity.verb.${a.action}.${a.actor === 'user' ? 'you' : 'other'}`, { ns: 'home' })
    : a.action
  const p = a.payload as { from?: string; to?: string; number?: number }
  const pr = p.number
    ? t('activity.pr', { ns: 'home', number: p.number })
    : t('activity.prUnknown', { ns: 'home' })
  switch (a.action) {
    // Columna «Para el agente» (ADR-0032): el actor es el agente o GitHub, nunca tú.
    case 'agent_pr_opened':
      return t('activity.agentPrOpened', { ns: 'home', pr })
    case 'agent_pr_merged':
      return t('activity.agentPrMerged', { ns: 'home', pr })
    case 'agent_pr_closed':
      return t('activity.agentPrClosed', { ns: 'home', pr })
    case 'agent_stopped':
      return t('activity.agentStopped', { ns: 'home' })
    case 'moved':
      return p.from && p.to
        ? t('activity.moved', { ns: 'home', verb, from: p.from, to: p.to })
        : t('activity.movedColumn', { ns: 'home', verb })
    case 'updated': {
      const fields = Object.keys(a.payload)
        .filter(isField)
        .map((k) => t(`activity.field.${k}`, { ns: 'home' }))
      return fields.length
        ? t('activity.fields', { ns: 'home', verb, fields: list(fields) })
        : t('activity.task', { ns: 'home', verb })
    }
    case 'created':
    case 'completed':
    case 'reopened':
    case 'archived':
    case 'restored':
    case 'deleted':
      return t('activity.task', { ns: 'home', verb })
    default:
      return verb
  }
}

/** El enlace al PR de un evento del agente, si es de GitHub (nunca se enlaza una URL cualquiera). */
export function activityLink(a: Pick<Activity, 'payload'>): string | null {
  const url = (a.payload as { url?: unknown }).url
  return typeof url === 'string' && url.startsWith('https://github.com/') ? url : null
}
