import { describe, expect, it } from 'vitest'
import { bySection, changedPrefs } from '../src/lib/settings-changes'
import { SETTINGS_INDEX, searchSettings } from '../src/lib/settings-search'
import { SETTINGS_SECTIONS, settingsSection } from '../src/screens/ajustes/sections'

const DEF = { glass: true, accent: 'amber' } as const
const REPORT = { enabled: false, time: '08:30' }

describe('ajustes cambiados (ADR-0053)', () => {
  it('nada cambiado con los valores de fábrica', () => {
    expect(changedPrefs(DEF, REPORT, DEF)).toEqual([])
  })

  it('marca cada preferencia que no está en su valor de fábrica y las agrupa por sección', () => {
    const keys = changedPrefs(
      { glass: false, accent: 'blue' },
      { enabled: true, time: '07:00' },
      DEF,
    )
    expect(keys).toEqual(['glass', 'accent', 'reportEnabled', 'reportTime'])
    expect(bySection(keys)).toEqual({
      apariencia: ['glass', 'accent'],
      informe: ['reportEnabled', 'reportTime'],
    })
  })

  it('el cristal de fábrica depende del sistema: se compara con el que toca', () => {
    const sinCristal = { glass: false, accent: 'amber' } as const
    expect(changedPrefs(sinCristal, REPORT, sinCristal)).toEqual([])
  })
})

describe('buscador de ajustes', () => {
  const label = (id: string) => settingsSection(id)?.label ?? ''

  it('sin texto, nada', () => {
    expect(searchSettings(SETTINGS_INDEX, '  ', label)).toEqual([])
  })

  it('busca sin tildes en nombre, descripción, palabras clave y sección', () => {
    expect(searchSettings(SETTINGS_INDEX, 'ACENTO', label).map((e) => e.id)).toEqual(['acento'])
    expect(searchSettings(SETTINGS_INDEX, 'transparencia', label).map((e) => e.id)).toEqual([
      'cristal',
    ])
    // «Informe de la mañana» es el nombre de la sección: encuentra sus tres filas.
    expect(searchSettings(SETTINGS_INDEX, 'manana', label).map((e) => e.id)).toEqual([
      'informe-activo',
      'informe-hora',
      'informe-ahora',
    ])
  })

  it('primero lo que lo tiene en el nombre', () => {
    const ids = searchSettings(SETTINGS_INDEX, 'hora', label).map((e) => e.id)
    expect(ids[0]).toBe('informe-hora')
  })

  it('cada entrada apunta a una sección que existe y no repite fila', () => {
    for (const e of SETTINGS_INDEX) expect(settingsSection(e.section), e.id).toBeTruthy()
    expect(new Set(SETTINGS_INDEX.map((e) => e.id)).size).toBe(SETTINGS_INDEX.length)
  })

  it('las secciones tienen grupo, subtítulo e icono', () => {
    for (const s of SETTINGS_SECTIONS) {
      expect(s.subtitle, s.id).toBeTruthy()
      expect(s.icon, s.id).toBeTruthy()
    }
  })
})
