import { notify } from '@muninn/ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyUndo } from '../src/lib/feedback'
import { previousValues } from '../src/lib/mutations'

vi.mock('@muninn/ui', () => ({ notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

/** Pulsa «Deshacer» en el último aviso de éxito. */
async function clickUndo() {
  const opts = vi.mocked(notify.success).mock.lastCall?.[1]
  expect(opts?.action?.label).toBe('Deshacer')
  await opts?.action?.onClick()
}

beforeEach(() => vi.clearAllMocks())

describe('notifyUndo', () => {
  it('avisa con «Deshacer» y, al deshacer, con el texto por defecto', async () => {
    const undo = vi.fn(async () => {})
    notifyUndo('Tarea archivada', { icon: 'archive', id: 'x', undo })
    expect(notify.success).toHaveBeenCalledWith(
      'Tarea archivada',
      expect.objectContaining({ icon: 'archive', id: 'x' }),
    )
    await clickUndo()
    expect(undo).toHaveBeenCalledOnce()
    expect(notify.info).toHaveBeenCalledWith('Cambio deshecho', undefined)
  })

  it('acepta título y opciones para el aviso de deshecho', async () => {
    notifyUndo('Nota creada', {
      undo: async () => {},
      undone: ['Nota archivada', { icon: 'archive' }],
    })
    await clickUndo()
    expect(notify.info).toHaveBeenCalledWith('Nota archivada', { icon: 'archive' })
  })

  it('si la inversa devuelve false (ya avisó ella), no dice nada más', async () => {
    notifyUndo('Cambio', { undo: async () => false })
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('acepta una inversa síncrona', async () => {
    let back = false
    notifyUndo('Proyecto eliminado', {
      undo: () => {
        back = true
      },
      undone: 'Proyecto devuelto',
    })
    await clickUndo()
    expect(back).toBe(true)
    expect(notify.info).toHaveBeenCalledWith('Proyecto devuelto', undefined)
  })

  it('sin inversa (`null`), avisa igual pero sin «Deshacer»', () => {
    notifyUndo('Categoría movida', { icon: 'move', undo: null })
    expect(notify.success).toHaveBeenCalledWith('Categoría movida', { icon: 'move' })
  })

  it('si la inversa falla, avisa del error en vez de perderlo', async () => {
    notifyUndo('Subtarea quitada', {
      undo: async () => {
        throw new Error('sin red')
      },
      failTitle: 'No se pudo recuperar la subtarea',
    })
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo recuperar la subtarea', {
      description: 'sin red',
    })
  })
})

describe('previousValues', () => {
  it('devuelve solo los campos del parche, con su valor anterior', () => {
    const task = { title: 'A', priority: 'low', dueDate: null as string | null }
    expect(previousValues(task, { priority: 'high', dueDate: '2026-11-01' })).toEqual({
      priority: 'low',
      dueDate: null,
    })
  })
})
