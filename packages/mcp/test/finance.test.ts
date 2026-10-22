import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMemoryStore, createMuninn } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import { createMuninnMcpServer } from '../src/server'

async function connect() {
  const server = createMuninnMcpServer(createMuninn(createMemoryStore(), { actor: 'mcp' }))
  const client = new Client({ name: 'test', version: '0.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(a), client.connect(b)])
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args })
    const text = (res.content as { text: string }[])[0]?.text ?? ''
    return { isError: Boolean(res.isError), text, data: res.isError ? null : JSON.parse(text) }
  }
  return { client, call }
}

describe('MCP · finanzas', () => {
  it('expone lectura y escritura, sin borrados', async () => {
    const { client } = await connect()
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'list_finance_accounts',
        'list_transactions',
        'create_transaction',
        'archive_transaction',
      ]),
    )
    expect(names.some((n) => n.startsWith('delete'))).toBe(false)
  })

  it('apunta en euros, resuelve por nombre y devuelve céntimos y texto', async () => {
    const { call } = await connect()
    await call('create_finance_account', {
      name: 'Imagin',
      kind: 'checking',
      initialBalance: '1.000',
    })
    await call('create_finance_account', { name: 'Hucha', kind: 'savings', goal: 12000 })

    const gasto = (
      await call('create_transaction', {
        kind: 'expense',
        amount: '24,90',
        category: 'ocio',
        concept: 'Cine',
      })
    ).data
    expect(gasto).toMatchObject({ amount: 2490, account: 'Imagin', category: 'Ocio' })
    expect(gasto.amountText).toMatch(/^24,90\s€$/)

    await call('create_transaction', {
      kind: 'transfer',
      amount: 600,
      account: 'imagin',
      toAccount: 'hucha',
    })
    const accounts = (await call('list_finance_accounts')).data
    expect(accounts.map((a: { name: string; balance: number }) => [a.name, a.balance])).toEqual([
      ['Imagin', 100_000 - 2490 - 60_000],
      ['Hucha', 60_000],
    ])

    const list = (await call('list_transactions', { account: 'Hucha' })).data
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ kind: 'transfer', toAccount: 'Hucha' })

    const edited = (
      await call('update_transaction', { transactionId: gasto.id, amount: 30, category: null })
    ).data
    expect(edited).toMatchObject({ amount: 3000, category: null })

    await call('archive_transaction', { transactionId: gasto.id })
    expect((await call('list_transactions', { kinds: ['expense'] })).data).toHaveLength(0)
  })

  it('errores legibles: sin cuentas, cuenta desconocida, importe raro', async () => {
    const { call } = await connect()
    let res = await call('create_transaction', { kind: 'expense', amount: 5 })
    expect(res.isError).toBe(true)
    expect(res.text).toContain('create_finance_account')

    await call('create_finance_account', { name: 'Imagin', kind: 'checking' })
    res = await call('create_transaction', { kind: 'expense', amount: 5, account: 'BBVA' })
    expect(res.isError).toBe(true)
    expect(res.text).toContain('Imagin')

    res = await call('create_transaction', { kind: 'expense', amount: 'mucho' })
    expect(res.isError).toBe(true)
    expect(res.text).toContain('Importe no válido')
  })

  it('suscripciones: crear, avisar, apuntar el cobro una sola vez y archivar', async () => {
    const { call } = await connect()
    await call('create_finance_account', { name: 'Imagin', kind: 'checking' })
    const sub = (
      await call('create_subscription', {
        name: 'Spotify',
        amount: '10,99',
        frequency: 'monthly',
        nextDate: '2026-01-15',
      })
    ).data
    expect(sub).toMatchObject({ amount: 1099, frequency: 'monthly', remindDays: 3 })
    expect(sub.categoryId).toBeTruthy()

    const upcoming = (await call('list_subscriptions', { upcomingDays: 3 })).data
    expect(upcoming.map((x: { name: string }) => x.name)).toEqual(['Spotify'])

    const charged = (await call('record_subscription_charge', { subscription: 'spotify' })).data
    expect(charged.transaction).toMatchObject({ amount: 1099, category: 'Suscripciones' })
    expect(charged.subscription.nextDate).toBe('2026-02-15')

    const skipped = (await call('skip_subscription_charge', { subscription: 'Spotify' })).data
    expect(skipped.nextDate).toBe('2026-03-15')

    await call('archive_subscription', { subscription: 'Spotify' })
    expect((await call('list_subscriptions')).data).toHaveLength(0)
  })

  it('saldo inicial negativo', async () => {
    const { call } = await connect()
    const a = (
      await call('create_finance_account', {
        name: 'Tarjeta',
        kind: 'other',
        initialBalance: '-20,50',
      })
    ).data
    expect(a.balance).toBe(-2050)
  })
})
