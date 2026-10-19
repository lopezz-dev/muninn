import { describe, expect, it } from 'vitest'
import { DOCK, dockIndexOf, sectionOf } from '../src/shell/nav'
import {
  bestMatch,
  filterItems,
  groupItems,
  matchRange,
  normalize,
  type PaletteItem,
} from '../src/shell/palette-items'

describe('navegación', () => {
  it('sabe a qué sección pertenece cada ruta', () => {
    expect(sectionOf('/')).toBe('home')
    expect(sectionOf('/proyectos')).toBe('projects')
    expect(sectionOf('/proyectos/abc-123')).toBe('projects')
    expect(sectionOf('/ajustes/apariencia')).toBe('settings')
    expect(sectionOf('/no-existe')).toBeNull()
  })

  it('el dock tiene el Asistente en el centro y lo demás vive en «Más»', () => {
    expect(DOCK).toEqual(['home', 'projects', 'assistant', 'finance', 'more'])
    expect(dockIndexOf('projects')).toBe(1)
    expect(dockIndexOf('notes')).toBe(4)
    expect(dockIndexOf('settings')).toBe(4)
    expect(dockIndexOf(null)).toBe(4)
  })
})

const item = (label: string, group: PaletteItem['group'] = 'nav', keywords?: string) =>
  ({ id: label, label, group, icon: 'home', keywords, run: () => {} }) as PaletteItem

describe('buscador ⌘K', () => {
  const items = [
    item('Inicio'),
    item('Documentación'),
    item('Ajustes', 'nav', 'preferencias apariencia'),
    item('Muninn', 'projects'),
    item('Nuevo proyecto…', 'actions'),
  ]

  it('ignora mayúsculas y tildes sin cambiar la longitud', () => {
    expect(normalize('Documentación')).toBe('documentacion')
    expect(normalize('Documentación')).toHaveLength('Documentación'.length)
  })

  it('encuentra por etiqueta o por sinónimos', () => {
    expect(filterItems(items, 'documentacion').map((i) => i.label)).toEqual(['Documentación'])
    expect(filterItems(items, 'PREFER').map((i) => i.label)).toEqual(['Ajustes'])
  })

  it('exige todas las palabras', () => {
    expect(filterItems(items, 'nuevo proy').map((i) => i.label)).toEqual(['Nuevo proyecto…'])
    expect(filterItems(items, 'nuevo inicio')).toEqual([])
  })

  it('ordena por grupo y, dentro, lo que empieza por la búsqueda', () => {
    const r = filterItems(
      [item('Ver Muninn', 'nav'), item('Muninn', 'projects'), item('Mundo')],
      'mun',
    )
    expect(r.map((i) => i.label)).toEqual(['Mundo', 'Ver Muninn', 'Muninn'])
    expect(groupItems(r).map((g) => g.group)).toEqual(['nav', 'projects'])
  })

  it('resalta el tramo que coincide aunque lleve tilde', () => {
    expect(matchRange('Documentación', 'acion')).toEqual([8, 13])
    expect(matchRange('Inicio', 'xyz')).toBeNull()
    expect(matchRange('Inicio', '  ')).toBeNull()
  })
})

describe('preselección del buscador', () => {
  const ask = item('Preguntar a Muninn: «nuevo»', 'ask', 'nuevo')
  const list = [ask, item('Notas'), item('Nuevo proyecto…', 'actions')]

  it('elige lo que empieza por lo escrito antes que preguntar', () => {
    expect(bestMatch(list, 'nuevo')).toBe(2)
    expect(bestMatch(list, 'NOT')).toBe(1)
  })

  it('sin coincidencia clara, pregunta a Muninn', () => {
    expect(bestMatch(list, 'firma')).toBe(0)
    expect(bestMatch(list, '')).toBe(0)
  })
})
