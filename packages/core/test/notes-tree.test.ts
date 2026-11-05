import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryStore, createMuninn, emptySnapshot, ValidationError } from '../src'

// Notas en árbol con un espacio por proyecto (ADR-0083).

let clock = new Date('2026-11-06T10:00:00Z')
const setup = () => {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  return { store, app: createMuninn(store, { now: () => clock, timeZone: 'UTC' }) }
}
const tick = () => {
  clock = new Date(clock.getTime() + 1000)
}

beforeEach(() => {
  clock = new Date('2026-11-06T10:00:00Z')
})

describe('árbol de notas', () => {
  it('una hija hereda el espacio de su madre y se ordena entre sus hermanas', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'Muninn' })
    const folder = await app.notes.create({
      title: 'Planificación',
      kind: 'folder',
      projectId: p.id,
    })
    const a = await app.notes.create({ title: 'a', parentId: folder.id })
    const c = await app.notes.create({ title: 'c', parentId: folder.id })
    const b = await app.notes.create({ title: 'b', parentId: folder.id, index: 1 })
    expect(folder.kind).toBe('folder')
    expect(a).toMatchObject({ projectId: p.id, parentId: folder.id, kind: 'page' })
    const level = await app.notes.list({ parentId: folder.id })
    expect(level.map((n) => n.title)).toEqual(['a', 'b', 'c'])
    expect(b.position > a.position && b.position < c.position).toBe(true)
    // La raíz del espacio solo tiene la carpeta; «General» está vacío.
    expect((await app.notes.list({ projectId: p.id, parentId: null })).map((n) => n.id)).toEqual([
      folder.id,
    ])
    expect(await app.notes.list({ projectId: null })).toHaveLength(0)
  })

  it('una hija no puede ir en otro espacio que su madre', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'A' })
    const q = await app.projects.create({ name: 'B' })
    const mother = await app.notes.create({ title: 'm', projectId: p.id })
    await expect(
      app.notes.create({ title: 'h', parentId: mother.id, projectId: q.id }),
    ).rejects.toThrow(ValidationError)
    await expect(
      app.notes.create({ title: 'h', parentId: mother.id, projectId: null }),
    ).rejects.toThrow(ValidationError)
    // Una nota de tarea de otro proyecto tampoco.
    const t = await app.tasks.create({ projectId: q.id, title: 't' })
    await expect(app.notes.create({ taskId: t.id, parentId: mother.id })).rejects.toThrow(
      ValidationError,
    )
  })

  it('mover se lleva el subárbol a otro espacio y se deshace volviendo a moverla', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'A' })
    const q = await app.projects.create({ name: 'B' })
    const root = await app.notes.create({ title: 'raíz', projectId: p.id })
    const child = await app.notes.create({ title: 'hija', parentId: root.id })
    const grandchild = await app.notes.create({ title: 'nieta', parentId: child.id })
    const target = await app.notes.create({ title: 'destino', projectId: q.id })

    const moved = await app.notes.move(root.id, { parentId: target.id })
    expect(moved).toMatchObject({ projectId: q.id, parentId: target.id })
    expect(await app.notes.get(child.id)).toMatchObject({ projectId: q.id, parentId: root.id })
    expect(await app.notes.get(grandchild.id)).toMatchObject({
      projectId: q.id,
      parentId: child.id,
    })
    expect((await app.notes.ancestors(grandchild.id)).map((n) => n.title)).toEqual([
      'destino',
      'raíz',
      'hija',
    ])

    // Deshacer: a la raíz de su espacio de antes.
    await app.notes.move(root.id, { parentId: null, projectId: p.id, index: 0 })
    expect(await app.notes.get(grandchild.id)).toMatchObject({ projectId: p.id })
    const actions = (await app.recentActivity({ entityId: root.id })).map((a) => a.action)
    expect(actions).toEqual(['moved', 'moved', 'created'])
  })

  it('no deja colgar una nota de sí misma ni de una descendiente', async () => {
    const { app } = setup()
    const a = await app.notes.create({ title: 'a' })
    const b = await app.notes.create({ title: 'b', parentId: a.id })
    await expect(app.notes.move(a.id, { parentId: a.id })).rejects.toThrow(ValidationError)
    await expect(app.notes.move(a.id, { parentId: b.id })).rejects.toThrow(ValidationError)
  })

  it('reordenar entre hermanas no anota actividad', async () => {
    const { app } = setup()
    await app.notes.create({ title: 'a' })
    const b = await app.notes.create({ title: 'b' })
    await app.notes.move(b.id, { index: 0 })
    expect((await app.notes.list({ projectId: null, parentId: null })).map((n) => n.title)).toEqual(
      ['b', 'a'],
    )
    expect((await app.recentActivity({ entityId: b.id })).map((x) => x.action)).toEqual(['created'])
  })

  it('una nota de tarea no sale de su proyecto, ni dentro de un subárbol', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'A' })
    const q = await app.projects.create({ name: 'B' })
    const t = await app.tasks.create({ projectId: p.id, title: 't' })
    const root = await app.notes.create({ title: 'raíz', projectId: p.id })
    await app.notes.create({ title: 'de tarea', taskId: t.id, parentId: root.id })
    await expect(app.notes.move(root.id, { parentId: null, projectId: q.id })).rejects.toThrow(
      ValidationError,
    )
    await expect(app.notes.update(root.id, { projectId: q.id })).rejects.toThrow(ValidationError)
    expect(await app.notes.get(root.id)).toMatchObject({ projectId: p.id })
  })

  it('cambiar de proyecto con update la saca de su madre y se lleva sus hijas', async () => {
    const { app } = setup()
    const p = await app.projects.create({ name: 'A' })
    const mother = await app.notes.create({ title: 'm', projectId: p.id })
    const n = await app.notes.create({ title: 'n', parentId: mother.id })
    const h = await app.notes.create({ title: 'h', parentId: n.id })
    const free = await app.notes.update(n.id, { projectId: null })
    expect(free).toMatchObject({ projectId: null, parentId: null })
    expect(await app.notes.get(h.id)).toMatchObject({ projectId: null, parentId: n.id })
  })

  it('archivar archiva las descendientes y un solo restaurar las devuelve', async () => {
    const { app } = setup()
    const root = await app.notes.create({ title: 'raíz' })
    const child = await app.notes.create({ title: 'hija', parentId: root.id })
    const old = await app.notes.create({ title: 'archivada antes', parentId: root.id })
    await app.notes.archive(old.id)
    tick()
    const grandchild = await app.notes.create({ title: 'nieta', parentId: child.id })

    tick()
    await app.notes.archive(root.id)
    expect(await app.notes.list()).toHaveLength(0)
    expect((await app.notes.get(grandchild.id)).archivedAt).not.toBeNull()

    tick()
    await app.notes.restore(root.id)
    expect((await app.notes.list()).map((n) => n.title).sort()).toEqual(['hija', 'nieta', 'raíz'])
    // La que ya estaba archivada sigue archivada.
    expect((await app.notes.get(old.id)).archivedAt).not.toBeNull()
  })

  it('restaurar una hija con la madre archivada la deja en la raíz', async () => {
    const { app } = setup()
    const root = await app.notes.create({ title: 'raíz' })
    const child = await app.notes.create({ title: 'hija', parentId: root.id })
    await app.notes.archive(child.id)
    tick()
    await app.notes.archive(root.id)
    const back = await app.notes.restore(child.id)
    expect(back).toMatchObject({ parentId: null, archivedAt: null })
    // No se puede colgar nada de una archivada.
    await expect(app.notes.create({ parentId: root.id })).rejects.toThrow(ValidationError)
  })

  it('borrar un proyecto deja su árbol entero en «General»', async () => {
    const { app, store } = setup()
    const p = await app.projects.create({ name: 'A' })
    const root = await app.notes.create({ title: 'raíz', projectId: p.id })
    const child = await app.notes.create({ title: 'hija', parentId: root.id })
    await store.projects.remove(p.id)
    expect(await app.notes.get(child.id)).toMatchObject({ projectId: null, parentId: root.id })
  })

  it('las notas de antes del árbol cargan en la raíz como páginas', async () => {
    const legacy = {
      id: crypto.randomUUID(),
      projectId: null,
      taskId: null,
      title: 'vieja',
      content: '',
      pinned: false,
      archivedAt: null,
      createdAt: clock.toISOString(),
      updatedAt: clock.toISOString(),
    }
    // biome-ignore lint/suspicious/noExplicitAny: una nota guardada antes de ADR-0083
    const store = createMemoryStore({ ...emptySnapshot(), notes: [legacy as any] })
    const app = createMuninn(store, { now: () => clock, timeZone: 'UTC' })
    expect(await app.notes.get(legacy.id)).toMatchObject({ parentId: null, kind: 'page' })
    const next = await app.notes.create({ title: 'nueva' })
    expect(next.position > 'a0').toBe(true)
  })
})
