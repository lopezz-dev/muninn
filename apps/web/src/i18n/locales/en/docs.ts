/** Textos de `docs`, en inglés (la fuente de las claves). Namespace diferido: se pide con `useTranslation('docs')`. */
export const docs = {
  title: 'Documentation',
  description: 'Guides to every part of Muninn: what already works and what’s missing.',
  eyebrow: 'Help · version {{version}}',
  intro:
    'Short guides to every part of Muninn. Each one says what already works and what’s missing.',
  startHere: 'Start here',
  searchResults: 'Search results',
  helpPages: 'Help pages',
  /** Le sigue `docs/user`, en monoespaciada. */
  generatedFrom: 'Version {{version}} · generated from',
  /** Grupos del menú por su `id`. `DOC_GROUPS` (`lib/docs.ts`) se queda en español: lo usa el build. */
  groups: {
    'primeros-pasos': 'Getting started',
    'tu-trabajo': 'Your work',
    modulos: 'Modules',
    ia: 'Assistants and AI',
    cuenta: 'Account',
    otras: 'More guides',
  },
  status: {
    parcial: 'Partial',
    proximamente: 'Coming soon',
  },
  /** Van detrás de su marca. */
  legend: {
    title: 'What the badges mean',
    partial: 'works, but something the guide tells you about is missing.',
    soon: 'doesn’t exist yet: the guide explains what’s coming.',
  },
  search: {
    label: 'Search the help',
    placeholder: 'Search for a guide, a section or a word',
    noResults: 'No guide mentions “{{query}}”.',
    count_one: '{{count}} guide',
    count_other: '{{count}} guides',
    keys: '↑ ↓ to choose, ↵ to open',
    results: 'Results',
  },
  page: {
    youAreHere: 'You are here',
    minutes: '{{count}} min read',
    sections_one: '{{count}} section',
    sections_other: '{{count}} sections',
    onThisPage: 'On this page',
    otherGuides: 'Other guides',
    previous: 'Previous',
    next: 'Next',
    notFoundTitle: 'We couldn’t find this guide',
    notFoundText: 'The link may be from an older version of the help.',
    seeDocs: 'See the documentation',
  },
} as const
