import type { GithubRepoSummary, Muninn, Project } from '@muninn/core'
import { notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { t } from '../i18n'
import { notifyUndo } from './feedback'
import { fail, serial } from './mutations'
import { invalidateProjects } from './queries'
import { sameRepo } from './text'

/** Mismo formato que valida el core (`githubRepo` en schemas.ts). */
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

/**
 * Lo que se escribe en el campo de repositorio, a `owner/repo`. Acepta también la URL que se copia de
 * GitHub (`https://github.com/owner/repo`, con `.git` o una ruta detrás). Vacío → `null` (desvincular);
 * algo que no se entiende → `undefined`.
 */
export function parseRepoInput(input: string): string | null | undefined {
  let s = input.trim()
  if (!s) return null
  s = s.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').replace(/^git@github\.com:/i, '')
  const [owner, repo] = s.split(/[/?#]/)
  const name = `${owner ?? ''}/${(repo ?? '').replace(/\.git$/i, '')}`
  return REPO.test(name) ? name : undefined
}

type ProjectRepo = Pick<Project, 'id' | 'name' | 'githubRepo'>

/** El servidor exige el segundo factor para vincular un repo (ADR-0062): el trigger responde con este mensaje. */
export function isMfaRequired(err: unknown): boolean {
  return err instanceof Error && /segundo factor|mfa_required/i.test(err.message)
}

export interface RepoChoice {
  value: string
  label: string
  hint?: string
  disabled?: boolean
  tone?: string
}

/**
 * Lo que ofrece el selector de repo de `project`: «Sin repositorio» (`''`) y los repos a los que llega el
 * token. Los que ya van con otro proyecto salen deshabilitados (uno por proyecto). Si el vinculado no está
 * en la lista (se escribió a mano, o el token ya no llega), se añade al final para que se siga viendo.
 * `value` es el elegido, con las mayúsculas de GitHub.
 */
export function repoChoices(
  project: ProjectRepo,
  projects: ProjectRepo[],
  repos: GithubRepoSummary[],
): { value: string; options: RepoChoice[] } {
  const current = project.githubRepo
  const options: RepoChoice[] = [{ value: '', label: t('github.noRepo'), tone: 'text-fg-muted' }]
  for (const r of repos) {
    const other = projects.find(
      (p) => p.id !== project.id && p.githubRepo && sameRepo(p.githubRepo, r.fullName),
    )
    options.push({
      value: r.fullName,
      label: r.fullName,
      hint: other
        ? t('github.inProject', { name: other.name })
        : r.private
          ? t('github.private')
          : undefined,
      disabled: Boolean(other),
    })
  }
  if (!current) return { value: '', options }
  const listed = repos.find((r) => sameRepo(r.fullName, current))
  if (listed) return { value: listed.fullName, options }
  options.push({ value: current, label: current, hint: t('github.noTokenAccess') })
  return { value: current, options }
}

/**
 * Vincula el repo elegido en el selector (o ninguno, con `null`). Los públicos salen en la lista aunque el token
 * no llegue a ellos (ADR-0035): antes de vincular uno se pregunta, y si no llega se avisa y no se vincula.
 */
export async function pickProjectRepo(
  m: Muninn,
  qc: QueryClient,
  project: Pick<Project, 'id' | 'name' | 'githubRepo'>,
  repo: GithubRepoSummary | null,
): Promise<boolean> {
  if (
    repo &&
    !repo.private &&
    (!project.githubRepo || !sameRepo(project.githubRepo, repo.fullName))
  ) {
    let writable: boolean | null
    try {
      writable = await m.github.canWrite(repo.fullName)
    } catch (err) {
      fail(t('github.checkFailed'), err)
      return false
    }
    if (writable === false) {
      notify.error(t('github.noAccess', { repo: repo.fullName }), {
        description: t('github.noAccessHint'),
      })
      return false
    }
  }
  return setProjectRepo(m, qc, project, repo?.fullName ?? null)
}

type RepoProject = Pick<Project, 'id' | 'name'>

/**
 * Pasa el repo de un proyecto a otro (pantalla GitHub), con aviso y «Deshacer». Primero se desvincula del
 * primero (un repo va con un solo proyecto); si el segundo paso falla, se intenta devolverlo a donde estaba.
 */
export async function moveProjectRepo(
  m: Muninn,
  qc: QueryClient,
  from: RepoProject,
  to: RepoProject,
  repo: string,
  undoing = false,
): Promise<boolean> {
  try {
    await serial(from.id, () => m.projects.update(from.id, { githubRepo: null }))
  } catch (err) {
    fail(t('github.moveFailed'), err)
    return false
  }
  try {
    await serial(to.id, () => m.projects.update(to.id, { githubRepo: repo }))
  } catch (err) {
    await serial(from.id, () => m.projects.update(from.id, { githubRepo: repo })).catch(() => {})
    await invalidateProjects(qc)
    fail(t('github.moveFailed'), err)
    return false
  }
  await invalidateProjects(qc)
  if (undoing) return true
  notifyUndo(t('github.moved', { repo, project: to.name }), {
    icon: 'link',
    description: t('github.movedHint', { project: from.name }),
    undo: () => moveProjectRepo(m, qc, to, from, repo, true),
    undone: t('github.movedBack', { repo, project: from.name }),
  })
  return true
}

/** Vincula (o desvincula, con `null`) un repositorio a un proyecto, con aviso y «Deshacer». */
export async function setProjectRepo(
  m: Muninn,
  qc: QueryClient,
  project: Pick<Project, 'id' | 'name' | 'githubRepo'>,
  repo: string | null,
  undoing = false,
): Promise<boolean> {
  const prev = project.githubRepo
  if (prev === repo) return true
  try {
    await serial(project.id, () => m.projects.update(project.id, { githubRepo: repo }))
    await invalidateProjects(qc)
  } catch (err) {
    const duplicate =
      err instanceof Error && /projects_owner_repo_uq|duplicate key/i.test(err.message)
    if (duplicate) {
      notify.error(t('github.duplicate'), { description: t('github.duplicateHint') })
    } else if (isMfaRequired(err)) {
      notify.error(t('github.mfaRequired'), { description: t('github.mfaRequiredHint') })
    } else fail(t('github.saveFailed'), err)
    return false
  }
  if (undoing) return true
  notifyUndo(
    repo
      ? t('github.linked', { project: project.name, repo })
      : t('github.unlinked', { project: project.name }),
    {
      icon: 'link',
      undo: () => setProjectRepo(m, qc, { ...project, githubRepo: repo }, prev, true),
      undone: prev
        ? t('github.linkedBack', { project: project.name, repo: prev })
        : t('github.unlinkedBack', { project: project.name }),
    },
  )
  return true
}
