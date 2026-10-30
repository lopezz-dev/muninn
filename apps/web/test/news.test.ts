import type { NewsItem, NewsSource } from '@muninn/core'
import { describe, expect, it } from 'vitest'
import {
  collapseRuns,
  filterNews,
  newSince,
  noteFromItem,
  SAVED_TAB,
  topicTabs,
} from '../src/lib/news'

const source = (id: string, topic: string | null): NewsSource =>
  ({ id, topic, title: `Fuente ${id}` }) as NewsSource
const item = (id: string, sourceId: string, over: Partial<NewsItem> = {}): NewsItem =>
  ({
    id,
    sourceId,
    title: `Título ${id}`,
    summary: '',
    url: `https://x.test/${id}`,
    publishedAt: null,
    fetchedAt: '2026-10-22T07:00:00Z',
    savedAt: null,
    readAt: null,
    ...over,
  }) as NewsItem

const sources = [source('a', 'Rust'), source('b', 'IA local'), source('c', null)]
const items = [
  item('1', 'a', { title: 'Rust 2.0 llega', savedAt: '2026-10-22T08:00:00Z' }),
  item('2', 'b', { summary: 'Modelos con herramientas' }),
  item('3', 'c'),
  item('4', 'a', { publishedAt: '2026-10-20T00:00:00Z' }),
]

describe('noticias en la web', () => {
  it('filtra por fuente', () => {
    expect(
      filterNews(items, sources, { tab: null, source: 'a', search: '' }).map((i) => i.id),
    ).toEqual(['1', '4'])
  })

  it('pliega las rachas de una misma fuente y respeta las desplegadas', () => {
    const list = [
      ...['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map((id) => item(id, 'exp')),
      item('n1', 'node'),
      ...['e7', 'e8', 'e9', 'e10'].map((id) => item(id, 'exp')),
    ]
    const view = (rows: ReturnType<typeof collapseRuns>) =>
      rows.map((r) => (r.kind === 'item' ? r.item.id : `+${r.items.length}`))
    // 6 seguidos: 3 y «+3»; 4 seguidos: no se pliega por esconder uno solo.
    expect(view(collapseRuns(list))).toEqual([
      'e1',
      'e2',
      'e3',
      '+3',
      'n1',
      'e7',
      'e8',
      'e9',
      'e10',
    ])
    expect(collapseRuns(list).find((r) => r.kind === 'more')).toMatchObject({
      key: 'e1',
      sourceId: 'exp',
    })
    expect(view(collapseRuns(list, new Set(['e1'])))).toHaveLength(list.length)
  })

  it('filtra por tema, guardadas y texto (sin tildes ni mayúsculas)', () => {
    expect(filterNews(items, sources, { tab: null, search: '' })).toHaveLength(4)
    expect(filterNews(items, sources, { tab: 'Rust', search: '' }).map((i) => i.id)).toEqual([
      '1',
      '4',
    ])
    expect(filterNews(items, sources, { tab: SAVED_TAB, search: '' }).map((i) => i.id)).toEqual([
      '1',
    ])
    expect(
      filterNews(items, sources, { tab: null, search: 'HERRAMIENTAS' }).map((i) => i.id),
    ).toEqual(['2'])
    expect(filterNews(items, sources, { tab: null, search: 'llegá' }).map((i) => i.id)).toEqual([
      '1',
    ])
  })

  it('busca palabra a palabra en cualquier orden, entre título y resumen', () => {
    const f = (search: string) => filterNews(items, sources, { tab: null, search }).map((i) => i.id)
    expect(f('llega rust')).toEqual(['1'])
    expect(f('herramientas título 2')).toEqual(['2'])
    expect(f('rust herramientas')).toEqual([])
  })

  it('pestañas de temas con su número, sin las fuentes sin tema', () => {
    expect(topicTabs(items, sources)).toEqual([
      ['IA local', 1],
      ['Rust', 2],
    ])
  })

  it('nuevas en las últimas 24 horas, por publicación o descarga', () => {
    expect(newSince(items, Date.parse('2026-10-22T10:00:00Z'))).toBe(3)
  })

  it('la nota de un artículo lleva el resumen y el enlace', () => {
    expect(noteFromItem(item('9', 'a', { summary: 'Resumen' }), 'Blog')).toBe(
      'Resumen\n\n[Leer en Blog](https://x.test/9)',
    )
    expect(noteFromItem(item('9', 'a'), undefined)).toBe('[Leer en la fuente](https://x.test/9)')
  })
})
