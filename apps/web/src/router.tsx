import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { loadMuninn } from './lib/muninn'
import { settingsSection } from './screens/ajustes/sections'
import { ErrorScreen } from './screens/ErrorScreen'
import { NotFound } from './screens/NotFound'
import { AppShell } from './shell/AppShell'

/**
 * Rutas de la app (ADR-0020). Cada pantalla es un chunk aparte (`lazyRouteComponent`) que se
 * precarga al pasar el ratón o enfocar su enlace (`defaultPreload: 'intent'`).
 * El shell (barra lateral, dock, ⌘K) va en el bundle inicial.
 */
const rootRoute = createRootRoute({
  // El core se descarga en paralelo con la pantalla; nada se pinta hasta tener los dos.
  loader: () => loadMuninn(),
  // Es la misma instancia siempre: no hay que volver a pedirla en cada navegación.
  staleTime: Number.POSITIVE_INFINITY,
  component: AppShell,
  notFoundComponent: NotFound,
})

const screen = <T extends Record<string, unknown>>(
  load: () => Promise<T>,
  name: keyof T & string,
) => lazyRouteComponent(load, name)

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: screen(() => import('./screens/Inicio'), 'Inicio'),
})

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'proyectos',
  component: screen(() => import('./screens/Proyectos'), 'Proyectos'),
})

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'proyectos/$projectId',
  component: screen(() => import('./screens/Tablero'), 'Tablero'),
})

const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'notas',
  component: screen(() => import('./screens/Notas'), 'Notas'),
})

const financeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'finanzas',
  component: screen(() => import('./screens/Finanzas'), 'Finanzas'),
})

export interface AssistantSearch {
  /** Pregunta que llega desde el buscador ⌘K. */
  q?: string
}

const assistantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'asistente',
  validateSearch: (search: Record<string, unknown>): AssistantSearch => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q.slice(0, 500) : undefined,
  }),
  component: screen(() => import('./screens/Asistente'), 'Asistente'),
})

const newsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'noticias',
  component: screen(() => import('./screens/Noticias'), 'Noticias'),
})

const githubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'github',
  component: screen(() => import('./screens/GitHub'), 'GitHub'),
})

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'documentacion',
  component: screen(() => import('./screens/Documentacion'), 'Documentacion'),
})

const moreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'mas',
  component: screen(() => import('./screens/Mas'), 'Mas'),
})

// ─── Ajustes ─────────────────────────────────────────────────────────────────

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'ajustes',
  component: screen(() => import('./screens/ajustes/Ajustes'), 'Ajustes'),
})

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/ajustes/$seccion', params: { seccion: 'apariencia' }, replace: true })
  },
})

const settingsSectionRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '$seccion',
  beforeLoad: ({ params }) => {
    if (!settingsSection(params.seccion)) throw notFound()
  },
  component: screen(() => import('./screens/ajustes/Seccion'), 'Seccion'),
})

// ─── Desarrollo ──────────────────────────────────────────────────────────────

/** Galería de Fundamentos (tokens y componentes). Sin enlace en la navegación. */
const devFundamentosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'dev/fundamentos',
  component: screen(() => import('./dev/Fundamentos'), 'Fundamentos'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  projectsRoute,
  boardRoute,
  notesRoute,
  financeRoute,
  assistantRoute,
  newsRoute,
  githubRoute,
  docsRoute,
  moreRoute,
  settingsRoute.addChildren([settingsIndexRoute, settingsSectionRoute]),
  devFundamentosRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultErrorComponent: ErrorScreen,
  defaultNotFoundComponent: NotFound,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
