import 'i18next'
import type { common } from './locales/en/common'
import type { dialogs } from './locales/en/dialogs'
import type { integrations } from './locales/en/integrations'
import type { palette } from './locales/en/palette'
import type { security } from './locales/en/security'
import type { settings } from './locales/en/settings'

// Claves tipadas desde los diccionarios en inglés (ADR-0077): una clave que no existe no compila. Cada namespace nuevo
// se añade aquí con su diccionario en inglés.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof common
      palette: typeof palette
      dialogs: typeof dialogs
      settings: typeof settings
      security: typeof security
      integrations: typeof integrations
    }
    returnNull: false
  }
}
