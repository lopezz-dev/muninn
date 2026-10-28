import type { GithubRepoSummary, Muninn, Project } from '@muninn/core'
import { notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { fail, serial } from './mutations'
import { invalidateProjects } from './queries'

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

export interface RepoChoice {
  value: string
  label: string
  hint?: string
  disabled?: boolean
  tone?: string
}

const sameRepo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

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
  const options: RepoChoice[] = [{ value: '', label: 'Sin repositorio', tone: 'text-fg-muted' }]
  for (const r of repos) {
    const other = projects.find(
      (p) => p.id !== project.id && p.githubRepo && sameRepo(p.githubRepo, r.fullName),
    )
    options.push({
      value: r.fullName,
      label: r.fullName,
      hint: other ? `en ${other.name}` : r.private ? 'privado' : undefined,
      disabled: Boolean(other),
    })
  }
  if (!current) return { value: '', options }
  const listed = repos.find((r) => sameRepo(r.fullName, current))
  if (listed) return { value: listed.fullName, options }
  options.push({ value: current, label: current, hint: 'sin acceso del token' })
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
      fail('No se pudo comprobar el acceso del token', err)
      return false
    }
    if (writable === false) {
      notify.error(`El token no tiene acceso a ${repo.fullName}`, {
        description:
          'Dáselo en GitHub › Settings › Developer settings › Fine-grained tokens, y vuelve a elegirlo.',
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
  undo = false,
): Promise<boolean> {
  try {
    await serial(from.id, () => m.projects.update(from.id, { githubRepo: null }))
  } catch (err) {
    fail('No se pudo mover el repositorio', err)
    return false
  }
  try {
    await serial(to.id, () => m.projects.update(to.id, { githubRepo: repo }))
  } catch (err) {
    await serial(from.id, () => m.projects.update(from.id, { githubRepo: repo })).catch(() => {})
    await invalidateProjects(qc)
    fail('No se pudo mover el repositorio', err)
    return false
  }
  await invalidateProjects(qc)
  if (undo) {
    notify.info(`${repo} vuelve a «${to.name}»`)
  } else {
    notify.success(`${repo} va ahora con «${to.name}»`, {
      icon: 'link',
      description: `Ya no está vinculado a «${from.name}».`,
      action: {
        label: 'Deshacer',
        onClick: () => void moveProjectRepo(m, qc, to, from, repo, true),
      },
    })
  }
  return true
}

/** Vincula (o desvincula, con `null`) un repositorio a un proyecto, con aviso y «Deshacer». */
export async function setProjectRepo(
  m: Muninn,
  qc: QueryClient,
  project: Pick<Project, 'id' | 'name' | 'githubRepo'>,
  repo: string | null,
  undo = false,
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
      notify.error('Ese repositorio ya está vinculado a otro proyecto', {
        description: 'Cada repositorio va con un solo proyecto.',
      })
    } else fail('No se pudo guardar el repositorio', err)
    return false
  }
  const restore = () => setProjectRepo(m, qc, { ...project, githubRepo: repo }, prev, true)
  if (undo) {
    notify.info(repo ? `«${project.name}» vuelve a ${repo}` : `«${project.name}» sin repositorio`)
  } else {
    notify.success(
      repo ? `«${project.name}» vinculado a ${repo}` : `«${project.name}» ya no tiene repositorio`,
      { icon: 'link', action: { label: 'Deshacer', onClick: () => void restore() } },
    )
  }
  return true
}
