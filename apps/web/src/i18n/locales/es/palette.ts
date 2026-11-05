import type { Messages } from '../../types'
import type { palette as en } from '../en/palette'

/** Textos de `palette` en español. Mismas claves que `en/palette.ts`: si falta una, no compila. */
export const palette: Messages<typeof en> = {
  input: {
    label: 'Buscar o preguntar',
    placeholder: 'Busca o pregunta…',
    close: 'Cerrar',
  },
  results: {
    label: 'Resultados',
    empty: 'Escribe para buscar.',
  },
  groups: {
    ask: 'Preguntar',
    nav: 'Ir a',
    projects: 'Proyectos',
    tasks: 'Tareas',
    notes: 'Notas',
    actions: 'Acciones',
  },
  ask: {
    muninn: 'Preguntar a Muninn: «{{query}}»',
    news: 'Buscar en Noticias: «{{query}}»',
  },
  items: {
    board: 'Tablero',
    newNote: 'Nueva nota',
    newProject: 'Nuevo proyecto…',
    glassOff: 'Desactivar el cristal',
    glassOn: 'Activar el cristal',
    appearance: 'Cambiar la apariencia…',
    signOut: 'Cerrar sesión',
    leaveDemo: 'Salir del modo demo',
  },
  keywords: {
    home: 'hoy resumen dashboard',
    projects: 'kanban tablero tareas',
    finance: 'gastos ingresos dinero cuentas',
    assistant: 'jarvis ia chat claude',
    docs: 'ayuda guia manual',
    settings: 'preferencias configuracion apariencia',
    newNote: 'crear anadir escribir apunte',
    newProject: 'crear anadir',
    glass: 'blur desenfoque transparencia apariencia',
    appearance: 'acento color tema',
    signOut: 'salir logout desconectar cuenta',
  },
  footer: {
    move: 'Moverse',
    open: 'Abrir',
    hint: 'Secciones, proyectos, tareas, notas y acciones · o pregunta a Muninn',
  },
}
