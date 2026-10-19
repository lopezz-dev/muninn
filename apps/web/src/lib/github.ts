import type { Muninn, Project } from '@muninn/core'
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
