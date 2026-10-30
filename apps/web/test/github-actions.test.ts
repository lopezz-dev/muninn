import { createMemoryStore, createMuninn } from '@muninn/core'
import { notify } from '@muninn/ui'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setAgentColumn } from '../src/lib/agent'
import { moveProjectRepo, setProjectRepo } from '../src/lib/github'
import { clickUndo, infos } from './undo'

vi.mock('@muninn/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@muninn/ui')>()),
  notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

async function setup() {
  const m = createMuninn(createMemoryStore())
  const qc = new QueryClient()
  const a = await m.projects.create({ name: 'A' })
  const b = await m.projects.create({ name: 'B' })
  const repoOf = async (id: string) => (await m.projects.get(id))?.githubRepo ?? null
  return { m, qc, a, b, repoOf }
}

beforeEach(() => vi.clearAllMocks())

describe('repositorio de un proyecto', () => {
  it('vincular: «Deshacer» lo desvincula', async () => {
    const { m, qc, a, repoOf } = await setup()
    expect(await setProjectRepo(m, qc, a, 'o/r')).toBe(true)
    expect(notify.success).toHaveBeenCalledWith(
      '«A» vinculado a o/r',
      expect.objectContaining({ icon: 'link' }),
    )
    await clickUndo()
    expect(await repoOf(a.id)).toBeNull()
    expect(infos()).toEqual(['«A» sin repositorio'])
    expect(notify.success).toHaveBeenCalledOnce()
  })

  it('vincular: si deshacer falla, solo avisa del fallo', async () => {
    const { m, qc, a } = await setup()
    await setProjectRepo(m, qc, a, 'o/r')
    vi.spyOn(m.projects, 'update').mockRejectedValueOnce(new Error('sin red'))
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo guardar el repositorio', {
      description: 'sin red',
    })
  })

  it('pasarlo a otro proyecto: «Deshacer» lo devuelve', async () => {
    const { m, qc, a, b, repoOf } = await setup()
    await m.projects.update(a.id, { githubRepo: 'o/r' })
    expect(await moveProjectRepo(m, qc, a, b, 'o/r')).toBe(true)
    expect(notify.success).toHaveBeenCalledWith(
      'o/r va ahora con «B»',
      expect.objectContaining({ icon: 'link', description: 'Ya no está vinculado a «A».' }),
    )
    expect([await repoOf(a.id), await repoOf(b.id)]).toEqual([null, 'o/r'])
    await clickUndo()
    expect([await repoOf(a.id), await repoOf(b.id)]).toEqual(['o/r', null])
    expect(infos()).toEqual(['o/r vuelve a «A»'])
    expect(notify.success).toHaveBeenCalledOnce()
  })
})

describe('columna del agente', () => {
  it('«Deshacer» la devuelve a la de antes', async () => {
    const { m, qc, a } = await setup()
    const columns = await m.columns.list(a.id)
    const [first] = columns
    if (!first) throw new Error('el proyecto nace con columnas')
    expect(await setAgentColumn(m, qc, a, columns, first.id)).toBe(true)
    expect(notify.success).toHaveBeenCalledWith(
      `«${first.name}» es ahora la columna del agente`,
      expect.objectContaining({ icon: 'agent' }),
    )
    await clickUndo()
    expect((await m.projects.get(a.id))?.agentColumnId).toBeNull()
    expect(infos()).toEqual(['Sin columna del agente'])
    expect(notify.success).toHaveBeenCalledOnce()
  })

  it('si deshacer falla, solo avisa del fallo', async () => {
    const { m, qc, a } = await setup()
    const columns = await m.columns.list(a.id)
    await setAgentColumn(m, qc, a, columns, columns[0]?.id ?? null)
    vi.spyOn(m.projects, 'update').mockRejectedValueOnce(new Error('sin red'))
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo cambiar la columna del agente', {
      description: 'sin red',
    })
  })
})
