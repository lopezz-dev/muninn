import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOCK,
  moveDockTab,
  parseDock,
  sectionEnabled,
  sectionOf,
  tabIndexOf,
  tabsFor,
  toggleDockTab,
} from '../src/shell/nav'
import {
  bestMatch,
  filterItems,
  groupItems,
  matchRange,
  normalize,
  type PaletteItem,
  searchResultItems,
} from '../src/shell/palette-items'

describe('navegación', () => {
  it('sabe a qué sección pertenece cada ruta', () => {
    expect(sectionOf('/')).toBe('home')
    expect(sectionOf('/proyectos')).toBe('projects')
    expect(sectionOf('/proyectos/abc-123')).toBe('projects')
    expect(sectionOf('/ajustes/apariencia')).toBe('settings')
    expect(sectionOf('/no-existe')).toBeNull()
  })

  it('la pestaña activa es la de la sección; si no está en la barra, ninguna', () => {
    const tabs = parseDock(['home', 'projects', 'search'])
    expect(tabIndexOf('projects', tabs)).toBe(1)
    expect(tabIndexOf('notes', tabs)).toBe(-1)
    expect(tabIndexOf('settings', tabs)).toBe(-1)
    expect(tabIndexOf(null, tabs)).toBe(-1)
  })
})

describe('barra de abajo configurable', () => {
  it('sin guardar, o con algo que no vale, la de fábrica', () => {
    expect(parseDock(undefined)).toEqual(DEFAULT_DOCK)
    expect(parseDock('home')).toEqual(DEFAULT_DOCK)
    expect(parseDock([])).toEqual(DEFAULT_DOCK)
    expect(parseDock(['more', 'assistant', 'settings'])).toEqual(DEFAULT_DOCK)
  })

  it('quita repetidos y desconocidos y se queda con cuatro como mucho', () => {
    expect(parseDock(['notes', 'notes', 'more', 'search'])).toEqual(['notes', 'search'])
    expect(parseDock(['home', 'projects', 'notes', 'finance', 'news'])).toEqual([
      'home',
      'projects',
      'notes',
      'finance',
    ])
  })

  it('añadir y quitar: nunca vacía ni más de cuatro', () => {
    expect(toggleDockTab(['home', 'notes'], 'notes')).toEqual(['home'])
    expect(toggleDockTab(['home'], 'home')).toBeNull()
    expect(toggleDockTab(['home'], 'search')).toEqual(['home', 'search'])
    expect(toggleDockTab(['home', 'projects', 'notes', 'finance'], 'news')).toBeNull()
  })

  it('mover un puesto, sin salirse de los bordes', () => {
    expect(moveDockTab(['home', 'notes', 'finance'], 'notes', -1)).toEqual([
      'notes',
      'home',
      'finance',
    ])
    expect(moveDockTab(['home', 'notes'], 'home', -1)).toBeNull()
    expect(moveDockTab(['home', 'notes'], 'notes', 1)).toBeNull()
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
    expect(tabsFor(null)).toEqual(DEFAULT_DOCK)
  })

  it('la barra pierde la pestaña de un módulo desactivado; Buscar siempre se queda', () => {
    const tabs = tabsFor(only('tasks'), ['home', 'finance', 'notes', 'search'])
    expect(tabs).toEqual(['home', 'search'])
    expect(tabIndexOf('notes', tabs)).toBe(-1)
  })

  it('si no queda ninguna pestaña, Inicio', () => {
    expect(tabsFor(only('tasks'), ['finance'])).toEqual(['home'])
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

describe('tareas y notas en el buscador', () => {
  const found = {
    tasks: [{ id: 't1', title: 'Revisar factura', projectId: 'p1' }],
    notes: [
      { id: 'n1', title: '', projectId: null },
      { id: 'n2', title: 'Ideas de factura', projectId: 'p1' },
    ],
  }
  const projects = [{ id: 'p1', name: 'Casa' }]
  const opened: string[] = []
  const items = searchResultItems(found, projects, 'factura', {
    task: (t) => opened.push(`task:${t.id}`),
    note: (n) => opened.push(`note:${n.id}`),
  })

  it('las tareas llevan su proyecto y las notas sin título se nombran', () => {
    expect(items.map((i) => [i.group, i.label, i.hint])).toEqual([
      ['tasks', 'Revisar factura', 'Casa'],
      ['notes', 'Sin título', undefined],
      ['notes', 'Ideas de factura', 'Casa'],
    ])
  })

  it('no las quita el filtro aunque coincidan solo por el contenido, y van tras los proyectos', () => {
    const project: PaletteItem = {
      id: 'project-p1',
      group: 'projects',
      label: 'Factura anual',
      icon: 'projects',
      run: () => {},
    }
    const out = filterItems([...items, project], 'factura')
    expect(out.map((i) => i.id)).toEqual(['project-p1', 'task-t1', 'note-n1', 'note-n2'])
  })

  it('abren su detalle', () => {
    for (const it of items) it.run()
    expect(opened).toEqual(['task:t1', 'note:n1', 'note:n2'])
  })
})
