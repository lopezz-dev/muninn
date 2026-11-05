import 'i18next'
import type { assistant } from './locales/en/assistant'
import type { auth } from './locales/en/auth'
import type { board } from './locales/en/board'
import type { common } from './locales/en/common'
import type { dialogs } from './locales/en/dialogs'
import type { docs } from './locales/en/docs'
import type { finance } from './locales/en/finance'
import type { github } from './locales/en/github'
import type { home } from './locales/en/home'
import type { integrations } from './locales/en/integrations'
import type { news } from './locales/en/news'
import type { notes } from './locales/en/notes'
import type { palette } from './locales/en/palette'
import type { projects } from './locales/en/projects'
import type { security } from './locales/en/security'
import type { settings } from './locales/en/settings'
import type { task } from './locales/en/task'

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
      board: typeof board
      task: typeof task
      home: typeof home
      projects: typeof projects
      notes: typeof notes
      docs: typeof docs
      finance: typeof finance
      assistant: typeof assistant
      news: typeof news
      github: typeof github
      auth: typeof auth
    }
    returnNull: false
  }
}
