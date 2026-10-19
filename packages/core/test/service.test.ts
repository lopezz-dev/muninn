import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMemoryStore,
  createMuninn,
  DEFAULT_COLUMNS,
  positionAt,
  ValidationError,
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
})

describe('tareas', () => {
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
