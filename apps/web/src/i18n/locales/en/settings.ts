/** Textos de `settings`, en inglés (la fuente de las claves). Namespace diferido: se pide con `useTranslation('settings')`. */
export const settings = {
  sectionsNav: 'Settings sections',
  pageTitle: '{{section}} · Settings · Muninn',
  // Grupos y secciones del menú (los ids son slugs: no se traducen).
  groups: {
    tu: 'You',
    espacio: 'Workspace',
    asistente: 'Assistant',
    integraciones: 'Integrations',
    datos: 'Data',
  },
  sections: {
    cuenta: {
      label: 'Account',
      subtitle: 'How you sign in, where you’re signed in and which apps use your account.',
    },
    apariencia: {
      label: 'Appearance',
      subtitle: 'How Muninn looks. It follows you to all your devices.',
    },
    barra: {
      label: 'Bottom bar',
      subtitle:
        'The tabs at the bottom on your phone: which ones and in what order. It follows you to all your devices.',
    },
    atajos: {
      label: 'Keyboard shortcuts',
      subtitle: 'Everything you can do without leaving the keyboard.',
    },
    modulos: {
      label: 'Modules',
      subtitle: 'Turn on only what you use. What’s off leaves the menu; your data stays saved.',
    },
    notificaciones: {
      label: 'Notifications',
      subtitle: 'Alerts on your phone and computer, even when Muninn is closed.',
    },
    asistente: {
      label: 'Local model',
      subtitle: 'The model on your computer that the Assistant uses, through Ollama.',
    },
    informe: {
      label: 'Morning report',
      subtitle: 'Every day, a pinned note with what’s on your plate today.',
    },
    integraciones: {
      label: 'GitHub',
      subtitle: 'Issues from your repositories, as tasks in their project.',
    },
    datos: {
      label: 'Data and sync',
      subtitle: 'Where your data is stored and how it moves between devices.',
    },
    acerca: {
      label: 'About Muninn',
      subtitle: 'Version, documentation and source code.',
    },
  },
  // Columna «En la documentación» de cada sección.
  docs: {
    cuenta: {
      title: 'Account and security',
      text: 'Two-factor authentication, open sessions and the apps with access to your account.',
    },
    apariencia: {
      title: 'Getting around Muninn › Appearance',
      text: 'Glass and accent color: what each one changes and where it’s saved.',
    },
    barra: {
      title: 'Getting around Muninn › Bottom bar',
      text: 'Which tabs you can add, how many fit and where everything else goes.',
    },
    atajos: {
      title: 'Getting around Muninn › Shortcuts',
      text: 'Shortcuts for search, the board and dialogs.',
    },
    modulos: {
      title: 'Getting around Muninn › Modules',
      text: 'What happens when you turn a module off and how to turn it back on.',
    },
    notificaciones: {
      title: 'Notifications',
      text: 'How to turn on alerts on your iPhone and what Muninn alerts you about.',
    },
    asistente: {
      title: 'Assistant › Install Ollama',
      text: 'How to install Ollama and the recommended model, step by step.',
    },
    informe: {
      title: 'Assistant › Morning report',
      text: 'What it includes, when it’s made and what happens if your computer is off.',
    },
    integraciones: {
      title: 'GitHub',
      text: 'How issues sync and what changes on each side.',
    },
    datos: {
      title: 'Your data and privacy',
      text: 'Where everything is stored, who can see it and what works offline.',
    },
  },
  // Lo que se ve al lado de cada sección en el menú.
  hints: {
    tabs_one: '{{count}} tab',
    tabs_other: '{{count}} tabs',
    modules: '{{on}} of {{total}}',
    notificationsOff: 'Not set up',
    devices_one: '{{count}} device',
    devices_other: '{{count}} devices',
    reportOff: 'Off',
  },
  // Índice del buscador de Ajustes: `keywords`, otras palabras con que alguien lo buscaría.
  index: {
    acceso: {
      label: 'Sign-in method',
      description: 'You sign in with an email code or with GitHub. No passwords.',
      keywords: 'login sign in email',
    },
    sesion: {
      label: 'Sign out',
      description: 'Only on this device.',
      keywords: 'log out logout leave',
    },
    'segundo-factor': {
      label: 'Two-factor authentication',
      description: 'A code from an app on your phone when you sign in, on top of email or GitHub.',
      keywords: 'mfa 2fa totp authenticator verification two-step security',
    },
    sesiones: {
      label: 'Sessions and devices',
      description: 'Where you’re signed in, with the last activity.',
      keywords: 'devices browsers security',
    },
    'cerrar-sesiones': {
      label: 'Sign out of other devices',
      description: 'The others or all of them, this one included.',
      keywords: 'log out logout everywhere all security',
    },
    'aviso-dispositivo-nuevo': {
      label: 'New-device sign-in alerts',
      description: 'An email when someone signs in from a device you haven’t used.',
      keywords: 'email notification login security alert unknown device',
    },
    apps: {
      label: 'Apps with access',
      description:
        'Apps that use your account through the remote MCP, like claude.ai. Remove the ones you don’t use.',
      keywords: 'oauth permissions claude connectors mcp revoke',
    },
    idioma: {
      label: 'Language',
      description: 'The app’s language. By default, your browser’s.',
      keywords: 'language english spanish español translation locale',
    },
    tema: {
      label: 'Theme',
      description: 'Dark. Light mode is coming later.',
      keywords: 'dark light mode',
    },
    cristal: {
      label: 'Glass',
      description: 'Translucent blur on panels and menus.',
      keywords: 'transparency blur translucent',
    },
    acento: {
      label: 'Accent color',
      description: 'Buttons, selection and the active tab in the bottom bar.',
      keywords: 'color colour theme',
    },
    'barra-pestanas': {
      label: 'Bottom bar tabs',
      description: 'Pick one to four and their order. Your avatar always stays on the right.',
      keywords: 'dock tabs mobile phone navigation home search more',
    },
    'atajos-buscador': {
      label: 'Search shortcuts',
      description: 'Open it, move through the results and open one.',
      keywords: 'keyboard ctrl k cmd',
    },
    'atajos-tablero': {
      label: 'Board shortcuts',
      description: 'New task and moving cards with the keyboard.',
      keywords: 'keyboard n space arrows',
    },
    'modulo-tasks': {
      label: 'Tasks and projects',
      description: 'Kanban per project.',
      keywords: 'module turn on off enable disable',
    },
    'modulo-notes': {
      label: 'Notes',
      description: 'Markdown linked to projects.',
      keywords: 'module turn on off enable disable',
    },
    'modulo-finance': {
      label: 'Finance',
      description: 'Expenses, income, savings, investments and subscriptions.',
      keywords: 'module turn on off enable disable money',
    },
    'modulo-github': {
      label: 'GitHub',
      description: 'Issues as tasks and agents.',
      keywords: 'module turn on off enable disable',
    },
    'modulo-news': {
      label: 'News',
      description: 'RSS with a local summary.',
      keywords: 'module turn on off enable disable rss feeds',
    },
    avisos: {
      label: 'Alerts on this device',
      description: 'Turn them on to get alerts even when Muninn is closed.',
      keywords: 'notifications push permission iphone mobile phone',
    },
    'avisos-cobros': {
      label: 'Alerts before each charge',
      description: 'On your phone, before a subscription charges you.',
      keywords: 'notifications push subscriptions billing',
    },
    'avisos-dispositivos': {
      label: 'Devices with alerts',
      description: 'The ones that get your alerts. Remove the ones you no longer use.',
      keywords: 'notifications push remove mobile phone',
    },
    ollama: {
      label: 'Ollama address',
      description: 'Where Ollama is on your computer.',
      keywords: 'server url local host',
    },
    modelo: {
      label: 'Model',
      description: 'The Ollama model the Assistant uses.',
      keywords: 'qwen ai llm',
    },
    'informe-activo': {
      label: 'Morning report',
      description: 'Every day, a pinned note with what’s on your plate today.',
      keywords: 'daily summary digest',
    },
    'informe-hora': {
      label: 'Report time',
      description: 'When it’s prepared, if your computer is on.',
      keywords: 'time hour schedule',
    },
    'informe-ahora': {
      label: 'Run now',
      description: 'Makes the report without waiting for its time.',
      keywords: 'generate',
    },
    'github-estado': {
      label: 'GitHub sync',
      description: 'Whether the module is on and when the last issue came in.',
      keywords: 'issues sync',
    },
    repos: {
      label: 'Repository for each project',
      description: 'Link a GitHub repository to each project.',
      keywords: 'link issues repo',
    },
    donde: {
      label: 'Where it’s stored',
      description: 'In your account, on a server in the European Union.',
      keywords: 'server privacy europe eu',
    },
    dispositivos: {
      label: 'Across devices',
      description: 'What you change on one shows up instantly on the others.',
      keywords: 'sync real time realtime',
    },
    'sin-conexion': {
      label: 'Offline',
      description: 'The last things you saw are available without a connection.',
      keywords: 'offline cache no connection',
    },
    version: {
      label: 'Version',
      description: 'Which version of Muninn you have.',
      keywords: 'update about',
    },
  },
  search: {
    placeholder: 'Search settings',
    title: 'Settings matching “{{query}}”',
    none: 'No settings match. Try another word.',
    settings_one: '{{count}} setting',
    settings_other: '{{count}} settings',
    sections_one: '{{count}} section',
    sections_other: '{{count}} sections',
    summary: '{{settings}} in {{sections}}. Pick one to go to it; Esc clears the search.',
  },
  soon: 'Coming soon',
  changed: 'Changed',
  changedCount_one: '{{count}} changed',
  changedCount_other: '{{count}} changed',
  resetToDefault: 'Reset to default',
  help: {
    inDocs: 'In the docs',
    openGuide: 'Open the guide',
    changedMark: 'Changed marker',
    changedText:
      'Settings that aren’t at their default have a dot. The arrow button resets one; “Reset section” resets them all, with Undo.',
  },
  // Restablecer (marca de «cambiado»).
  reset: {
    appearance: 'Appearance reset',
    report: 'Morning report reset',
    section: '{{section}}: back to defaults',
    failed: 'Couldn’t reset',
    done: 'Back to their defaults',
  },
  savedToAccountFooter: 'Saved to your account: it follows you to all your devices.',
  account: {
    demoTitle: 'You’re in demo mode',
    signIn: 'Sign in',
    leaveDemo: 'Leave demo mode',
    demoText:
      'Your data lives in memory and is lost when you reload. Sign in to save it to your account and see it on all your devices.',
    profile: 'Profile',
    access: 'Sign-in',
    method: 'Sign-in method',
    methodText: 'No passwords: you sign in with a code or with GitHub.',
    providerEmail: 'Email code',
    session: 'Session',
    sessionText: 'Signs out only on this device. Your data stays in your account.',
    signingOut: 'Signing out…',
    signOut: 'Sign out',
  },
  data: {
    demoTitle: 'Data in memory',
    demoText:
      'You’re in demo mode: your data lives in memory and is lost when you reload. With an account it’s saved on the server and you see it on all your devices.',
    title: 'Your data',
    where: 'Where it’s stored',
    whereText:
      'In your Muninn account, on a server in the European Union (Paris). Only you can see it.',
    saved: 'Saved',
    devices: 'Across devices',
    devicesText:
      'Sign in with the same account and you’ll see the same thing. What you change on another device shows up instantly, no reload needed.',
    instant: 'Instantly',
    offline: 'Offline',
    offlineText:
      'The app keeps the last things you saw on this device: you can open it and look them up without a connection. To change anything you need to be online. Signing out clears it.',
    readOnly: 'Read-only',
  },
  appearance: {
    theme: 'Theme',
    mode: 'Mode',
    modeText: 'Muninn is designed for dark mode. Light mode is coming later.',
    dark: 'Dark',
    lightSoon: 'Light, coming soon',
    glass: 'Glass',
    glassText: 'Translucent blur on panels and menus across the app.',
    glassReset: 'Glass reset',
    color: 'Color',
    accent: 'Accent color',
    accentText: 'Buttons, selection and the active tab in the bottom bar. Amber by default.',
    accentReset: 'Accent reset',
    backToAmber: 'Back to amber',
    deviceFooter: 'Saved on this device. Once you sign in, it’ll follow you everywhere.',
    // Avisos al cambiarla.
    glassOn: 'Glass on',
    glassOff: 'Glass off',
    accentChanged: 'Accent color: {{name}}',
    savedToAccount: 'Saved to your account',
    savedToDevice: 'Saved on this device',
    restored: 'Appearance restored',
    saveFailed: 'Couldn’t save to your account',
    saveFailedHint: 'The change stays on this device',
  },
  accents: {
    amber: 'Amber',
    blue: 'Blue',
    violet: 'Violet',
    teal: 'Teal',
    pink: 'Pink',
  },
  shortcuts: {
    search: 'Search',
    openSearch: 'Open or close search',
    moveResults: 'Move through the results',
    openResult: 'Open the selected result',
    focusSearch: 'Go to the Settings or Documentation search',
    board: 'Board',
    newTask: 'New task (outside a text field)',
    space: 'Space',
    pickUp: 'With a card or column focused, pick it up and drop it',
    moveItem: 'With something picked up, move it',
    general: 'Across the app',
    accountMenu: 'Open your account menu, at the bottom of the sidebar',
    close: 'Close a dialog, a menu or a task’s panel',
    nextControl: 'Go to the next control (the first one: “Skip to content”)',
  },
  about: {
    version: 'Version',
    versionDesktop:
      'On your computer, Muninn checks for new versions when it opens and lets you know with “Restart”.',
    versionWeb:
      'In the browser and on your phone, the app updates itself the next time you open it.',
    docs: 'Documentation',
    docsText: 'Guides to every part of Muninn: what already works and what’s missing.',
    open: 'Open',
    code: 'Source code',
    codeText: 'Muninn is open source, under the MIT license.',
  },
  dock: {
    inBar: 'In the bar',
    outOfBar: 'Not in the bar',
    outOfBarText: 'Whatever isn’t at the bottom is one tap away on your avatar, under “Go to”.',
    moduleOffHidden: 'Module turned off: not shown',
    moduleOff: 'Module turned off',
    opensSearch: 'Opens search',
    assistantNotOnPhone: 'It doesn’t answer on mobile yet: use the one on your computer',
    moveLeft: 'Move {{name}} left',
    moveRight: 'Move {{name}} right',
    remove: 'Remove {{name}} from the bar',
    add: 'Add {{name}} to the bar',
    atLeastOne: 'The bar needs at least one tab',
    full: '{{max}} tabs fit: remove one first',
    added: '{{name}} added to the bar',
    removed: '{{name}} removed from the bar',
    movedLeft: '{{name}} moved left',
    movedRight: '{{name}} moved right',
    demoFooter: 'You’re in demo mode: it’s lost when you reload.',
  },
  modules: {
    title: 'Modules',
    active: '{{on}} of {{total}} on',
    soon: 'Coming soon',
    arrivesIn: 'Coming in {{phase}}',
    // Avisos al activarlo o desactivarlo.
    on: '{{name}} turned on',
    off: '{{name}} turned off',
    onHint: 'It’s back in the menu and in search',
    offHint: 'It leaves the menu and search; your data stays saved',
    saveFailed: 'Couldn’t save the change',
    items: {
      tasks: { label: 'Tasks and projects', text: 'Kanban per project' },
      notes: { label: 'Notes', text: 'Markdown linked to projects' },
      finance: {
        label: 'Finance',
        text: 'Expenses, income, savings, investments and subscriptions',
      },
      github: { label: 'GitHub', text: 'Issues as tasks and agents' },
      news: { label: 'News', text: 'RSS with a local summary' },
      focus: { label: 'Focus', text: 'Deep work blocks with the island' },
    },
  },
} as const
