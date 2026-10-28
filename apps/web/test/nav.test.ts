import { describe, expect, it } from 'vitest'
import { sectionEnabled, sectionOf, TABS, tabIndexOf, tabsFor } from '../src/shell/nav'
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

  it('la barra del teléfono tiene cuatro pestañas y lo demás vive en «Más»', () => {
    expect(TABS).toEqual(['home', 'projects', 'finance', 'more'])
    expect(tabIndexOf('projects')).toBe(1)
    expect(tabIndexOf('notes')).toBe(3)
    expect(tabIndexOf('settings')).toBe(3)
    expect(tabIndexOf(null)).toBe(3)
  })

  it('en el Asistente no hay pestaña activa: se marca su botón', () => {
    expect(tabIndexOf('assistant')).toBe(-1)
  })
})

describe('módulos activos', () => {
  const only = (...m: ('tasks' | 'notes' | 'finance' | 'github' | 'news' | 'focus')[]) => new Set(m)

  it('una sección sin módulo siempre está; el resto, según los módulos', () => {
    const m = only('tasks')
    expect(sectionEnabled('home', m)).toBe(true)
    expect(sectionEnabled('docs', m)).toBe(true)
    expect(sectionEnabled('settings', m)).toBe(true)
    expect(sectionEnabled('projects', m)).toBe(true)
    expect(sectionEnabled('notes', m)).toBe(false)
    expect(sectionEnabled('finance', m)).toBe(false)
  })

  it('mientras no se sepa (null) se enseña todo', () => {
    expect(sectionEnabled('finance', null)).toBe(true)
    expect(tabsFor(null)).toEqual(TABS)
  })

  it('la barra pierde la pestaña de un módulo desactivado y la activa se recalcula', () => {
    const tabs = tabsFor(only('tasks', 'notes'))
    expect(tabs).toEqual(['home', 'projects', 'more'])
    expect(tabIndexOf('projects', tabs)).toBe(1)
    expect(tabIndexOf('notes', tabs)).toBe(2)
    expect(tabIndexOf('finance', tabs)).toBe(2)
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
