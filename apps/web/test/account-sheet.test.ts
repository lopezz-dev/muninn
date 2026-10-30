import { beforeEach, describe, expect, it } from 'vitest'
import { accountSheet, settingsViewOf } from '../src/lib/account-sheet'

describe('hoja «Tu cuenta»', () => {
  beforeEach(() => {
    accountSheet.close()
    accountSheet.open()
    accountSheet.close()
  })

  it('sabe qué sección de Ajustes pide una ruta', () => {
    expect(settingsViewOf('/ajustes')).toBe('root')
    expect(settingsViewOf('/ajustes/')).toBe('root')
    expect(settingsViewOf('/ajustes/notificaciones')).toBe('notificaciones')
    expect(settingsViewOf('/ajustes/notificaciones/otra')).toBeNull()
    expect(settingsViewOf('/ajustesx')).toBeNull()
    expect(settingsViewOf('/proyectos')).toBeNull()
  })

  it('un enlace directo la abre ya en la sección, con la raíz debajo para volver', () => {
    accountSheet.open('notificaciones')
    expect(accountSheet.get()).toEqual({ open: true, stack: ['root', 'notificaciones'] })
    accountSheet.pop()
    expect(accountSheet.get().stack).toEqual(['root'])
    accountSheet.pop()
    expect(accountSheet.get().stack).toEqual(['root'])
  })

  it('abierta, un enlace a otra sección se apila encima (y no repite la que ya se ve)', () => {
    accountSheet.open()
    accountSheet.push('cuenta')
    accountSheet.open('modulos')
    accountSheet.open('modulos')
    expect(accountSheet.get().stack).toEqual(['root', 'cuenta', 'modulos'])
  })

  it('el avatar la abre siempre en la raíz', () => {
    accountSheet.open('apariencia')
    accountSheet.close()
    accountSheet.open()
    expect(accountSheet.get()).toEqual({ open: true, stack: ['root'] })
  })
})
