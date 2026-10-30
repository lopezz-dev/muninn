import type { BoardColumn, GithubRepoSummary, Project } from '@muninn/core'
import { Button, Card, Chip, ColorDot, cn, Icon, type IconName, icons, notify } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { EmptyState, Page, PageHeader } from '../components/Page'
import { SelectMenu } from '../components/SelectMenu'
import { canBeAgentColumn, setAgentColumn } from '../lib/agent'
import { timeAgo } from '../lib/dates'
import { externalLink } from '../lib/external-link'
import { moveProjectRepo, pickProjectRepo, setProjectRepo } from '../lib/github'
import {
  type AgentRun,
  agentRuns,
  describeSync,
  projectChoices,
  type RepoRow,
  RUN_ACTIONS,
  type RunState,
  readSyncResult,
  repoRows,
} from '../lib/github-overview'
import { useAuth, useMuninn } from '../lib/muninn'
import { fail } from '../lib/mutations'
import { githubReposQuery, invalidateProjects, projectsQuery } from '../lib/queries'

/** Repos sin vincular que se ven sin desplegar: el token puede llegar a muchos. */
const FREE_VISIBLE = 4

/** Rejilla de la tabla en escritorio; en móvil cada repo es un bloque. */
const GRID =
  'md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_80px_minmax(0,1.2fr)_100px] md:items-center md:gap-3'

/** Las tareas de GitHub (también archivadas, para contar y para nombrar las ejecuciones). */
function useGithubTasks() {
  const m = useMuninn()
  return useQuery({
    queryKey: ['tasks', 'github-screen'],
    queryFn: () => m.tasks.list({ source: 'github', includeArchived: true }),
  })
}

/** Los pasos del agente (cuelga de `tasks`: llegan siempre con un movimiento de tarea, que lo refresca). */
function useAgentActivity() {
  const m = useMuninn()
  return useQuery({
    queryKey: ['tasks', 'github-runs'],
    queryFn: () => m.recentActivity({ actions: RUN_ACTIONS, limit: 40 }),
  })
}

/** Columnas de los proyectos con repo, para elegir la del agente. */
function useLinkedColumns(projects: Project[]) {
  const m = useMuninn()
  const ids = projects.map((p) => p.id)
  return useQuery({
    queryKey: ['projects', 'github-columns', ids],
    queryFn: async () => {
      // Una consulta para todos los proyectos (no una por proyecto); se reparten aquí, en su orden.
      const all = await m.columns.listMany(ids)
      return new Map(ids.map((id) => [id, all.filter((c) => c.projectId === id)]))
    },
    enabled: ids.length > 0,
  })
}

// ─── Cabecera ────────────────────────────────────────────────────────────────

/** «Sincronizar ahora»: la reconciliación entera en la Edge Function, sin esperar al cron. */
function SyncButton({ onErrors }: { onErrors: (errors: Map<string, string>) => void }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const data = await m.github.syncNow('all')
      if (data === null) {
        notify.info('En modo demo no hay nada que sincronizar', {
          description: 'La sincronización con GitHub necesita una cuenta.',
        })
        return
      }
      const result = readSyncResult(data)
      onErrors(new Map(result?.errors.map((e) => [e.repo.toLowerCase(), e.error])))
      await Promise.all([qc.invalidateQueries({ queryKey: ['tasks'] }), invalidateProjects(qc)])
      if (result?.errors.length) {
        notify.error(
          result.errors.length === 1
            ? `No se pudo sincronizar ${result.errors[0]?.repo}`
            : `No se pudieron sincronizar ${result.errors.length} repositorios`,
          { description: result.errors[0]?.error },
        )
      } else {
        notify.success('Sincronizado con GitHub', {
          icon: 'sync',
          description: result ? describeSync(result) : undefined,
        })
      }
    } catch (err) {
      fail('No se pudo sincronizar con GitHub', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={() => void run()} disabled={busy}>
      <icons.sync size={15} className={cn(busy && 'motion-safe:animate-spin')} aria-hidden="true" />
      {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
    </Button>
  )
}

// ─── Repositorios ────────────────────────────────────────────────────────────

/** Selector del proyecto de un repo: vincularlo a uno libre o desvincularlo, con aviso y «Deshacer». */
function ProjectPicker({
  row,
  projects,
  summary,
}: {
  row: RepoRow
  projects: Project[]
  summary: GithubRepoSummary | undefined
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [checking, setChecking] = useState(false)
  const { value, options } = projectChoices(row.repo, projects)

  const choose = async (id: string) => {
    if (id === value) return
    setChecking(true)
    try {
      if (!id) {
        if (row.project) await setProjectRepo(m, qc, row.project, null)
        return
      }
      const project = projects.find((p) => p.id === id)
      if (!project) return
      // Ya vinculado a otro proyecto: se mueve (el token ya llega a él, no hace falta comprobarlo).
      if (row.project) {
        await moveProjectRepo(m, qc, row.project, project, row.repo)
        return
      }
      // Con la lista del token se comprueba el acceso a los públicos; sin ella (demo), se vincula tal cual.
      if (summary) await pickProjectRepo(m, qc, project, summary)
      else await setProjectRepo(m, qc, project, row.repo)
    } finally {
      setChecking(false)
    }
  }

  return (
    <SelectMenu
      label={`Proyecto de ${row.repo}`}
      value={value}
      options={options}
      onChange={(id) => void choose(id)}
      disabled={checking}
      buttonText={checking ? 'Comprobando…' : undefined}
      className="max-w-full justify-between md:w-full"
    />
  )
}

function RepoLine({
  row,
  projects,
  summary,
  error,
}: {
  row: RepoRow
  projects: Project[]
  summary: GithubRepoSummary | undefined
  error: string | undefined
}) {
  const linked = row.project !== null
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-subtle px-4 py-3 text-sm first:border-t-0',
        GRID,
      )}
    >
      <span
        className={cn(
          'flex min-w-0 flex-[1_1_100%] items-center gap-2 font-mono md:flex-none',
          !linked && 'text-fg-subtle',
        )}
      >
        <Icon name="github" size={15} className="shrink-0 text-fg-subtle" aria-hidden="true" />
        <span className="truncate">{row.repo}</span>
        {row.private ? (
          <Chip variant="outline" className="h-[18px] px-1.5 font-sans">
            privado
          </Chip>
        ) : null}
      </span>
      <span className="min-w-0">
        <ProjectPicker row={row} projects={projects} summary={summary} />
      </span>
      <span className={cn('text-fg-muted', !linked && 'max-md:hidden')}>
        {linked ? `${row.open} ${row.open === 1 ? 'abierta' : 'abiertas'}` : '—'}
      </span>
      <span
        className={cn(
          'min-w-0 text-[13px]',
          error ? 'text-danger' : 'text-fg-subtle',
          !linked && 'max-md:hidden',
        )}
        title={error}
      >
        {error ? (
          <span className="flex items-center gap-1.5">
            <Icon name="warning" size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">Falló: {error}</span>
          </span>
        ) : linked ? (
          'Issues → tareas · cerrar ↔ completar'
        ) : (
          '—'
        )}
      </span>
      <span className={cn('text-[13px] text-fg-subtle', !linked && 'max-md:hidden')}>
        {row.last ? timeAgo(row.last) : linked ? 'sin issues aún' : '—'}
      </span>
    </li>
  )
}

function RepoTable({
  rows,
  projects,
  repos,
  errors,
}: {
  rows: RepoRow[]
  projects: Project[]
  repos: GithubRepoSummary[] | null | undefined
  errors: Map<string, string>
}) {
  const [expanded, setExpanded] = useState(false)
  const linked = rows.filter((r) => r.project)
  const free = rows.filter((r) => !r.project)
  const hidden = expanded ? 0 : Math.max(0, free.length - FREE_VISIBLE)
  const shown = [...linked, ...free.slice(0, free.length - hidden)]
  const summaryOf = (repo: string) =>
    repos?.find((r) => r.fullName.toLowerCase() === repo.toLowerCase())

  return (
    <Card aria-label="Repositorios" className="overflow-hidden">
      <div
        aria-hidden="true"
        className={cn(
          'hidden border-b border-border-subtle px-4 py-2.5 text-xs font-medium text-fg-subtle',
          GRID,
        )}
      >
        <span>Repositorio</span>
        <span>Proyecto en Muninn</span>
        <span>Issues</span>
        <span>Sincronización</span>
        <span>Último cambio</span>
      </div>
      <ul>
        {shown.map((row) => (
          <RepoLine
            key={row.repo}
            row={row}
            projects={projects}
            summary={summaryOf(row.repo)}
            error={errors.get(row.repo.toLowerCase())}
          />
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full cursor-pointer items-center gap-1.5 border-t border-border-subtle px-4 py-2.5 text-sm text-accent hover:bg-surface-hover"
        >
          <icons.chevronDown size={13} aria-hidden="true" />
          {hidden === 1 ? 'Ver 1 repositorio más' : `Ver ${hidden} repositorios más`} sin vincular
        </button>
      ) : null}
    </Card>
  )
}

// ─── Agente ──────────────────────────────────────────────────────────────────

const STEPS = [
  ['1 · Arrastras', 'una tarea de GitHub a la columna del agente'],
  ['2 · Se etiqueta', 'la issue con muninn:agent y arranca el agente'],
  ['3 · Abre un PR', 'y la tarea pasa a Revisión; al fusionarlo, se completa'],
] as const

function AgentCard({
  linked,
  columns,
}: {
  linked: Project[]
  columns: Map<string, BoardColumn[]> | undefined
}) {
  const m = useMuninn()
  const qc = useQueryClient()

  return (
    <Card
      aria-labelledby="agente-titulo"
      className="flex flex-[1_1_420px] flex-col gap-3.5 px-[18px] py-4"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <Icon name="agent" />
        </span>
        <h2 id="agente-titulo" className="text-md font-semibold">
          Columna «Para el agente»
        </h2>
      </div>
      <ol className="grid grid-cols-1 gap-2 text-[12.5px] leading-snug text-fg-muted sm:grid-cols-3">
        {STEPS.map(([title, text]) => (
          <li key={title} className="rounded-md border border-border p-2.5">
            <b className="mb-1 block font-semibold text-fg">{title}</b>
            {text}
          </li>
        ))}
      </ol>
      {linked.length === 0 ? (
        <p className="text-sm text-fg-subtle">
          Vincula un repositorio a un proyecto para elegir su columna del agente.
        </p>
      ) : (
        <ul className="flex flex-col">
          {linked.map((p) => {
            const cols = columns?.get(p.id)
            const options = [
              { value: '', label: 'Sin columna del agente', tone: 'text-fg-muted' },
              ...(cols ?? [])
                .filter((c) => canBeAgentColumn(p, true, c))
                .map((c) => ({ value: c.id, label: c.name })),
            ]
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-subtle py-2.5"
              >
                <span className="flex min-w-0 flex-[1_1_140px] items-center gap-2 text-sm font-medium">
                  <ColorDot color={p.color} />
                  <span className="truncate">{p.name}</span>
                </span>
                <SelectMenu
                  label={`Columna del agente de ${p.name}`}
                  value={p.agentColumnId ?? ''}
                  options={options}
                  disabled={!cols}
                  buttonText={cols ? undefined : 'Cargando…'}
                  onChange={(id) => void setAgentColumn(m, qc, p, cols ?? [], id || null)}
                  className="flex-[1_1_200px] justify-between"
                />
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-fg-faint">
        El agente es la Claude Code GitHub Action de cada repositorio: necesita la GitHub App de
        Claude, un secreto y el workflow, y abre el PR contra la rama que diga ese workflow. Nunca
        fusiona: el PR lo revisas tú.{' '}
        <Link
          to="/documentacion/$pagina"
          params={{ pagina: 'github' }}
          className="text-accent hover:underline"
        >
          Cómo ponerlo en marcha
        </Link>
      </p>
    </Card>
  )
}

const RUN_LOOK: Record<RunState, { label: string; icon: IconName; tone: string }> = {
  working: { label: 'Trabajando', icon: 'clock', tone: 'text-accent' },
  review: { label: 'PR abierto', icon: 'branch', tone: 'text-kind-review' },
  merged: { label: 'Fusionado', icon: 'check', tone: 'text-success' },
  closed: { label: 'PR cerrado', icon: 'close', tone: 'text-fg-muted' },
  stopped: { label: 'Sin PR', icon: 'warning', tone: 'text-danger' },
}

function RunLine({ run, projectId }: { run: AgentRun; projectId: string | undefined }) {
  const look = RUN_LOOK[run.state]
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle py-2.5 text-sm">
      <span
        className={cn(
          'flex w-[104px] shrink-0 items-center gap-1.5 text-xs font-medium',
          look.tone,
        )}
      >
        <Icon name={look.icon} size={14} aria-hidden="true" />
        {look.label}
      </span>
      {projectId ? (
        <Link
          to="/proyectos/$projectId/tareas/$taskId"
          params={{ projectId, taskId: run.taskId }}
          className="min-w-0 flex-[1_1_160px] truncate hover:underline"
        >
          {run.title}
        </Link>
      ) : (
        <span className="min-w-0 flex-[1_1_160px] truncate">{run.title}</span>
      )}
      {/* Juntos a la derecha: si no caben, bajan los dos a la línea siguiente. */}
      <span className="ml-auto flex shrink-0 items-center gap-3 text-xs">
        <span className="font-mono text-fg-subtle">
          {run.repo?.split('/')[1]}
          {run.issue ? ` #${run.issue}` : ''}
        </span>
        {run.pr?.url ? (
          <a
            {...externalLink(run.pr.url)}
            className="flex items-center gap-0.5 text-accent hover:underline"
          >
            PR #{run.pr.number}
            <Icon name="external" size={12} aria-hidden="true" />
          </a>
        ) : (
          <span className="text-fg-faint">{timeAgo(run.at)}</span>
        )}
      </span>
    </li>
  )
}

function RunsCard({ runs, projectOf }: { runs: AgentRun[]; projectOf: Map<string, string> }) {
  return (
    <Card
      aria-labelledby="ejecuciones-titulo"
      className="flex flex-[1_1_420px] flex-col px-[18px] pt-4 pb-1.5"
    >
      <h2 id="ejecuciones-titulo" className="pb-2 text-md font-semibold">
        Ejecuciones recientes
      </h2>
      {runs.length === 0 ? (
        <p className="border-t border-border-subtle py-3 text-sm text-fg-subtle">
          Aún no has mandado nada al agente. Mueve una tarea de GitHub a su columna y aquí verás
          cómo va: trabajando, PR abierto, fusionado o sin PR.
        </p>
      ) : (
        <ul>
          {runs.map((r) => (
            <RunLine key={r.taskId} run={r} projectId={projectOf.get(r.taskId)} />
          ))}
        </ul>
      )}
    </Card>
  )
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

/** GitHub: los repos vinculados y su sincronización, y la columna del agente con sus ejecuciones. */
export function GitHub() {
  const m = useMuninn()
  const auth = useAuth()
  const projects = useQuery(projectsQuery(m)).data ?? []
  const tasks = useGithubTasks().data ?? []
  const activity = useAgentActivity().data ?? []
  const repos = useQuery(githubReposQuery(m, auth.kind !== 'demo'))
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  const linked = projects.filter((p) => p.githubRepo)
  const columns = useLinkedColumns(linked).data
  const rows = repoRows(projects, tasks, repos.data ?? null)
  const runs = agentRuns(activity, tasks, projects)
  const projectOf = new Map(tasks.map((t) => [t.id, t.projectId]))

  return (
    <Page>
      <PageHeader
        title="GitHub"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Issues como tareas y un agente que abre PRs.
            <Chip variant={linked.length ? 'success' : 'neutral'}>
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  linked.length ? 'bg-success' : 'bg-fg-faint',
                )}
              />
              {linked.length === 0
                ? 'Ningún repositorio vinculado'
                : linked.length === 1
                  ? '1 repositorio vinculado'
                  : `${linked.length} repositorios vinculados`}
            </Chip>
          </span>
        }
        actions={
          <>
            {linked.length ? <SyncButton onErrors={setErrors} /> : null}
            <Button asChild variant="ghost">
              <Link to="/ajustes/$seccion" params={{ seccion: 'integraciones' }}>
                <Icon name="settings" size={15} aria-hidden="true" />
                Ajustes
              </Link>
            </Button>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="github"
          title="Vincula un repositorio"
          actions={
            <Button asChild variant="primary">
              <Link to="/ajustes/$seccion" params={{ seccion: 'integraciones' }}>
                Vincular repositorios
              </Link>
            </Button>
          }
        >
          {repos.isPending && auth.kind !== 'demo'
            ? 'Buscando los repositorios a los que llega el token…'
            : 'Las issues de un repositorio llegan como tareas de su proyecto, y al cerrar una se completa la otra. Vincúlalo a un proyecto en Ajustes › Integraciones.'}
        </EmptyState>
      ) : (
        <RepoTable rows={rows} projects={projects} repos={repos.data} errors={errors} />
      )}
      {repos.isError ? (
        <p className="-mt-2 text-xs text-fg-subtle">
          No se pudo pedir la lista de repositorios del token: solo salen los vinculados.{' '}
          <button
            type="button"
            onClick={() => void repos.refetch()}
            className="cursor-pointer text-accent hover:underline"
          >
            Reintentar
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <AgentCard linked={linked} columns={columns} />
        <RunsCard runs={runs} projectOf={projectOf} />
      </div>
    </Page>
  )
}
