import type { Messages } from '../../types'
import type { docs as en } from '../en/docs'

/** Textos de `docs` en español. Mismas claves que `en/docs.ts`: si falta una, no compila. */
export const docs: Messages<typeof en> = {
  title: 'Documentación',
  description: 'Guías de cada parte de Muninn: qué funciona ya y qué falta.',
  eyebrow: 'Ayuda · versión {{version}}',
  intro: 'Guías cortas de cada parte de Muninn. Cada una dice qué funciona ya y qué falta.',
  startHere: 'Empieza aquí',
  searchResults: 'Resultados de la búsqueda',
  helpPages: 'Páginas de ayuda',
  generatedFrom: 'Versión {{version}} · generada desde',
  groups: {
    'primeros-pasos': 'Primeros pasos',
    'tu-trabajo': 'Tu trabajo',
    modulos: 'Módulos',
    ia: 'Asistentes e IA',
    cuenta: 'Cuenta',
    otras: 'Más guías',
  },
  status: {
    parcial: 'Parcial',
    proximamente: 'Próximamente',
  },
  legend: {
    title: 'Qué significan las marcas',
    partial: 'funciona, pero falta algo que la guía te cuenta.',
    soon: 'aún no existe: la guía explica qué llegará.',
  },
  search: {
    label: 'Buscar en la ayuda',
    placeholder: 'Busca una guía, un apartado o una palabra',
    noResults: 'Ninguna guía menciona «{{query}}».',
    count_one: '{{count}} guía',
    count_other: '{{count}} guías',
    keys: '↑ ↓ para elegir, ↵ para abrir',
    results: 'Resultados',
  },
  page: {
    youAreHere: 'Estás en',
    minutes: '{{count}} min de lectura',
    sections_one: '{{count}} apartado',
    sections_other: '{{count}} apartados',
    onThisPage: 'En esta página',
    otherGuides: 'Otras guías',
    previous: 'Anterior',
    next: 'Siguiente',
    notFoundTitle: 'No encontramos esta guía',
    notFoundText: 'Puede que el enlace sea de una versión anterior de la ayuda.',
    seeDocs: 'Ver la documentación',
  },
}
