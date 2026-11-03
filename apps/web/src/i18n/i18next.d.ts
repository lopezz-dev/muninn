import 'i18next'
import type { common } from './locales/en/common'

// Claves tipadas desde los diccionarios en inglés (ADR-0077): una clave que no existe no compila. Cada namespace nuevo
// se añade aquí con su diccionario en inglés.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: { common: typeof common }
    returnNull: false
  }
}
