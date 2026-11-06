import { describe, expect, it } from 'vitest'
import { createMemoryStore, createMuninn, defaultCategories, defaultColumns } from '../src'

const names = (xs: { name: string }[]) => xs.map((x) => x.name)

describe('lo que se crea por defecto, en el idioma de quien lo crea (ADR-0077)', () => {
  it('las columnas y las categorías existen en los dos idiomas con los mismos tipos y claves', () => {
    expect(defaultColumns('en').map((c) => c.kind)).toEqual(defaultColumns('es').map((c) => c.kind))
    expect(names(defaultColumns('en'))).toEqual([
      'Backlog',
      'To do',
      'In progress',
      'Review',
      'Done',
    ])
    expect(names(defaultColumns('es'))).toEqual([
      'Backlog',
      'Pendiente',
      'En curso',
      'Revisión',
      'Hecho',
    ])
    expect(defaultCategories('en').map((c) => c.key)).toEqual(
      defaultCategories('es').map((c) => c.key),
    )
    expect(names(defaultCategories('en'))).toContain('Groceries')
    expect(names(defaultCategories('es'))).toContain('Supermercado')
  })

  it('usa el idioma que le pasa quien llama', async () => {
    const m = createMuninn(createMemoryStore(), { locale: () => 'es' })
    const p = await m.projects.create({ name: 'P' })
    expect(names(await m.columns.list(p.id))).toEqual(names(defaultColumns('es')))
    expect(names(await m.finance.categories.list())).toEqual(names(defaultCategories('es')))
  })

  it('sin idioma, el de la cuenta; con «automático», inglés', async () => {
    const store = createMemoryStore()
    const m = createMuninn(store)
    const en = await m.projects.create({ name: 'A' })
    expect(names(await m.columns.list(en.id))).toEqual(names(defaultColumns('en')))
    await m.settings.update({ preferences: { locale: 'es' } })
    const es = await m.projects.create({ name: 'B' })
    expect(names(await m.columns.list(es.id))).toEqual(names(defaultColumns('es')))
    expect(names(await m.finance.categories.list())).toEqual(names(defaultCategories('es')))
  })

  it('el idioma se lee al crear: cambiarlo después no renombra lo que ya hay', async () => {
    let locale: 'en' | 'es' = 'en'
    const m = createMuninn(createMemoryStore(), { locale: () => locale })
    const p = await m.projects.create({ name: 'P' })
    locale = 'es'
    const q = await m.projects.create({ name: 'Q' })
    expect(names(await m.columns.list(p.id))).toContain('To do')
    expect(names(await m.columns.list(q.id))).toContain('Pendiente')
  })
})
