import type { Messages } from '../../types'
import type { projects as en } from '../en/projects'

/** Textos de `projects` en español. Mismas claves que `en/projects.ts`: si falta una, no compila. */
export const projects: Messages<typeof en> = {
  title: 'Proyectos',
  summary: {
    active_one: '{{count}} activo',
    active_other: '{{count}} activos',
    openTasks_one: '{{count}} tarea abierta',
    openTasks_other: '{{count}} tareas abiertas',
  },
  kind: {
    backlog_one: '{{count}} en backlog',
    backlog_other: '{{count}} en backlog',
    todo_one: '{{count}} pendiente',
    todo_other: '{{count}} pendientes',
    in_progress_one: '{{count}} en curso',
    in_progress_other: '{{count}} en curso',
    review_one: '{{count}} en revisión',
    review_other: '{{count}} en revisión',
  },
  open_one: '{{count}} abierta',
  open_other: '{{count}} abiertas',
  done_one: '{{count}} hecha',
  done_other: '{{count}} hechas',
  overdue_one: '{{count}} vencida',
  overdue_other: '{{count}} vencidas',
  stateBar: '{{open}} y {{done}}',
  chip: {
    inProgress: '{{count}} en curso',
    agent: '{{count}} con el agente',
    upToDate: 'Al día',
  },
  card: {
    noTasksYet: 'Sin tareas todavía',
    addDescription: '+ Añade una descripción',
    edit: 'Editar {{name}}',
    next: 'Lo próximo',
    noDate: 'Sin fecha',
    activity: 'Actividad {{when}}',
    task: 'Tarea',
    editShort: 'Editar',
  },
  archived: {
    title: 'Archivados',
    deleteAll: 'Eliminar todos',
    stillLinked: 'Sigue vinculado a {{repo}}',
    restore: 'Recuperar',
    delete: 'Eliminar «{{name}}»',
    deleteForever: 'Eliminar para siempre',
  },
  search: 'Buscar proyecto',
  empty: {
    title: 'Todavía no hay proyectos',
    body: 'Un proyecto agrupa tareas en un tablero Kanban. Ponle una imagen y una descripción para reconocerlo de un vistazo, y vincúlalo a un repositorio de GitHub si quieres.',
  },
  filter: {
    label: 'Filtrar proyectos',
    all: 'Todos · {{n}}',
    overdue: 'Con vencidas · {{n}}',
    github: 'Con GitHub · {{n}}',
  },
  sort: {
    label: 'Orden',
    urgency: 'Urgencia',
    activity: 'Actividad reciente',
    name: 'Nombre',
  },
  noMatch: 'Ningún proyecto se llama «{{query}}».',
  noneInFilter: 'Ningún proyecto con este filtro.',
  image: {
    notImage: '«{{name}}» no es una imagen',
    cantOpen: 'No puedo abrir «{{name}}»',
    noCanvas: 'El navegador no deja procesar imágenes',
    failed: 'No se pudo preparar la imagen',
  },
}
