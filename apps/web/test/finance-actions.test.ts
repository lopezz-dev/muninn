import { createMemoryStore, createMuninn, type Transaction } from '@muninn/core'
import { notify } from '@muninn/ui'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  archiveTransaction,
  createAccount,
  createCategory,
  moveCategory,
} from '../src/lib/finance-actions'
import { financeKeys } from '../src/lib/finance-queries'
import { archiveSubscription } from '../src/lib/subscription-actions'
import { clickUndo, infos, lastSuccess } from './undo'

vi.mock('@muninn/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@muninn/ui')>()),
  notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

async function setup() {
  const m = createMuninn(createMemoryStore())
  const qc = new QueryClient()
  const account = await m.finance.accounts.create({ name: 'Corriente', kind: 'checking' })
  return { m, qc, account }
}

beforeEach(() => vi.clearAllMocks())

describe('archivar un movimiento', () => {
  async function archived() {
    const s = await setup()
    const tx = await s.m.finance.transactions.create({
      kind: 'expense',
      amount: 500,
      accountId: s.account.id,
      concept: 'Pan',
    })
    s.qc.setQueryData(financeKeys.recent, [tx])
    expect(await archiveTransaction(s.m, s.qc, tx)).toBe(true)
    return { ...s, tx }
  }
  const recent = (qc: QueryClient) => qc.getQueryData<Transaction[]>(financeKeys.recent) ?? []

  it('lo quita de la lista y «Deshacer» lo restaura', async () => {
    const { m, qc, tx } = await archived()
    expect(notify.success).toHaveBeenCalledWith(
      'Movimiento archivado',
      expect.objectContaining({ icon: 'archive' }),
    )
    expect(recent(qc)).toEqual([])
    await clickUndo()
    expect(recent(qc).map((t) => t.id)).toEqual([tx.id])
    expect((await m.finance.transactions.list({ limit: 6 })).map((t) => t.id)).toEqual([tx.id])
    expect(infos()).toEqual(['Movimiento recuperado'])
  })

  it('si deshacer falla, vuelve la caché atrás y lo dice', async () => {
    const { m, qc } = await archived()
    vi.spyOn(m.finance.transactions, 'restore').mockRejectedValueOnce(new Error('sin red'))
    await clickUndo()
    expect(recent(qc)).toEqual([])
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo recuperar el movimiento', {
      description: 'sin red',
    })
  })
})

describe('crear cuenta y categoría', () => {
  it('«Deshacer» archiva la cuenta creada', async () => {
    const { m, qc } = await setup()
    const account = await createAccount(m, qc, { name: 'Hucha', kind: 'savings' })
    expect(notify.success).toHaveBeenCalledWith(
      'Cuenta «Hucha» creada',
      expect.objectContaining({ icon: 'plus' }),
    )
    await clickUndo()
    const list = await m.finance.accounts.list({ includeArchived: true })
    expect(list.find((a) => a.id === account?.id)?.archivedAt).not.toBeNull()
    expect(notify.info).toHaveBeenCalledWith('Cuenta «Hucha» deshecha', { icon: 'archive' })
  })

  it('si archivar la cuenta falla al deshacer, solo avisa del fallo', async () => {
    const { m, qc } = await setup()
    await createAccount(m, qc, { name: 'Hucha', kind: 'savings' })
    vi.spyOn(m.finance.accounts, 'archive').mockRejectedValueOnce(new Error('sin red'))
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo archivar la cuenta', {
      description: 'sin red',
    })
  })

  it('«Deshacer» archiva la categoría creada', async () => {
    const { m, qc } = await setup()
    const category = await createCategory(m, qc, { name: 'Mascotas', kind: 'expense' })
    await clickUndo()
    const list = await m.finance.categories.list({ includeArchived: true })
    expect(list.find((c) => c.id === category?.id)?.archivedAt).not.toBeNull()
    expect(notify.info).toHaveBeenCalledWith('Categoría «Mascotas» deshecha', { icon: 'archive' })
  })
})

describe('mover una categoría', () => {
  async function withCategories() {
    const s = await setup()
    const a = await s.m.finance.categories.create({ name: 'A', kind: 'income' })
    const b = await s.m.finance.categories.create({ name: 'B', kind: 'income' })
    const order = async () =>
      (await s.m.finance.categories.list())
        .filter((c) => c.kind === 'income' && [a.id, b.id].includes(c.id))
        .map((c) => c.name)
    return { ...s, a, b, order }
  }

  it('«Deshacer» la devuelve a donde estaba', async () => {
    const { m, qc, b, order } = await withCategories()
    qc.setQueryData(financeKeys.categories, await m.finance.categories.list())
    const income = (await m.finance.categories.list()).filter((c) => c.kind === 'income')
    const from = income.findIndex((c) => c.id === b.id)
    expect(await moveCategory(m, qc, b, 0)).toBe(true)
    expect(await order()).toEqual(['B', 'A'])
    const move = vi.spyOn(m.finance.categories, 'move')
    await clickUndo()
    expect(move).toHaveBeenCalledWith(b.id, from)
    expect(await order()).toEqual(['A', 'B'])
    expect(notify.info).toHaveBeenCalledWith('Orden deshecho', { icon: 'move' })
  })

  it('sin la lista en caché no sabe de dónde venía: avisa sin «Deshacer»', async () => {
    const { m, qc, b } = await withCategories()
    await moveCategory(m, qc, b, 0)
    expect(notify.success).toHaveBeenCalledWith('«B» movida', { icon: 'move', action: undefined })
  })
})

describe('archivar una suscripción', () => {
  async function archived() {
    const s = await setup()
    const sub = await s.m.finance.subscriptions.create({
      name: 'Música',
      amount: 999,
      frequency: 'monthly',
      accountId: s.account.id,
      nextDate: '2026-11-15',
    })
    await archiveSubscription(s.m, s.qc, sub)
    return { ...s, sub }
  }

  it('«Deshacer» la recupera', async () => {
    const { m, sub } = await archived()
    expect(lastSuccess()?.description).toBe('ya no avisará; sus cobros se conservan')
    await clickUndo()
    expect((await m.finance.subscriptions.list()).map((s) => s.id)).toEqual([sub.id])
    expect(infos()).toEqual(['«Música» recuperada'])
  })

  it('si deshacer falla, lo dice', async () => {
    const { m } = await archived()
    vi.spyOn(m.finance.subscriptions, 'restore').mockRejectedValueOnce(new Error('sin red'))
    await clickUndo()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('No se pudo recuperar la suscripción', {
      description: 'sin red',
    })
  })
})
