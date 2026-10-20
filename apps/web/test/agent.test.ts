import type { Muninn } from '@muninn/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { blocksAgentDrop, canBeAgentColumn, flushGithubSoon } from '../src/lib/agent'

describe('columna del agente', () => {
  it('se ofrece con repo y módulo GitHub, nunca en una columna «Hecho»', () => {
    const repo = { githubRepo: 'lopezz-dev/huginnDB' }
    expect(canBeAgentColumn(repo, true, { kind: 'todo' })).toBe(true)
    expect(canBeAgentColumn(repo, true, { kind: 'done' })).toBe(false)
    expect(canBeAgentColumn(repo, false, { kind: 'todo' })).toBe(false)
    expect(canBeAgentColumn({ githubRepo: null }, true, { kind: 'todo' })).toBe(false)
    expect(canBeAgentColumn(undefined, true, { kind: 'todo' })).toBe(false)
  })

  it('solo admite tareas de una issue', () => {
    const project = { agentColumnId: 'agente' }
    const github = { source: 'github' as const, externalId: 'o/r#1' }
    const manual = { source: 'manual' as const, externalId: null }
    expect(blocksAgentDrop(project, manual, 'agente')).toBe(true)
    expect(blocksAgentDrop(project, github, 'agente')).toBe(false)
    expect(blocksAgentDrop(project, manual, 'otra')).toBe(false)
    expect(blocksAgentDrop({ agentColumnId: null }, manual, 'agente')).toBe(false)
    expect(blocksAgentDrop(undefined, manual, 'agente')).toBe(false)
  })
})

describe('flushGithubSoon', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('agrupa los cambios seguidos en una sola llamada y no rompe si falla', async () => {
    vi.useFakeTimers()
    const syncNow = vi.fn(async () => {
      throw new Error('sin red')
    })
    const m = { github: { syncNow } } as unknown as Muninn
    flushGithubSoon(m, 1000)
    vi.advanceTimersByTime(500)
    flushGithubSoon(m, 1000)
    vi.advanceTimersByTime(999)
    expect(syncNow).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(syncNow).toHaveBeenCalledTimes(1)
    expect(syncNow).toHaveBeenCalledWith('outbox')
    await vi.runAllTimersAsync()
  })
})
