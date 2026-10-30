import { createMemoryStore, createMuninn } from '@muninn/core'
import { notify } from '@muninn/ui'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createColumn, deleteColumn, moveColumn } from '../src/lib/column-actions'
import { boardQuery, deleteArchivedWithUndo } from '../src/lib/queries'
import { moveTask } from '../src/lib/task-actions'
import { clickUndo, infos, lastSuccess } from './undo'

vi.mock('@muninn/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@muninn/ui')>()),
  notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

/** Un proyecto con sus columnas por defecto, una tarea en la primera y el tablero en caché. */
async function setup() {
  const m = createMuninn(createMemoryStore())
  const qc = new QueryClient()
  const p = await m.projects.create({ name: 'P' })
  const task = await m.tasks.create({ projectId: p.id, title: 'Escribir' })
  const board = await qc.fetchQuery(boardQuery(m, p.id))
  // `first`, la de la tarea; `second`, otra cualquiera.
  const first = board.columns.find((c) => c.id === task.columnId)
  const second = board.columns.find((c) => c.id !== task.columnId)
  if (!first || !second) throw new Error('el proyecto nace con columnas')
  const columnOf = async () => (await m.tasks.get(task.id))?.columnId
  return { m, qc, p, task, first, second, columnOf }
}

beforeEach(() => vi.clearAllMocks())

describe('mover una tarea', () => {
  it('«Deshacer» la devuelve a su columna', async () => {
    const { m, qc, p, task, first, second, columnOf } = await setup()
    await moveTask(m, qc, { projectId: p.id, taskId: task.id, columnId: second.id })
    expect(notify.success).toHaveBeenCalledWith(
      `«Escribir» movida a ${second.name}`,
      expect.objectContaining({ icon: 'move' }),
    )
    expect(await columnOf()).toBe(second.id)
    await clickUndo()
    expect(await columnOf()).toBe(first.id)
    expect(notify.info).toHaveBeenCalledWith('Movimiento deshecho', { icon: 'move' })
    // Deshacer no ofrece otro «Deshacer».
    expect(notify.success).toHaveBeenCalledOnce()
  })

  it('si deshacer falla, avisa del fallo y no dice «deshecho»', async () => {
    const { m, qc, p, task, second } = await setup()
    await moveTask(m, qc, { projectId: p.id, taskId: task.id, columnId: second.id })
    vi.spyOn(m.tasks, 'move').mockRejectedValueOnce(new Error('sin red'))
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo mover la tarea', {
      description: 'sin red',
    })
  })

  it('sin tablero en caché ni columna de origen, avisa sin «Deshacer»', async () => {
    const { m, p, task, second } = await setup()
    await moveTask(m, new QueryClient(), { projectId: p.id, taskId: task.id, columnId: second.id })
    expect(lastSuccess()?.action).toBeUndefined()
  })
})

describe('columnas', () => {
  it('crear: «Deshacer» la quita', async () => {
    const { m, qc, p } = await setup()
    const col = await createColumn(m, qc, { projectId: p.id, name: 'Ideas', kind: 'todo' })
    await clickUndo()
    expect((await m.columns.list(p.id)).some((c) => c.id === col?.id)).toBe(false)
    expect(infos()).toEqual(['Columna «Ideas» quitada'])
  })

  it('crear: si quitarla falla, lo dice', async () => {
    const { m, qc, p } = await setup()
    await createColumn(m, qc, { projectId: p.id, name: 'Ideas', kind: 'todo' })
    vi.spyOn(m.columns, 'delete').mockRejectedValueOnce(new Error('sin red'))
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo quitar la columna', {
      description: 'sin red',
    })
  })

  it('mover: «Deshacer» la devuelve a su sitio', async () => {
    const { m, qc, p, first } = await setup()
    const at = async () => (await m.columns.list(p.id)).findIndex((c) => c.id === first.id)
    const from = await at()
    const to = from === 0 ? 1 : 0
    await moveColumn(m, qc, first, to)
    expect(await at()).toBe(to)
    await clickUndo()
    expect(await at()).toBe(from)
    expect(notify.info).toHaveBeenCalledWith('Movimiento deshecho', { icon: 'move' })
  })

  it('borrar: «Deshacer» la recrea en su sitio con sus tareas', async () => {
    const { m, qc, p, first, second, columnOf } = await setup()
    const from = (await m.columns.list(p.id)).findIndex((c) => c.id === first.id)
    await deleteColumn(m, qc, first, second)
    expect(await columnOf()).toBe(second.id)
    await clickUndo()
    const back = (await m.columns.list(p.id))[from]
    expect(back?.name).toBe(first.name)
    expect(await columnOf()).toBe(back?.id)
    expect(infos()).toEqual([`Columna «${first.name}» recuperada`])
  })

  it('borrar: si recrearla falla, lo dice', async () => {
    const { m, qc, first, second } = await setup()
    await deleteColumn(m, qc, first, second)
    vi.spyOn(m.columns, 'create').mockRejectedValueOnce(new Error('sin red'))
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo recuperar la columna', {
      description: 'sin red',
    })
  })
})

describe('eliminar proyectos archivados (ADR-0065)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('espera lo que dura el aviso; «Deshacer» los devuelve sin borrar nada', async () => {
    const m = createMuninn(createMemoryStore())
    const p = await m.projects.archive((await m.projects.create({ name: 'Viejo' })).id)
    const view = { hide: vi.fn(), show: vi.fn() }
    deleteArchivedWithUndo(m, new QueryClient(), [p], view)
    expect(view.hide).toHaveBeenCalledWith([p.id])
    expect(notify.success).toHaveBeenCalledWith(
      '«Viejo» eliminado',
      expect.objectContaining({ icon: 'trash', duration: 6000 }),
    )
    await lastSuccess()?.action?.onClick()
    expect(view.show).toHaveBeenCalledWith([p.id])
    expect(infos()).toEqual(['Proyecto devuelto a Archivados'])
    await vi.advanceTimersByTimeAsync(10_000)
    expect((await m.projects.list({ includeArchived: true })).map((x) => x.id)).toEqual([p.id])
  })

  it('sin «Deshacer», los borra al acabar el aviso', async () => {
    const m = createMuninn(createMemoryStore())
    const p = await m.projects.archive((await m.projects.create({ name: 'Viejo' })).id)
    const view = { hide: vi.fn(), show: vi.fn() }
    deleteArchivedWithUndo(m, new QueryClient(), [p], view)
    await vi.advanceTimersByTimeAsync(6000)
    expect(await m.projects.list({ includeArchived: true })).toEqual([])
    expect(view.show).toHaveBeenCalledWith([])
  })
})
