/** Textos de `palette`, en inglés (la fuente de las claves). Namespace diferido: se pide con `useTranslation('palette')`. */
export const palette = {
  input: {
    label: 'Search or ask',
    placeholder: 'Search or ask…',
    close: 'Close',
  },
  results: {
    label: 'Results',
    empty: 'Type to search.',
  },
  groups: {
    ask: 'Ask',
    nav: 'Go to',
    projects: 'Projects',
    tasks: 'Tasks',
    notes: 'Notes',
    actions: 'Actions',
  },
  ask: {
    muninn: 'Ask Muninn: “{{query}}”',
    news: 'Search News: “{{query}}”',
  },
  items: {
    board: 'Board',
    newNote: 'New note',
    newProject: 'New project…',
    glassOff: 'Turn off glass',
    glassOn: 'Turn on glass',
    appearance: 'Change appearance…',
    signOut: 'Sign out',
    leaveDemo: 'Leave demo mode',
  },
  // Sinónimos que también encuentran cada opción (no se ven): en el idioma de quien busca.
  keywords: {
    home: 'today summary dashboard',
    projects: 'kanban board tasks',
    finance: 'expenses income money accounts',
    assistant: 'jarvis ai chat claude',
    docs: 'help guide manual',
    settings: 'preferences configuration appearance',
    newNote: 'create add write jot',
    newProject: 'create add',
    glass: 'blur transparency appearance',
    appearance: 'accent color theme',
    signOut: 'logout log out disconnect account',
  },
  footer: {
    move: 'Move',
    open: 'Open',
    hint: 'Sections, projects, tasks, notes and actions · or ask Muninn',
  },
} as const
