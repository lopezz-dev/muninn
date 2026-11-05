import type { GithubRepoSummary, Project } from '@muninn/core'
import { Button, ColorDot, cn, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { EmptyState } from '../../components/Page'
import { SelectMenu } from '../../components/SelectMenu'
import { timeAgo } from '../../lib/dates'
import { parseRepoInput, pickProjectRepo, repoChoices, setProjectRepo } from '../../lib/github'
import { useEnabledModules } from '../../lib/modules'
import { useAuth, useMuninn } from '../../lib/muninn'
import { githubReposQuery, projectsQuery } from '../../lib/queries'
import { PrefGroup } from './ui'

/** Lo que se sabe de la sincronización mirando los datos: cuántas tareas han llegado de GitHub y cuándo. */
function useGithubActivity() {
  const m = useMuninn()
  return useQuery({
    queryKey: ['tasks', 'github-status'],
    queryFn: async () => {
      const tasks = await m.tasks.list({ source: 'github', includeArchived: true })
      const last = tasks.reduce<string | null>(
        (max, t) => (max === null || t.updatedAt > max ? t.updatedAt : max),
        null,
      )
      return { count: tasks.length, last }
    },
  })
}

/** Fila de un proyecto: su nombre y, a la derecha, el selector o el campo. */
function RepoRow({ project, children }: { project: Project; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3.5 gap-y-2 border-t border-border-subtle py-3 first:border-t-0">
      <span className="flex min-w-0 flex-[1_1_180px] items-center gap-2 pt-2 text-base font-medium">
        <ColorDot color={project.color} />
        <span className="truncate">{project.name}</span>
      </span>
      <div className="flex-[1_1_260px]">{children}</div>
    </div>
  )
}

/**
 * Selector de repo de un proyecto, con los repos que ve el token. Los que ya van con otro proyecto salen
 * deshabilitados; uno vinculado antes al que el token ya no llega se sigue viendo. Al elegir uno público se
 * comprueba primero que el token pueda escribir en él.
 */
function RepoPicker({
  project,
  projects,
  repos,
}: {
  project: Project
  projects: Project[]
  repos: GithubRepoSummary[] | undefined
}) {
  const { t } = useTranslation('integrations')
  const m = useMuninn()
  const qc = useQueryClient()
  const [checking, setChecking] = useState(false)
  const { value, options } = repoChoices(project, projects, repos ?? [])

  const choose = async (name: string) => {
    const repo = repos?.find((r) => r.fullName === name)
    // El vinculado que ya no está en la lista: elegirlo de nuevo no cambia nada.
    if (name && !repo) return
    setChecking(true)
    try {
      await pickProjectRepo(m, qc, project, repo ?? null)
    } finally {
      setChecking(false)
    }
  }

  return (
    <SelectMenu
      label={t('github.repoLabel', { project: project.name })}
      value={value}
      options={options}
      onChange={(name) => void choose(name)}
      disabled={!repos || checking}
      buttonText={
        !repos ? t('github.loadingRepos') : checking ? t('github.checkingAccess') : undefined
      }
      className="w-full justify-between"
    />
  )
}

/** Campo `owner/repo` de un proyecto: se guarda al salir o con Enter; acepta la URL de GitHub. */
function RepoField({ project }: { project: Project }) {
  const { t } = useTranslation('integrations')
  const m = useMuninn()
  const qc = useQueryClient()
  const [text, setText] = useState(project.githubRepo ?? '')
  const [error, setError] = useState<string>()
  useEffect(() => setText(project.githubRepo ?? ''), [project.githubRepo])

  const commit = async () => {
    const repo = parseRepoInput(text)
    if (repo === undefined) {
      setError(t('github.repoFormat'))
      return
    }
    setError(undefined)
    setText(repo ?? '')
    if (!(await setProjectRepo(m, qc, project, repo))) setText(project.githubRepo ?? '')
  }

  return (
    <TextField
      label={t('github.repoLabel', { project: project.name })}
      hideLabel
      placeholder={t('github.repoPlaceholder')}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        setError(undefined)
      }}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setText(project.githubRepo ?? '')
          setError(undefined)
        }
      }}
      error={error}
      autoComplete="off"
      spellCheck={false}
      className="font-mono"
    />
  )
}

/** Ajustes › Integraciones: el módulo GitHub, el estado de la sincronización y el repo de cada proyecto. */
export function Integraciones() {
  const { t } = useTranslation('integrations')
  const m = useMuninn()
  const auth = useAuth()
  const modules = useEnabledModules()
  const projects = useQuery(projectsQuery(m)).data ?? []
  const activity = useGithubActivity().data
  const moduleOn = modules === null || modules.has('github')
  const synced = (activity?.count ?? 0) > 0
  const repos = useQuery(githubReposQuery(m, auth.kind !== 'demo'))
  // Selector si hay lista (o se está pidiendo); campo de texto en demo, si falla o si el token no llega a ninguno.
  const picker = auth.kind !== 'demo' && (repos.isPending || (repos.data?.length ?? 0) > 0)

  return (
    <>
      <PrefGroup
        title={t('github.statusTitle')}
        icon="github"
        description={t('github.statusDescription')}
        padded
      >
        <dl id="ajuste-github-estado" className="-my-2.5 flex flex-col text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle py-2.5 first:border-t-0">
            <dt className="flex-[1_1_180px] text-fg-subtle">{t('github.module')}</dt>
            <dd className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', moduleOn ? 'bg-success' : 'bg-fg-faint')}
              />
              {moduleOn ? t('github.on') : t('github.off')}
              <Link
                to="/ajustes/$seccion"
                params={{ seccion: 'modulos' }}
                className="text-accent hover:underline"
              >
                {t('github.change')}
              </Link>
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle py-2.5">
            <dt className="flex-[1_1_180px] text-fg-subtle">{t('github.sync')}</dt>
            <dd className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', synced ? 'bg-success' : 'bg-accent')}
              />
              {synced && activity?.last
                ? t('github.synced', { count: activity.count, time: timeAgo(activity.last) })
                : t('github.noIssuesYet')}
            </dd>
          </div>
        </dl>
        {synced ? null : (
          <p className="rounded-md bg-surface-sunken px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-muted">
            <Trans
              t={t}
              i18nKey="github.nothingYet"
              components={{ strong: <b className="font-semibold text-fg" /> }}
            />
          </p>
        )}
      </PrefGroup>

      <PrefGroup title={t('github.reposTitle')} icon="link">
        <div id="ajuste-repos" className="px-4 md:px-[18px]">
          {picker ? (
            <p className="pt-3 pb-2 text-[12.5px] text-fg-subtle">{t('github.pickerHint')}</p>
          ) : (
            <p className="pt-3 pb-2 text-[12.5px] text-fg-subtle">
              <Trans
                t={t}
                i18nKey="github.manualHint"
                components={{ mono: <span className="font-mono" /> }}
              />
            </p>
          )}
          {repos.isError ? (
            <p className="border-t border-border-subtle py-3 text-sm text-fg-subtle">
              {t('github.reposError')}{' '}
              <button
                type="button"
                onClick={() => void repos.refetch()}
                className="cursor-pointer text-accent hover:underline"
              >
                {t('github.retry')}
              </button>
            </p>
          ) : repos.data?.length === 0 ? (
            <p className="border-t border-border-subtle py-3 text-sm text-fg-subtle">
              {t('github.noRepos')}
            </p>
          ) : null}
          {auth.kind === 'demo' ? (
            <p className="border-t border-border-subtle py-3 text-sm text-fg-subtle">
              {t('github.demo')}
            </p>
          ) : null}
          {projects.length === 0 ? (
            <EmptyState icon="projects" title={t('github.noProjects')} className="mb-3 shadow-none">
              {t('github.noProjectsHint')}
            </EmptyState>
          ) : (
            projects.map((p) => (
              <RepoRow key={p.id} project={p}>
                {picker ? (
                  <RepoPicker project={p} projects={projects} repos={repos.data ?? undefined} />
                ) : (
                  <RepoField project={p} />
                )}
              </RepoRow>
            ))
          )}
        </div>
      </PrefGroup>

      <p className="px-0.5 text-xs text-fg-faint">
        {t('github.footer')}{' '}
        <Button asChild variant="ghost" className="h-auto px-0 text-xs text-accent">
          <Link to="/documentacion/$pagina" params={{ pagina: 'github' }}>
            {t('github.howItWorks')}
          </Link>
        </Button>
      </p>
    </>
  )
}
