import { describe, expect, it } from 'vitest'
import {
  BOARD_VIEW_KEY,
  readBoardView,
  saveBoardView,
  type ViewStorage,
} from '../src/lib/board-view'

const memory = (initial: Record<string, string> = {}): ViewStorage & { data: typeof initial } => {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

describe('vista del tablero', () => {
  it('por defecto es el tablero y se recuerda por proyecto', () => {
    const s = memory()
    expect(readBoardView('p1', s)).toBe('board')
    saveBoardView('p1', 'list', s)
    expect(readBoardView('p1', s)).toBe('list')
    expect(readBoardView('p2', s)).toBe('board')
  })

  it('volver a «Tablero» quita la entrada', () => {
    const s = memory()
    saveBoardView('p1', 'list', s)
    saveBoardView('p1', 'board', s)
    expect(JSON.parse(s.data[BOARD_VIEW_KEY] ?? '')).toEqual({})
  })

  it('ignora lo que no entiende y sobrevive sin almacenamiento', () => {
    expect(readBoardView('p1', memory({ [BOARD_VIEW_KEY]: '{"p1":"calendar"}' }))).toBe('board')
    expect(readBoardView('p1', memory({ [BOARD_VIEW_KEY]: 'no es json' }))).toBe('board')
    expect(readBoardView('p1', memory({ [BOARD_VIEW_KEY]: '["list"]' }))).toBe('board')
    expect(readBoardView('p1', null)).toBe('board')
    expect(() => saveBoardView('p1', 'list', null)).not.toThrow()
    const broken: ViewStorage = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(readBoardView('p1', broken)).toBe('board')
    expect(() => saveBoardView('p1', 'list', broken)).not.toThrow()
  })

  it('recuerda como mucho 200 proyectos, los más recientes', () => {
    const s = memory()
    for (let i = 0; i < 205; i++) saveBoardView(`p${i}`, 'list', s)
    expect(readBoardView('p0', s)).toBe('board')
    expect(readBoardView('p4', s)).toBe('board')
    expect(readBoardView('p5', s)).toBe('list')
    expect(readBoardView('p204', s)).toBe('list')
  })
})
