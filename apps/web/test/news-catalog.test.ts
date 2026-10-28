import { describe, expect, it } from 'vitest'
import { NEWS_CATALOG, sameFeed } from '../src/lib/news-catalog'

describe('catálogo de fuentes oficiales', () => {
  const all = NEWS_CATALOG.flatMap((g) => g.sources)

  it('sin duplicados, todas https y con título y descripción', () => {
    expect(new Set(all.map((s) => s.url)).size).toBe(all.length)
    for (const s of all) {
      expect(s.url).toMatch(/^https:\/\//)
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.about.length).toBeGreaterThan(0)
    }
    // El tema se guarda como `topic` de la fuente: máximo 40 caracteres (schemas.ts).
    for (const g of NEWS_CATALOG) expect(g.topic.length).toBeLessThanOrEqual(40)
  })

  it('reconoce la misma fuente aunque cambie la forma de escribirla', () => {
    expect(sameFeed('https://www.boe.es/rss/boe.php', 'http://boe.es/rss/boe.php')).toBe(true)
    expect(sameFeed('https://github.blog/feed/', 'https://github.blog/feed')).toBe(true)
    expect(sameFeed('https://github.blog/feed/', 'https://github.blog/changelog/feed/')).toBe(false)
  })
})
