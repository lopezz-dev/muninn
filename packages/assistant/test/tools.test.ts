import { createMemoryStore, createMuninn, type Muninn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type Change, catalog, resolveProject } from '../src/tools'

const setup = () => createMuninn(createMemoryStore(), { actor: 'mcp', timeZone: 'UTC' })

/** Ejecuta una herramienta del catálogo como lo hace el MCP, validando los argumentos con su esquema. */
async function call(app: Muninn, name: string, args: Record<string, unknown>) {
  const tool = catalog.find((t) => t.name === name)
  if (!tool) throw new Error(`No existe ${name}`)
  const changes: Omit<Change, 'tool'>[] = []
  const parsed = z.object(tool.input).parse(args)
  const result = await tool.run({ app, changed: (c) => changes.push(c) }, parsed)
  return { result, changes }
}

describe('proyecto por nombre', () => {
  it('gana el activo sobre un archivado con el mismo nombre', async () => {
    const app = setup()
    const old = await app.projects.create({ name: 'Muninn' })
    await app.tasks.create({ projectId: old.id, title: 'vieja' })
    await app.projects.archive(old.id)
    const live = await app.projects.create({ name: 'Muninn' })
    await app.tasks.create({ projectId: live.id, title: 'nueva' })

    expect((await resolveProject(app, 'muninn')).id).toBe(live.id)
    const { result } = await call(app, 'list_tasks', { project: 'Muninn' })
    expect((result as { title: string }[]).map((t) => t.title)).toEqual(['nueva'])
  })

  it('el pausado también gana al archivado, y un archivado solo sigue valiendo', async () => {
    const app = setup()
    const archived = await app.projects.create({ name: 'Huginn' })
    await app.projects.archive(archived.id)
    expect((await resolveProject(app, 'Huginn')).id).toBe(archived.id)
    const paused = await app.projects.create({ name: 'Huginn' })
    await app.projects.update(paused.id, { status: 'paused' })
    expect((await resolveProject(app, 'Huginn')).id).toBe(paused.id)
  })

  it('con varios sin archivar, error claro con los ids', async () => {
    const app = setup()
    const a = await app.projects.create({ name: 'Web' })
    const b = await app.projects.create({ name: 'web' })
    await expect(resolveProject(app, 'WEB')).rejects.toThrow(/2 proyectos.*Usa el id/)
    await expect(resolveProject(app, 'WEB')).rejects.toThrow(a.id)
    await expect(resolveProject(app, 'WEB')).rejects.toThrow(b.id)
  })

  it('el nombre exacto gana a los que lo contienen', async () => {
    const app = setup()
    await app.projects.create({ name: 'App móvil' })
    const exact = await app.projects.create({ name: 'App' })
    expect((await resolveProject(app, 'app')).id).toBe(exact.id)
    await expect(resolveProject(app, 'ap')).rejects.toThrow(/2 proyectos/)
  })
})

describe('create_task y create_tasks', () => {
  it('create_task crea también el checklist', async () => {
    const app = setup()
    await app.projects.create({ name: 'Muninn' })
    const { result } = await call(app, 'create_task', {
      project: 'Muninn',
      title: 'Lote',
      checklist: ['uno', 'dos'],
    })
    expect((result as { checklist: { title: string }[] }).checklist.map((i) => i.title)).toEqual([
      'uno',
      'dos',
    ])
  })

  it('create_tasks crea en orden, informa de cada fallo y deshace archivando', async () => {
    const app = setup()
    const p = await app.projects.create({ name: 'Muninn' })
    await app.projects.create({ name: 'Otro' })
    const { result, changes } = await call(app, 'create_tasks', {
      project: 'Muninn',
      tasks: [
        { title: 'a', checklist: ['a1', 'a2'] },
        { title: 'b', column: 'no existe' },
        { title: 'c', project: 'Otro', column: 'backlog' },
        { title: 'd', project: 'Fantasma' },
        { title: 'e', column: 'En curso' },
      ],
    })
    const { created, failed, results } = result as {
      created: number
      failed: number
      results: { index: number; ok: boolean; id?: string; checklist?: number; error?: string }[]
    }
    expect([created, failed]).toEqual([3, 2])
    expect(results.map((r) => [r.index, r.ok])).toEqual([
      [0, true],
      [1, false],
      [2, true],
      [3, false],
      [4, true],
    ])
    expect(results[0]?.checklist).toBe(2)
    expect(results[1]?.error).toMatch(/Columna "no existe"/)
    expect(results[3]?.error).toMatch(/Fantasma/)
    expect(
      (await app.tasks.list({ projectId: p.id })).map((t) => [t.title, t.column.kind]),
    ).toEqual([
      ['a', 'todo'],
      ['e', 'in_progress'],
    ])

    expect(changes).toHaveLength(1)
    await changes[0]?.undo(app)
    expect(await app.tasks.list({})).toEqual([])
  })

  it('create_tasks sin proyecto en ningún sitio falla solo en esa tarea', async () => {
    const app = setup()
    await app.projects.create({ name: 'Muninn' })
    const { result } = await call(app, 'create_tasks', {
      tasks: [{ title: 'suelta' }, { title: 'con', project: 'Muninn' }],
    })
    const { results } = result as { results: { ok: boolean; error?: string }[] }
    expect(results.map((r) => r.ok)).toEqual([false, true])
    expect(results[0]?.error).toMatch(/Falta el proyecto/)
  })

  it('create_tasks admite como mucho 50', async () => {
    const tool = catalog.find((t) => t.name === 'create_tasks')
    const schema = z.object(tool?.input ?? {})
    const tasks = Array.from({ length: 51 }, (_, i) => ({ title: `t${i}` }))
    expect(schema.safeParse({ project: 'x', tasks }).success).toBe(false)
    expect(schema.safeParse({ project: 'x', tasks: tasks.slice(0, 50) }).success).toBe(true)
  })
})
