import { createMemoryStore, createMuninn } from '@muninn/core'
import { notify } from '@muninn/ui'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteArchivedTasksWithUndo } from '../src/lib/task-actions'

vi.mock('@muninn/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@muninn/ui')>()),
  notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

/** Un proyecto con dos tareas archivadas y la vista de «Tareas archivadas» de mentira. */
async function setup() {
  const m = createMuninn(createMemoryStore())
  const p = await m.projects.create({ name: 'P' })
  const a = await m.tasks.archive((await m.tasks.create({ projectId: p.id, title: 'a' })).id)
  const b = await m.tasks.archive((await m.tasks.create({ projectId: p.id, title: 'b' })).id)
  const tasks = [a, b]
  const view = { hide: vi.fn(), show: vi.fn() }
  return { m, p, tasks, view, qc: new QueryClient() }
}

/** La acción «Deshacer» del último aviso de éxito. */
const undo = () => {
  const opts = vi.mocked(notify.success).mock.calls.at(-1)?.[1] as {
    action: { onClick: () => void }
  }
  opts.action.onClick()
}

const archived = async (m: ReturnType<typeof createMuninn>, projectId: string) =>
  (await m.tasks.list({ projectId, includeArchived: true })).length

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('eliminar tareas archivadas (ADR-0067)', () => {
  it('las quita de la vista al instante y no borra nada hasta que acaba el aviso', async () => {
    const { m, p, tasks, view, qc } = await setup()
    deleteArchivedTasksWithUndo(m, qc, p.id, tasks, view)
    expect(view.hide).toHaveBeenCalledWith(tasks.map((t) => t.id))
    expect(notify.success).toHaveBeenCalledWith('2 tareas eliminadas', expect.anything())
    await vi.advanceTimersByTimeAsync(5000)
    expect(await archived(m, p.id)).toBe(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await archived(m, p.id)).toBe(0)
    expect(view.show).toHaveBeenCalledWith([])
  })

  it('«Deshacer» las devuelve sin haber borrado nada', async () => {
    const { m, p, tasks, view, qc } = await setup()
    deleteArchivedTasksWithUndo(m, qc, p.id, tasks, view)
    undo()
    expect(view.show).toHaveBeenCalledWith(tasks.map((t) => t.id))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await archived(m, p.id)).toBe(2)
  })

  it('si una falla, vuelve a la lista y lo dice', async () => {
    const { m, p, tasks, view, qc } = await setup()
    // Recuperada por otro dispositivo mientras corría el aviso: el core ya no la deja borrar.
    await m.tasks.restore(tasks[0]?.id ?? '')
    deleteArchivedTasksWithUndo(m, qc, p.id, tasks, view)
    await vi.advanceTimersByTimeAsync(6000)
    expect(view.show).toHaveBeenLastCalledWith([tasks[0]?.id])
    expect(notify.error).toHaveBeenCalledWith('No se pudo eliminar todo', expect.anything())
  })
})
