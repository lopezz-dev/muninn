import type { GithubRepoSummary, Project } from '@muninn/core'
import { Button, Card, ColorDot, cn, Icon, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'
import { EmptyState } from '../../components/Page'
import { SelectMenu } from '../../components/SelectMenu'
import { timeAgo } from '../../lib/dates'
import { parseRepoInput, repoChoices, setProjectRepo } from '../../lib/github'
import { useEnabledModules } from '../../lib/modules'
import { useAuth, useMuninn } from '../../lib/muninn'
import { keys, projectsQuery } from '../../lib/queries'

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

/**
 * Repos a los que llega el token de la sincronización (los pregunta a la Edge Function). `null`: este modo
 * no puede preguntarlo (demo) y el repo se escribe a mano.
 */
function useGithubRepos(enabled: boolean) {
  const m = useMuninn()
  return useQuery({
    queryKey: keys.githubRepos,
    queryFn: () => m.github.repos(),
    staleTime: 5 * 60_000,
    retry: false,
    enabled,
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
 * Selector de repo de un proyecto, con los repos a los que llega el token. Los que ya van con otro
 * proyecto salen deshabilitados; uno vinculado antes al que el token ya no llega se sigue viendo.
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
  const m = useMuninn()
  const qc = useQueryClient()
  const { value, options } = repoChoices(project, projects, repos ?? [])
  return (
    <SelectMenu
      label={`Repositorio de GitHub de ${project.name}`}
      value={value}
      options={options}
      onChange={(repo) => void setProjectRepo(m, qc, project, repo || null)}
      disabled={!repos}
      buttonText={repos ? undefined : 'Cargando repositorios…'}
      className="w-full justify-between"
    />
  )
}

/** Campo `owner/repo` de un proyecto: se guarda al salir o con Enter; acepta la URL de GitHub. */
function RepoField({ project }: { project: Project }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [text, setText] = useState(project.githubRepo ?? '')
  const [error, setError] = useState<string>()
  useEffect(() => setText(project.githubRepo ?? ''), [project.githubRepo])

  const commit = async () => {
    const repo = parseRepoInput(text)
    if (repo === undefined) {
      setError('Escribe usuario/repositorio, por ejemplo lopezz-dev/muninn')
      return
    }
    setError(undefined)
    setText(repo ?? '')
    if (!(await setProjectRepo(m, qc, project, repo))) setText(project.githubRepo ?? '')
  }

  return (
    <TextField
      label={`Repositorio de GitHub de ${project.name}`}
      hideLabel
      placeholder="usuario/repositorio"
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
  const m = useMuninn()
  const auth = useAuth()
  const modules = useEnabledModules()
  const projects = useQuery(projectsQuery(m)).data ?? []
  const activity = useGithubActivity().data
  const moduleOn = modules === null || modules.has('github')
  const synced = (activity?.count ?? 0) > 0
  const repos = useGithubRepos(auth.kind !== 'demo')
  // Selector si hay lista (o se está pidiendo); campo de texto en demo, si falla o si el token no llega a ninguno.
  const picker = auth.kind !== 'demo' && (repos.isPending || (repos.data?.length ?? 0) > 0)

  return (
    <>
      <Card className="flex flex-col gap-3 px-[18px] py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-[30px] shrink-0 place-items-center rounded-md bg-project-violet/15 text-project-violet">
            <Icon name="github" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-md font-semibold">GitHub</h2>
            <p className="text-[12.5px] text-fg-subtle">
              Las issues de un repositorio llegan como tareas de su proyecto. Cerrar la issue
              completa la tarea, y completar la tarea cierra la issue.
            </p>
          </div>
        </div>
        <dl className="flex flex-col text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle py-2.5">
            <dt className="flex-[1_1_180px] text-fg-subtle">Módulo</dt>
            <dd className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', moduleOn ? 'bg-success' : 'bg-fg-faint')}
              />
              {moduleOn ? 'Activado' : 'Desactivado'}
              <Link
                to="/ajustes/$seccion"
                params={{ seccion: 'modulos' }}
                className="text-accent hover:underline"
              >
                Cambiar
              </Link>
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle py-2.5">
            <dt className="flex-[1_1_180px] text-fg-subtle">Sincronización</dt>
            <dd className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', synced ? 'bg-success' : 'bg-accent')}
              />
              {synced && activity?.last
                ? `${activity.count} ${activity.count === 1 ? 'tarea' : 'tareas'} de GitHub · último cambio ${timeAgo(activity.last)}`
                : 'Aún no ha llegado ninguna issue'}
            </dd>
          </div>
        </dl>
        {synced ? null : (
          <p className="rounded-md bg-surface-sunken px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-muted">
            <b className="font-semibold text-fg">Todavía no está activa.</b> La sincronización corre
            en el servidor y necesita un token de GitHub y unos pasos de puesta en marcha que aún no
            se han hecho. Puedes vincular los repositorios ya: en cuanto se active, sus issues
            abiertas aparecerán en el tablero.
          </p>
        )}
      </Card>

      <Card className="px-[18px] py-1.5">
        <h2 className="pt-3 text-md font-semibold">Repositorio de cada proyecto</h2>
        {picker ? (
          <p className="pb-2 text-[12.5px] text-fg-subtle">
            Un repositorio por proyecto. Salen los repositorios a los que tiene acceso el token de
            la sincronización; si falta alguno, dale acceso en GitHub y vuelve a esta página.
          </p>
        ) : (
          <p className="pb-2 text-[12.5px] text-fg-subtle">
            Un repositorio por proyecto. Escribe{' '}
            <span className="font-mono">usuario/repositorio</span> o pega su dirección de GitHub;
            déjalo vacío para desvincularlo.
          </p>
        )}
        {repos.isError ? (
          <p className="border-t border-border-subtle py-3 text-sm text-fg-subtle">
            No se pudo cargar la lista de repositorios, así que toca escribirlo a mano.{' '}
            <button
              type="button"
              onClick={() => void repos.refetch()}
              className="cursor-pointer text-accent hover:underline"
            >
              Reintentar
            </button>
          </p>
        ) : repos.data?.length === 0 ? (
          <p className="border-t border-border-subtle py-3 text-sm text-fg-subtle">
            El token de la sincronización todavía no tiene acceso a ningún repositorio: dáselo en
            GitHub o escríbelo a mano.
          </p>
        ) : null}
        {auth.kind === 'demo' ? (
          <p className="border-t border-border-subtle py-3 text-sm text-fg-subtle">
            En modo demo puedes probar el campo, pero nada llegará de GitHub: la sincronización
            necesita una cuenta.
          </p>
        ) : null}
        {projects.length === 0 ? (
          <EmptyState icon="projects" title="Aún no tienes proyectos" className="mb-3 shadow-none">
            Crea uno desde Proyectos y vuelve para vincularle un repositorio.
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
      </Card>

      <p className="text-xs text-fg-faint">
        Las tareas que vienen de GitHub llevan su insignia y su número de issue. Su título y su
        descripción se cambian en GitHub; lo demás (columna, prioridad, fecha, subtareas y notas) es
        tuyo.{' '}
        <Button asChild variant="ghost" className="h-auto px-0 text-xs text-accent">
          <Link to="/documentacion/$pagina" params={{ pagina: 'github' }}>
            Cómo funciona
          </Link>
        </Button>
      </p>
    </>
  )
}
