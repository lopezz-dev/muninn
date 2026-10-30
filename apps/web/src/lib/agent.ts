import type { BoardColumn, Muninn, Project, TaskWithColumn } from '@muninn/core'
import { type QueryClient, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { notifyUndo } from './feedback'
import { useEnabledModules } from './modules'
import { useMuninn } from './muninn'
import { fail, serial } from './mutations'
import { invalidateProjects, projectQuery } from './queries'

/**
 * Columna «Para el agente» (ADR-0032): mover ahí una tarea de GitHub etiqueta su issue, y la Claude Code
 * GitHub Action del repo la resuelve en un PR. Aquí, lo que necesita la interfaz.
 */

export const AGENT_ONLY_GITHUB = 'Solo las tareas de GitHub pueden ir al agente'

/** Se ofrece en proyectos con repo y con el módulo GitHub activado; nunca en una columna «Hecho». */
export const canBeAgentColumn = (
  project: Pick<Project, 'githubRepo'> | undefined,
  githubOn: boolean,
  column: Pick<BoardColumn, 'kind'>,
) => Boolean(project?.githubRepo) && githubOn && column.kind !== 'done'

/** ¿Hay que impedir soltar esta tarea en esa columna? (La del agente solo admite tareas de una issue.) */
export const blocksAgentDrop = (
  project: Pick<Project, 'agentColumnId'> | undefined,
  task: Pick<TaskWithColumn, 'source' | 'externalId'>,
  columnId: string,
) =>
  Boolean(project?.agentColumnId) &&
  project?.agentColumnId === columnId &&
  (task.source !== 'github' || !task.externalId)

/** La columna del agente de un proyecto (o `null`) y si se puede usar, leyendo la caché del proyecto. */
export function useAgentColumn(projectId: string) {
  const m = useMuninn()
  const project = useQuery(projectQuery(m, projectId)).data
  const modules = useEnabledModules()
  const githubOn = modules?.has('github') ?? false
  return useMemo(
    () => ({
      project,
      githubOn,
      // Sin módulo o sin repo no se pinta como del agente (la etiqueta no llegaría a ningún sitio).
      columnId: project?.githubRepo && githubOn ? (project.agentColumnId ?? null) : null,
    }),
    [project, githubOn],
  )
}

/**
 * Marca como del agente la columna `columnId` del proyecto (o ninguna, con `null`), con aviso y «Deshacer».
 * `columns` son las del proyecto, para nombrarlas en el aviso.
 */
export async function setAgentColumn(
  m: Muninn,
  qc: QueryClient,
  project: Pick<Project, 'id' | 'agentColumnId'>,
  columns: Pick<BoardColumn, 'id' | 'name'>[],
  columnId: string | null,
  undoing = false,
): Promise<boolean> {
  const prev = project.agentColumnId ?? null
  if (prev === columnId) return true
  try {
    await serial(project.id, () => m.projects.update(project.id, { agentColumnId: columnId }))
    await invalidateProjects(qc)
  } catch (err) {
    fail('No se pudo cambiar la columna del agente', err)
    return false
  }
  if (undoing) return true
  const nameOf = (id: string | null) => columns.find((c) => c.id === id)?.name
  const name = nameOf(columnId)
  const prevName = nameOf(prev)
  notifyUndo(name ? `«${name}» es ahora la columna del agente` : 'Ya no hay columna del agente', {
    icon: 'agent',
    description: name
      ? 'Lo que muevas aquí desde GitHub se etiqueta para que lo resuelva el agente.'
      : undefined,
    undo: () =>
      setAgentColumn(m, qc, { id: project.id, agentColumnId: columnId }, columns, prev, true),
    undone: prevName
      ? `«${prevName}» vuelve a ser la columna del agente`
      : 'Sin columna del agente',
  })
  return true
}

// ─── Que no espere al cron ───────────────────────────────────────────────────

let flushTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Tras mover una tarea de GitHub, pide a la Edge Function que vacíe la cola ya (cerrar la issue, poner la
 * etiqueta del agente) en lugar de esperar al cron de 5 minutos. Agrupa los cambios seguidos en una sola
 * llamada; si falla, no pasa nada: el cron lo lleva igual.
 */
export function flushGithubSoon(m: Muninn, delay = 1500) {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    void m.github.syncNow('outbox').catch(() => {})
  }, delay)
}
