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
