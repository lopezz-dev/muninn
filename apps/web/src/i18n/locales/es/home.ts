import type { Messages } from '../../types'
import type { home as en } from '../en/home'

/** Textos de `home` en español. Mismas claves que `en/home.ts`: si falta una, no compila. */
export const home: Messages<typeof en> = {
  greeting: {
    morning: 'Buenos días',
    afternoon: 'Buenas tardes',
    night: 'Buenas noches',
  },
  greetingNamed: {
    morning: 'Buenos días, {{name}}',
    afternoon: 'Buenas tardes, {{name}}',
    night: 'Buenas noches, {{name}}',
  },
  summary: {
    overdue_one: '{{count}} vencida',
    overdue_other: '{{count}} vencidas',
    dueToday_one: '{{count}} tarea para hoy',
    dueToday_other: '{{count}} tareas para hoy',
    nothingDue: 'Nada vence hoy',
    inProgress: '{{count}} en curso',
  },
  newTask: 'Nueva tarea',
  askMuninn: 'Preguntar a Muninn',
  row: {
    complete: 'Completar: {{title}}',
    reopen: 'Reabrir: {{title}}',
    doneAt: 'Hecha {{time}}',
  },
  clear: {
    title: 'Día despejado',
    description: 'Nada vence hoy ni está atrasado.',
    next: 'Lo siguiente',
    noDates: 'Cuando pongas fechas a tus tareas, aparecerán aquí por urgencia.',
  },
  empty: {
    projectsTitle: 'Empieza por un proyecto',
    projects:
      'Cada proyecto trae su tablero Kanban. Aquí verás lo que vence hoy, lo que tienes en curso y lo que has terminado esta semana.',
    tasksTitle: 'Todavía no tienes tareas',
    tasks: 'Crea la primera y aparecerá aquí cuando venza hoy, esté en curso o la termines.',
  },
  stats: {
    label: 'Resumen',
    dueToday: 'Para hoy',
    inProgress: 'En curso',
    overdue: 'Vencidas',
    doneWeek: 'Hechas · 7 días',
  },
  myTasks: {
    title: 'Mis tareas',
    description: 'Vencidas, de hoy y las que has hecho hoy',
    boards: 'Ver tableros',
  },
  inProgress: {
    title: 'En curso',
    description: 'Lo que tienes entre manos',
    empty: 'Ninguna tarea en curso. Mueve una a «En curso» en su tablero.',
  },
  upcoming: {
    title: 'Próximos días',
    description: 'Lo que vence esta semana y no está en curso',
    allInProgress: 'Todo lo que vence esta semana ya está en curso.',
    empty: 'Nada vence en los próximos 7 días.',
  },
  projects: {
    title: 'Proyectos',
    all: 'Todos',
    progress: '{{done}} de {{total}}',
    noTasks: 'Sin tareas',
    progressLabel: 'Progreso de {{name}}',
  },
  week: {
    title: 'Últimos 7 días',
    done_one: '{{count}} tarea hecha',
    done_other: '{{count}} tareas hechas',
    chart: 'Tareas hechas por día: {{days}}',
    bar_one: '{{count}} hechas',
    bar_other: '{{count}} hechas',
  },
  activity: {
    actor: {
      user: 'Tú',
      assistant: 'El asistente',
      agent: 'Un agente',
    },
    verb: {
      created: { you: 'creaste', other: 'creó' },
      moved: { you: 'moviste', other: 'movió' },
      completed: { you: 'completaste', other: 'completó' },
      reopened: { you: 'reabriste', other: 'reabrió' },
      archived: { you: 'archivaste', other: 'archivó' },
      restored: { you: 'recuperaste', other: 'recuperó' },
      deleted: { you: 'eliminaste', other: 'eliminó' },
      updated: { you: 'cambiaste', other: 'cambió' },
    },
    field: {
      title: 'el título',
      description: 'la descripción',
      priority: 'la prioridad',
      labels: 'las etiquetas',
      dueDate: 'la fecha de vencimiento',
    },
    list: '{{items}} y {{last}}',
    task: '{{verb}} la tarea',
    moved: '{{verb}} la tarea de {{from}} a {{to}}',
    movedColumn: '{{verb}} la tarea de columna',
    fields: '{{verb}} {{fields}}',
    pr: 'el PR #{{number}}',
    prUnknown: 'el PR',
    agentPrOpened: 'abrió {{pr}} y pasó la tarea a revisión',
    agentPrMerged: 'completó la tarea al fusionarse {{pr}}',
    agentPrClosed: 'devolvió la tarea: {{pr}} se cerró sin fusionar',
    agentStopped: 'sacó la tarea del agente: terminó sin abrir un PR',
  },
}
