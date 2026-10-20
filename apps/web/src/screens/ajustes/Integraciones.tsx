import type { Project } from '@muninn/core'
import { Button, Card, ColorDot, cn, Icon, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/Page'
import { timeAgo } from '../../lib/dates'
import { parseRepoInput, setProjectRepo } from '../../lib/github'
import { useEnabledModules } from '../../lib/modules'
import { useAuth, useMuninn } from '../../lib/muninn'
import { projectsQuery } from '../../lib/queries'

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
    <div className="flex flex-wrap items-start gap-x-3.5 gap-y-2 border-t border-border-subtle py-3 first:border-t-0">
      <span className="flex min-w-0 flex-[1_1_180px] items-center gap-2 pt-2 text-base font-medium">
        <ColorDot color={project.color} />
        <span className="truncate">{project.name}</span>
      </span>
      <div className="flex-[1_1_260px]">
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
      </div>
    </div>
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
        <p className="pb-2 text-[12.5px] text-fg-subtle">
          Un repositorio por proyecto. Escribe{' '}
          <span className="font-mono">usuario/repositorio</span> o pega su dirección de GitHub;
          déjalo vacío para desvincularlo.
        </p>
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
          projects.map((p) => <RepoField key={p.id} project={p} />)
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
