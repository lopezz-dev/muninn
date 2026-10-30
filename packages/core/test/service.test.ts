import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMemoryStore,
  createMuninn,
  DEFAULT_COLUMNS,
  isImageOf,
  positionAt,
  ValidationError,
  withActor,
} from '../src'

let clock = new Date('2026-10-19T10:00:00Z')
const setup = (actor?: 'user' | 'mcp') => {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  return { store, app: createMuninn(store, { actor, now: () => clock, timeZone: 'UTC' }) }
}

beforeEach(() => {
  clock = new Date('2026-10-19T10:00:00Z')
})

describe('proyectos', () => {
  it('crea las columnas por defecto en orden', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'Muninn' })
    const cols = await app.columns.list(p.id)
    expect(cols.map((c) => c.kind)).toEqual(DEFAULT_COLUMNS.map((c) => c.kind))
  })

  it('valida el formato del repo de GitHub', async () => {
    const { app } = setup()
    await expect(app.projects.create({ name: 'x', githubRepo: 'no-valido' })).rejects.toThrow(
      ValidationError,
    )
    const p = await app.projects.create({ name: 'x', githubRepo: 'lopezz-dev/muninn' })
    expect(p.githubRepo).toBe('lopezz-dev/muninn')
  })

  it('los archivados no salen en la lista por defecto', async () => {
    const { app } = setup()
    const a = await app.projects.create({ name: 'A' })
    await app.projects.create({ name: 'B' })
    await app.projects.archive(a.id)
    expect((await app.projects.list()).map((p) => p.name)).toEqual(['B'])
    expect(await app.projects.list({ includeArchived: true })).toHaveLength(2)
  })

  it('archivar suelta el repo de GitHub, que se puede vincular a otro proyecto', async () => {
    const { app } = setup()
    const a = await app.projects.create({ name: 'A', githubRepo: 'lopezz-dev/huginnDB' })
    const b = await app.projects.create({ name: 'B' })
    const archived = await app.projects.archive(a.id)
    expect(archived).toMatchObject({ status: 'archived', githubRepo: null })
    expect(
      (await app.projects.update(b.id, { githubRepo: 'lopezz-dev/huginnDB' })).githubRepo,
    ).toBe('lopezz-dev/huginnDB')
  })

  it('solo se elimina un proyecto archivado, con sus tareas; las notas se quedan sin proyecto', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 't' })
    await app.checklist.add(t.id, 'sub')
    const note = await app.notes.create({ title: 'n', projectId: p.id })
    await expect(app.projects.delete(p.id)).rejects.toThrow(ValidationError)
    await app.projects.archive(p.id)
    await app.projects.delete(p.id)
    expect(await app.projects.list({ includeArchived: true })).toHaveLength(0)
    await expect(app.tasks.get(t.id)).rejects.toThrow()
    expect((await app.notes.get(note.id)).projectId).toBeNull()
  })
})

describe('tareas', () => {
  it('solo se elimina una tarea archivada, con sus subtareas; sus notas se quedan sin tarea', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 't' })
    const other = await app.tasks.create({ projectId: p.id, title: 'otra' })
    await app.checklist.add(t.id, 'sub')
    await app.checklist.add(other.id, 'sub de otra')
    const note = await app.notes.create({ title: 'n', taskId: t.id })
    await expect(app.tasks.delete(t.id)).rejects.toThrow(ValidationError)
    await app.tasks.archive(t.id)
    await app.tasks.delete(t.id)
    await expect(app.tasks.get(t.id)).rejects.toThrow()
    expect(await app.checklist.list(t.id)).toHaveLength(0)
    expect(await app.checklist.list(other.id)).toHaveLength(1)
    expect(await app.notes.get(note.id)).toMatchObject({ taskId: null, projectId: p.id })
    // La actividad se queda: es el historial, y dice que se eliminó.
    const log = (await app.recentActivity()).filter((a) => a.entityId === t.id)
    expect(log.map((a) => a.action)).toEqual(expect.arrayContaining(['created', 'deleted']))
  })

  it('se crean en la columna "todo" y al final', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t1 = await app.tasks.create({ projectId: p.id, title: 'uno' })
    const t2 = await app.tasks.create({ projectId: p.id, title: 'dos' })
    const todo = (await app.columns.list(p.id)).find((c) => c.kind === 'todo')
    expect(t1.columnId).toBe(todo?.id)
    expect(t1.position < t2.position).toBe(true)
  })

  it('el source por defecto depende del actor', async () => {
    const { store } = setup()
    const app = createMuninn(store, { actor: 'mcp' })
    const p = await app.projects.create({ name: 'P' })
    expect((await app.tasks.create({ projectId: p.id, title: 't' })).source).toBe('mcp')
  })

  it('mover a "hecho" marca completedAt y sacarla lo limpia', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 't' })
    const done = await app.tasks.complete(t.id)
    expect(done.completedAt).toBe(clock.toISOString())
    const reopened = await app.tasks.reopen(t.id)
    expect(reopened.completedAt).toBeNull()
    const actions = (await app.recentActivity()).map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['completed', 'reopened']))
  })

  it('mover a un índice concreto respeta el orden', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const [a, b, c] = [
      await app.tasks.create({ projectId: p.id, title: 'a' }),
      await app.tasks.create({ projectId: p.id, title: 'b' }),
      await app.tasks.create({ projectId: p.id, title: 'c' }),
    ]
    await app.tasks.move(c.id, { columnId: c.columnId, index: 0 })
    await app.tasks.move(a.id, { columnId: a.columnId, index: 1 })
    const order = (await app.tasks.list({ columnId: a.columnId })).map((t) => t.title)
    expect(order).toEqual(['c', 'a', 'b'])
    expect(b).toBeDefined()
  })

  it('no permite mover a una columna de otro proyecto', async () => {
    const { app } = setup()
    const p1 = await app.projects.create({ name: 'P1' })
    const p2 = await app.projects.create({ name: 'P2' })
    const t = await app.tasks.create({ projectId: p1.id, title: 't' })
    const foreign = (await app.columns.list(p2.id))[0]
    await expect(app.tasks.move(t.id, { columnId: foreign?.id ?? '' })).rejects.toThrow()
  })

  it('filtra por tipo de columna y por texto', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 'Arreglar login' })
    await app.tasks.create({ projectId: p.id, title: 'Escribir docs' })
    await app.tasks.complete(t.id)
    expect((await app.tasks.list({ kinds: ['done'] })).map((x) => x.title)).toEqual([
      'Arreglar login',
    ])
    expect((await app.tasks.list({ search: 'DOCS' })).map((x) => x.title)).toEqual([
      'Escribir docs',
    ])
  })

  it('borrar una columna con tareas exige destino', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 't' })
    const cols = await app.columns.list(p.id)
    const backlog = cols.find((c) => c.kind === 'backlog')
    await expect(app.columns.delete(t.columnId)).rejects.toThrow(ValidationError)
    const { movedTaskIds } = await app.columns.delete(t.columnId, { moveTasksTo: backlog?.id })
    expect((await app.tasks.get(t.id)).columnId).toBe(backlog?.id)
    expect(movedTaskIds).toEqual([t.id])
  })

  it('cambiar una columna a tipo "done" completa sus tareas', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 't' })
    await app.columns.update(t.columnId, { kind: 'done' })
    expect((await app.tasks.get(t.id)).completedAt).not.toBeNull()
  })

  it('create acepta un checklist', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 't', checklist: ['uno', ' dos '] })
    expect((await app.checklist.list(t.id)).map((i) => [i.title, i.done])).toEqual([
      ['uno', false],
      ['dos', false],
    ])
  })
})

describe('tareas en lote', () => {
  it('crea en orden, detrás de las que ya había, con su checklist y su actividad', async () => {
    const { app } = setup('mcp')
    const p = await app.projects.create({ name: 'P' })
    const before = await app.tasks.create({ projectId: p.id, title: 'antes' })
    const done = (await app.columns.list(p.id)).find((c) => c.kind === 'done')
    const results = await app.tasks.createMany([
      { projectId: p.id, title: 'a', checklist: ['a1', 'a2', 'a3'] },
      { projectId: p.id, title: 'b', priority: 'high' },
      { projectId: p.id, title: 'c', columnId: done?.id },
      { projectId: p.id, title: 'd', checklist: ['d1'] },
    ])
    expect(results.every((r) => r.ok)).toBe(true)
    const titles = (await app.tasks.list({ columnId: before.columnId })).map((t) => t.title)
    expect(titles).toEqual(['antes', 'a', 'b', 'd'])
    const [a, , c] = results.map((r) => (r.ok ? r : undefined))
    expect(a?.checklist.map((i) => i.title)).toEqual(['a1', 'a2', 'a3'])
    expect((await app.checklist.list(a?.task.id ?? '')).map((i) => i.title)).toEqual([
      'a1',
      'a2',
      'a3',
    ])
    expect(c?.task.completedAt).toBe(clock.toISOString())
    expect(c?.task.source).toBe('mcp')
    const created = (await app.recentActivity({ projectId: p.id }))
      .filter((e) => e.action === 'created' && e.entityType === 'task')
      .map((e) => e.payload.title)
    expect(created).toEqual(expect.arrayContaining(['antes', 'a', 'b', 'c', 'd']))
  })

  it('un elemento que falla no corta el resto', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const other = await app.projects.create({ name: 'Otro' })
    const foreign = (await app.columns.list(other.id))[0]
    const results = await app.tasks.createMany([
      { projectId: p.id, title: 'buena' },
      { projectId: p.id, title: '   ' },
      { projectId: crypto.randomUUID(), title: 'sin proyecto' },
      { projectId: p.id, title: 'columna ajena', columnId: foreign?.id },
      { projectId: p.id, title: 'otra buena' },
    ])
    expect(results.map((r) => r.ok)).toEqual([true, false, false, false, true])
    expect(results[2]).toMatchObject({ ok: false, error: expect.stringContaining('no existe') })
    expect(results[3]).toMatchObject({ ok: false, error: expect.stringContaining('no pertenece') })
    expect((await app.tasks.list({ projectId: p.id })).map((t) => t.title)).toEqual([
      'buena',
      'otra buena',
    ])
  })

  it('reparte entre proyectos y columnas', async () => {
    const { app } = setup()
    const p1 = await app.projects.create({ name: 'P1' })
    const p2 = await app.projects.create({ name: 'P2' })
    const backlog = (await app.columns.list(p1.id)).find((c) => c.kind === 'backlog')
    const results = await app.tasks.createMany([
      { projectId: p1.id, title: 'p1-todo' },
      { projectId: p2.id, title: 'p2-todo' },
      { projectId: p1.id, title: 'p1-backlog', columnId: backlog?.id },
      { projectId: p1.id, title: 'p1-todo-2' },
    ])
    expect(results.every((r) => r.ok)).toBe(true)
    expect(
      (await app.tasks.list({ projectId: p1.id, kinds: ['todo'] })).map((t) => t.title),
    ).toEqual(['p1-todo', 'p1-todo-2'])
    expect((await app.tasks.list({ columnId: backlog?.id })).map((t) => t.title)).toEqual([
      'p1-backlog',
    ])
    expect((await app.tasks.list({ projectId: p2.id })).map((t) => t.title)).toEqual(['p2-todo'])
  })

  it('exige entre 1 y 50 tareas', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    await expect(app.tasks.createMany([])).rejects.toThrow(ValidationError)
    const many = Array.from({ length: 51 }, (_, i) => ({ projectId: p.id, title: `t${i}` }))
    await expect(app.tasks.createMany(many)).rejects.toThrow(ValidationError)
    expect(await app.tasks.list({ projectId: p.id })).toEqual([])
  })

  it('usa pocas consultas al store', async () => {
    const { store, app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const calls: string[] = []
    for (const name of ['tasks', 'checklist', 'columns', 'projects'] as const) {
      const col = store[name] as unknown as Record<string, (...a: unknown[]) => unknown>
      for (const method of ['get', 'list', 'insert', 'insertMany'] as const) {
        const fn = col[method]?.bind(col)
        if (!fn) continue
        col[method] = (...a: unknown[]) => {
          calls.push(`${name}.${method}`)
          return fn(...a)
        }
      }
    }
    const tasks = Array.from({ length: 30 }, (_, i) => ({
      projectId: p.id,
      title: `t${i}`,
      checklist: ['x', 'y'],
    }))
    await app.tasks.createMany(tasks)
    expect(calls.filter((c) => c.endsWith('.insert'))).toEqual([])
    expect(calls.length).toBeLessThanOrEqual(6)
  })
})

describe('informes', () => {
  it('estado de proyecto: vencidas, hoy y próximas', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    await app.tasks.create({ projectId: p.id, title: 'vencida', dueDate: '2026-10-10' })
    await app.tasks.create({ projectId: p.id, title: 'hoy', dueDate: '2026-10-19' })
    await app.tasks.create({ projectId: p.id, title: 'semana', dueDate: '2026-10-24' })
    const t = await app.tasks.create({ projectId: p.id, title: 'hecha' })
    await app.tasks.complete(t.id)

    const s = await app.projects.status(p.id)
    expect(s.counts).toMatchObject({ open: 3, done: 1, overdue: 1, dueToday: 1, dueThisWeek: 2 })
    expect(s.counts.completedLast7Days).toBe(1)
    expect(s.overdue.map((x) => x.title)).toEqual(['vencida'])
  })

  it('overview agrega todos los proyectos activos', async () => {
    const { app } = setup()
    const a = await app.projects.create({ name: 'A' })
    const b = await app.projects.create({ name: 'B' })
    const t = await app.tasks.create({ projectId: a.id, title: 'x', dueDate: '2026-10-19' })
    const cols = await app.columns.list(b.id)
    const inProgress = cols.find((c) => c.kind === 'in_progress')
    await app.tasks.create({ projectId: b.id, title: 'y', columnId: inProgress?.id })
    const o = await app.overview()
    expect(o.dueToday.map((x) => x.projectName)).toEqual(['A'])
    expect(o.inProgress.map((x) => x.title)).toEqual(['y'])
    await app.tasks.complete(t.id)
    expect((await app.overview()).completedToday).toBe(1)
  })

  it('overview: próximos días, hechas hoy y gráfica de 7 días', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    await app.tasks.create({ projectId: p.id, title: 'mañana', dueDate: '2026-10-20' })
    await app.tasks.create({ projectId: p.id, title: 'en 9 días', dueDate: '2026-10-28' })
    const ayer = await app.tasks.create({ projectId: p.id, title: 'ayer' })
    clock = new Date('2026-10-18T10:00:00Z')
    await app.tasks.complete(ayer.id)
    clock = new Date('2026-10-19T10:00:00Z')
    const hoy = await app.tasks.create({ projectId: p.id, title: 'hoy', dueDate: '2026-10-19' })
    await app.tasks.complete(hoy.id)
    // Archivar una tarea hecha no la quita de las estadísticas.
    await app.tasks.archive(hoy.id)

    const o = await app.overview()
    expect(o.upcoming.map((t) => t.title)).toEqual(['mañana'])
    expect(o.completedTodayTasks.map((t) => t.title)).toEqual(['hoy'])
    expect(o.completedToday).toBe(1)
    expect(o.completedByDay).toHaveLength(7)
    expect(o.completedByDay.at(-1)).toEqual({ date: '2026-10-19', count: 1 })
    expect(o.completedByDay.at(-2)).toEqual({ date: '2026-10-18', count: 1 })
    expect(o.projects[0]?.done).toBe(1)
  })
})

describe('proyectos: estadísticas e imagen', () => {
  it('overview cuenta por tipo de columna, el agente, lo próximo y la última actividad', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P', description: 'De qué va' })
    const cols = await app.columns.list(p.id)
    const of = (kind: string) => cols.find((c) => c.kind === kind)?.id
    await app.tasks.create({ projectId: p.id, title: 'sin fecha', columnId: of('backlog') })
    await app.tasks.create({ projectId: p.id, title: 'vencida', dueDate: '2026-10-10' })
    await app.tasks.create({ projectId: p.id, title: 'pronto', dueDate: '2026-10-21' })
    await app.tasks.create({ projectId: p.id, title: 'revisar', columnId: of('review') })
    await app.tasks.create({ projectId: p.id, title: 'agente', columnId: of('in_progress') })
    await app.projects.update(p.id, { agentColumnId: of('in_progress') })
    const hecha = await app.tasks.create({ projectId: p.id, title: 'hecha' })
    clock = new Date('2026-10-19T12:00:00Z')
    await app.tasks.complete(hecha.id)

    const [s] = (await app.overview()).projects
    expect(s?.description).toBe('De qué va')
    expect(s?.byKind).toEqual({ backlog: 1, todo: 2, in_progress: 1, review: 1 })
    expect(s?.done).toBe(1)
    expect(s?.agent).toBe(1)
    expect(s?.next.map((t) => t.title)).toEqual(['vencida', 'pronto'])
    expect(s?.lastActivityAt).toBe('2026-10-19T12:00:00.000Z')
  })

  it('guarda la imagen, la quita y vuelve a ella con «Deshacer»', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    expect(app.projects.imagesEnabled).toBe(true)
    const withImage = await app.projects.setImage(p.id, new Blob(['x'], { type: 'image/webp' }))
    const path = withImage.imagePath
    expect(path).toMatch(new RegExp(`^${p.id}/[\\w-]+\\.webp$`))
    expect(await app.projects.imageUrl(path as string)).toMatch(/^blob:/)

    expect((await app.projects.restoreImage(p.id, null)).imagePath).toBeNull()
    expect((await app.projects.restoreImage(p.id, path)).imagePath).toBe(path)
  })

  it('el logo y la portada se guardan por separado', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    expect(p.coverPath).toBeNull()
    const logo = (await app.projects.setImage(p.id, new Blob(['l'], { type: 'image/png' })))
      .imagePath as string
    const withCover = await app.projects.setImage(
      p.id,
      new Blob(['c'], { type: 'image/jpeg' }),
      'cover',
    )
    expect(withCover.imagePath).toBe(logo)
    expect(withCover.coverPath).toMatch(new RegExp(`^${p.id}/[\\w-]+\\.jpg$`))
    const cover = withCover.coverPath as string
    expect((await app.projects.restoreImage(p.id, null, 'cover')).coverPath).toBeNull()
    expect((await app.projects.restoreImage(p.id, cover, 'cover')).imagePath).toBe(logo)
    expect((await app.overview()).projects[0]?.coverPath).toBe(cover)
  })

  it('rechaza imágenes que no lo son, demasiado grandes o de otro proyecto', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const q = await app.projects.create({ name: 'Q' })
    await expect(
      app.projects.setImage(p.id, new Blob(['x'], { type: 'text/plain' })),
    ).rejects.toThrow(ValidationError)
    const big = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/jpeg' })
    await expect(app.projects.setImage(p.id, big)).rejects.toThrow(ValidationError)
    const other = (await app.projects.setImage(q.id, new Blob(['x'], { type: 'image/png' })))
      .imagePath as string
    await expect(app.projects.restoreImage(p.id, other)).rejects.toThrow(ValidationError)
    await expect(app.projects.restoreImage(p.id, `${p.id}/../x`)).rejects.toThrow(ValidationError)
  })

  it('isImageOf acepta la ruta con la carpeta del dueño de Supabase', () => {
    expect(isImageOf('p1', 'owner/p1/a.jpg')).toBe(true)
    expect(isImageOf('p1', 'p1/a.jpg')).toBe(true)
    expect(isImageOf('p1', 'p2/a.jpg')).toBe(false)
    expect(isImageOf('p1', 'p1/a/b.jpg')).toBe(false)
  })
})

describe('tareas: deshacer', () => {
  it('restaurar una tarea archivada la devuelve a su sitio', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 't' })
    await app.tasks.archive(t.id)
    expect(await app.tasks.list({ projectId: p.id })).toHaveLength(0)
    const restored = await app.tasks.restore(t.id)
    expect(restored.archivedAt).toBeNull()
    expect((await app.tasks.list({ projectId: p.id })).map((x) => x.id)).toEqual([t.id])
    expect((await app.recentActivity({ entityId: t.id })).map((a) => a.action)).toEqual([
      'restored',
      'archived',
      'created',
    ])
  })

  it('la actividad se puede pedir por entidad', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const a = await app.tasks.create({ projectId: p.id, title: 'a' })
    await app.tasks.create({ projectId: p.id, title: 'b' })
    await app.tasks.complete(a.id)
    const acts = await app.recentActivity({ entityId: a.id })
    expect(acts.map((x) => x.action)).toEqual(['completed', 'created'])
  })
})

describe('checklist', () => {
  it('cuenta hechos y total por tarea', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const a = await app.tasks.create({ projectId: p.id, title: 'a' })
    const b = await app.tasks.create({ projectId: p.id, title: 'b' })
    const one = await app.checklist.add(a.id, 'uno')
    await app.checklist.add(a.id, 'dos')
    await app.checklist.update(one.id, { done: true })
    expect(await app.checklist.counts([a.id, b.id])).toEqual({ [a.id]: { done: 1, total: 2 } })
    expect(await app.checklist.counts([])).toEqual({})
  })

  it('recrea un elemento borrado en su posición y con su estado', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    const t = await app.tasks.create({ projectId: p.id, title: 't' })
    await app.checklist.add(t.id, 'uno')
    const dos = await app.checklist.add(t.id, 'dos')
    await app.checklist.add(t.id, 'tres')
    await app.checklist.delete(dos.id)
    await app.checklist.add(t.id, 'dos', { index: 1, done: true })
    const items = await app.checklist.list(t.id)
    expect(items.map((i) => i.title)).toEqual(['uno', 'dos', 'tres'])
    expect(items[1]?.done).toBe(true)
  })
})

describe('ordenación', () => {
  it('rebalancea si dos claves colisionan', () => {
    const r = positionAt(
      [
        { id: 'a', position: 'a0' },
        { id: 'b', position: 'a0' },
      ],
      1,
    )
    expect(r.rebalance).toHaveLength(2)
    const [x, y] = r.rebalance ?? []
    expect(x && y && x.position < r.position && r.position < y.position).toBe(true)
  })
})

describe('notas', () => {
  it('las fijadas van primero', async () => {
    const { app } = setup()
    await app.notes.create({ title: 'normal' })
    clock = new Date('2026-10-19T11:00:00Z')
    await app.notes.create({ title: 'otra' })
    await app.notes.create({ title: 'fijada', pinned: true })
    expect((await app.notes.list()).map((n) => n.title)).toEqual(['fijada', 'otra', 'normal'])
  })

  it('archivar y restaurar', async () => {
    const { app } = setup()
    const n = await app.notes.create({ title: 'a' })
    await app.notes.archive(n.id)
    expect(await app.notes.list()).toHaveLength(0)
    const back = await app.notes.restore(n.id)
    expect(back.archivedAt).toBeNull()
    expect(await app.notes.list()).toHaveLength(1)
    const actions = (await app.recentActivity({ entityId: n.id })).map((a) => a.action)
    expect(actions).toEqual(['restored', 'archived', 'created'])
  })

  it('una nota de tarea es del proyecto de la tarea', async () => {
    const { app } = setup()
    const a = await app.projects.create({ name: 'A' })
    const b = await app.projects.create({ name: 'B' })
    const t = await app.tasks.create({ projectId: a.id, title: 't' })
    const n = await app.notes.create({ taskId: t.id })
    expect(n.projectId).toBe(a.id)
    await expect(app.notes.create({ taskId: t.id, projectId: b.id })).rejects.toThrow(
      ValidationError,
    )
    await expect(app.notes.update(n.id, { taskId: t.id, projectId: b.id })).rejects.toThrow(
      ValidationError,
    )
    // Cambiar de proyecto suelta la tarea; quitar el proyecto también.
    const moved = await app.notes.update(n.id, { projectId: b.id })
    expect(moved).toMatchObject({ projectId: b.id, taskId: null })
    // Vincular una tarea fija el proyecto sin pedirlo.
    const linked = await app.notes.update(n.id, { taskId: t.id })
    expect(linked).toMatchObject({ projectId: a.id, taskId: t.id })
    const free = await app.notes.update(n.id, { projectId: null })
    expect(free).toMatchObject({ projectId: null, taskId: null })
  })

  it('un cambio sin efecto no escribe ni anota', async () => {
    const { app, store } = setup()
    const n = await app.notes.create({ title: 'a', content: 'x' })
    clock = new Date('2026-10-19T10:05:00Z')
    const same = await app.notes.update(n.id, { title: 'a', content: 'x', pinned: false })
    expect(same.updatedAt).toBe(n.updatedAt)
    expect(store.snapshot().activity).toHaveLength(1)
  })

  it('el autoguardado no llena la actividad: una edición cada 10 minutos', async () => {
    const { app } = setup()
    const n = await app.notes.create({ title: 'a' })
    const edit = async (content: string, minutes: number) => {
      clock = new Date(clock.getTime() + minutes * 60_000)
      await app.notes.update(n.id, { content })
    }
    await edit('1', 0)
    await edit('12', 1)
    await edit('123', 2)
    expect((await app.recentActivity({ entityId: n.id })).map((a) => a.action)).toEqual([
      'updated',
      'created',
    ])
    await edit('1234', 11)
    expect(await app.recentActivity({ entityId: n.id })).toHaveLength(3)
  })

  it('fijar y desfijar se anotan aparte; vincular siempre se anota', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'A' })
    const n = await app.notes.create({ title: 'a' })
    await app.notes.update(n.id, { content: 'x' })
    await app.notes.update(n.id, { pinned: true })
    await app.notes.update(n.id, { pinned: false })
    await app.notes.update(n.id, { projectId: p.id })
    expect((await app.recentActivity({ entityId: n.id })).map((a) => a.action)).toEqual([
      'updated',
      'unpinned',
      'pinned',
      'updated',
      'created',
    ])
  })
})

describe('ajustes', () => {
  it('sin fila guardada devuelve los valores por defecto y no escribe', async () => {
    const { app, store } = setup()
    const s = await app.settings.get()
    expect(s.enabledModules).toEqual(['tasks', 'notes'])
    expect(s.preferences).toEqual({})
    expect(store.snapshot().settings).toBeNull()
  })

  it('fusiona las preferencias por clave y null borra la clave', async () => {
    const { app } = setup()
    await app.settings.update({ preferences: { appearance: { glass: false, accent: 'blue' } } })
    await app.settings.update({ preferences: { home: { widgets: ['today'] } } })
    let s = await app.settings.get()
    expect(s.preferences).toEqual({
      appearance: { glass: false, accent: 'blue' },
      home: { widgets: ['today'] },
    })
    await app.settings.update({ preferences: { home: null } })
    s = await app.settings.get()
    expect(s.preferences).toEqual({ appearance: { glass: false, accent: 'blue' } })
    expect(s.enabledModules).toEqual(['tasks', 'notes'])
  })

  it('valida los módulos', async () => {
    const { app } = setup()
    // @ts-expect-error módulo inexistente
    await expect(app.settings.update({ enabledModules: ['nope'] })).rejects.toThrow(ValidationError)
    const s = await app.settings.update({ enabledModules: ['tasks', 'finance'] })
    expect(s.enabledModules).toEqual(['tasks', 'finance'])
  })
})

describe('withActor', () => {
  it('escribe con otro actor sobre el mismo store y anota el contexto en la actividad', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'P' })
    let tool = 'create_task'
    const assistant = withActor(app, 'assistant', {
      activityContext: () => ({ conversation: 'c1', tool }),
    })
    const t = await assistant.tasks.create({ projectId: p.id, title: 'desde el asistente' })
    expect(t.source).toBe('mcp')
    tool = 'complete_task'
    await assistant.tasks.complete(t.id)
    const [done, created] = await app.recentActivity({ limit: 2 })
    expect(created).toMatchObject({
      actor: 'assistant',
      payload: { context: { tool: 'create_task' } },
    })
    expect(done).toMatchObject({
      actor: 'assistant',
      action: 'completed',
      payload: { context: { conversation: 'c1', tool: 'complete_task' } },
    })
    // El core original sigue siendo del usuario y sin contexto.
    await app.tasks.reopen(t.id)
    const [reopened] = await app.recentActivity({ limit: 1 })
    expect(reopened).toMatchObject({ actor: 'user' })
    expect(reopened?.payload.context).toBeUndefined()
    expect(() => withActor({} as never, 'assistant')).toThrow()
  })
})
