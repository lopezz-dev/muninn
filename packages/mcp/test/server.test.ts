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

describe('servidor MCP', () => {
  it('expone las herramientas esperadas', async () => {
    const { client } = await connect()
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['overview', 'create_task', 'move_task', 'project_status']),
    )
    expect(names).not.toContain('delete_task')
  })

  it('se presenta con el nombre, la descripción y el logo de Muninn', async () => {
    const { client } = await connect()
    const info = client.getServerVersion()
    expect(info?.title).toBe('Muninn')
    expect(info?.description).toMatch(/proyectos y tareas/)
    expect(info?.websiteUrl).toBe('https://muninn-sepia.vercel.app')
    expect(info?.icons?.[0]).toMatchObject({ mimeType: 'image/png', sizes: ['96x96'] })
    expect(info?.icons?.[0]?.src).toMatch(/^data:image\/png;base64,iVBORw0KGgo/)
  })

  it('flujo completo resolviendo proyecto y columna por nombre', async () => {
    const { call } = await connect()
    await call('create_project', { name: 'Muninn' })
    const task = (await call('create_task', { project: 'muninn', title: 'Montar MCP' })).data
    expect(task.source).toBe('mcp')

    await call('move_task', { taskId: task.id, column: 'En curso' })
    let status = (await call('project_status', { project: 'Muninn' })).data
    expect(status.inProgress.map((t: { title: string }) => t.title)).toEqual(['Montar MCP'])

    await call('complete_task', { taskId: task.id })
    status = (await call('project_status', { project: 'Muninn' })).data
    expect(status.counts.done).toBe(1)
  })

  it('devuelve errores legibles al modelo', async () => {
    const { call } = await connect()
    await call('create_project', { name: 'Uno' })
    const res = await call('create_task', { project: 'Inexistente', title: 'x' })
    expect(res.isError).toBe(true)
    expect(res.text).toContain('Uno')
  })
})
