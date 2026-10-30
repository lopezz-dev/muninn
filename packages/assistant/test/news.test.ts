import { createMemoryStore, createMuninn, parseFeed } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import {
  type ChatMessage,
  cleanDigest,
  createScriptedProvider,
  DIGEST_MAX_ITEMS,
  digestPrompt,
  generateDigest,
  runAssistant,
} from '../src'

const RSS = (n: number) => `<rss><channel><title>Blog de Tauri</title><link>https://tauri.app</link>
${Array.from(
  { length: n },
  (_, i) =>
    `<item><title>Artículo ${i} sobre HuginnDB</title><link>https://tauri.app/${i}</link><description>Resumen ${i}</description></item>`,
).join('')}
</channel></rss>`

async function setup(n = 3) {
  const app = createMuninn(createMemoryStore(), { timeZone: 'Europe/Madrid' })
  await app.projects.create({ name: 'HuginnDB' })
  const s = await app.news.sources.create({ url: 'https://tauri.app/rss.xml', topic: 'Tauri' })
  await app.news.ingest(s.id, { feed: parseFeed(RSS(n)), etag: null, lastModified: null })
  return app
}

describe('resumen diario de noticias', () => {
  it('sin artículos no llama al modelo', async () => {
    let called = false
    const provider = createScriptedProvider([
      {
        when: () => {
          called = true
          return true
        },
        steps: [{ text: '- x' }],
      },
    ])
    expect(
      await generateDigest({ provider, items: [], sources: [], projects: [], today: '2026-10-22' }),
    ).toBeNull()
    expect(called).toBe(false)
  })

  it('manda fuente, proyectos relacionados y como mucho DIGEST_MAX_ITEMS; limpia el razonamiento', async () => {
    const app = await setup(DIGEST_MAX_ITEMS + 5)
    const items = await app.news.items.list()
    let seen: ChatMessage[] = []
    const provider = createScriptedProvider([
      {
        when: () => true,
        steps: [
          {
            text: (m) => {
              seen = m
              return '<think>pienso</think>\n- **Tauri**: guía nueva, relacionada con HuginnDB.'
            },
          },
        ],
      },
    ])
    const out = await generateDigest({
      provider,
      items,
      sources: await app.news.sources.list(),
      projects: await app.projects.list(),
      today: app.today(),
    })
    expect(out?.content).toBe('- **Tauri**: guía nueva, relacionada con HuginnDB.')
    expect(out?.itemIds).toHaveLength(DIGEST_MAX_ITEMS)
    const user = seen.find((m) => m.role === 'user')?.content ?? ''
    expect(user.split('\n').filter((l) => /^\d+\./.test(l))).toHaveLength(DIGEST_MAX_ITEMS)
    expect(user).toContain('[Blog de Tauri]')
    expect(user).toContain('(relacionada con HuginnDB)')
    expect(seen[0]?.role).toBe('system')
  })

  it('una fuente muy activa no deja fuera a las demás', async () => {
    const app = await setup(DIGEST_MAX_ITEMS + 5)
    const busy = await app.news.items.list()
    // El de la otra fuente es el más antiguo: sin repartir, quedaría fuera de los DIGEST_MAX_ITEMS.
    const quiet = {
      ...busy[0],
      id: 'node-1',
      sourceId: 'node',
      title: 'Node.js 27',
    } as (typeof busy)[0]
    const provider = createScriptedProvider([{ when: () => true, steps: [{ text: '- x' }] }])
    const out = await generateDigest({
      provider,
      items: [...busy, quiet],
      sources: await app.news.sources.list(),
      projects: [],
      today: app.today(),
    })
    expect(out?.itemIds).toHaveLength(DIGEST_MAX_ITEMS)
    expect(out?.itemIds).toContain('node-1')
  })

  it('prompt y limpieza', () => {
    expect(cleanDigest('\n\n- a\n\n\n\n- b  ')).toBe('- a\n\n- b')
    const [system] = digestPrompt({ items: [], sources: [], projects: [], today: '2026-10-22' })
    expect(system?.content).toContain('jueves, 22 de octubre')
  })
})

describe('herramientas de noticias', () => {
  it('list_news con fuente y proyectos relacionados; news_digest', async () => {
    const app = await setup(2)
    await app.news.digests.save({ date: app.today(), content: '- Hoy, poco.' })
    const res = await runAssistant([{ role: 'user', content: 'noticias' }], {
      app,
      provider: createScriptedProvider([
        {
          when: () => true,
          steps: [
            {
              calls: [
                { name: 'list_news', arguments: { topic: 'tauri', limit: 5 } },
                { name: 'news_digest', arguments: {} },
              ],
            },
            { text: 'Listo.' },
          ],
        },
      ]),
    })
    expect(res.tools.map((t) => t.status)).toEqual(['ok', 'ok'])
    const [list, digest] = res.messages
      .filter((m) => m.role === 'tool')
      .map((m) => JSON.parse(m.content))
    expect(list[0]).toMatchObject({ source: 'Blog de Tauri', relatedProjects: ['HuginnDB'] })
    expect(digest.content).toBe('- Hoy, poco.')
  })
})
