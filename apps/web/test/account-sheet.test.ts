import { beforeEach, describe, expect, it } from 'vitest'
import { accountSheet, settingsViewOf } from '../src/lib/account-sheet'

describe('hoja «Tu cuenta»', () => {
  beforeEach(() => {
    accountSheet.close()
    accountSheet.open()
    accountSheet.close()
  })

  it('sabe qué sección de Ajustes pide una ruta', () => {
    expect(settingsViewOf('/settings')).toBe('root')
    expect(settingsViewOf('/settings/')).toBe('root')
    expect(settingsViewOf('/settings/notifications')).toBe('notifications')
    expect(settingsViewOf('/settings/notifications/otra')).toBeNull()
    expect(settingsViewOf('/settingsx')).toBeNull()
    expect(settingsViewOf('/projects')).toBeNull()
  })

  it('un enlace directo la abre ya en la sección, con la raíz debajo para volver', () => {
    accountSheet.open('notifications')
    expect(accountSheet.get()).toEqual({ open: true, stack: ['root', 'notifications'] })
    accountSheet.pop()
    expect(accountSheet.get().stack).toEqual(['root'])
    accountSheet.pop()
    expect(accountSheet.get().stack).toEqual(['root'])
  })

  it('abierta, un enlace a otra sección se apila encima (y no repite la que ya se ve)', () => {
    accountSheet.open()
    accountSheet.push('account')
    accountSheet.open('modules')
    accountSheet.open('modules')
    expect(accountSheet.get().stack).toEqual(['root', 'account', 'modules'])
  })

  it('el avatar la abre siempre en la raíz', () => {
    accountSheet.open('appearance')
    accountSheet.close()
    accountSheet.open()
    expect(accountSheet.get()).toEqual({ open: true, stack: ['root'] })
  })
})
