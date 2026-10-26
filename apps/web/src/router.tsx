import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { getAuth, onAuthChange, safeRedirect } from './lib/auth'
import { loadMuninn } from './lib/muninn'
import { forgetUserData } from './lib/session'
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
  // Quién usa la app (ADR-0022). Memorizado: solo la primera navegación espera.
  beforeLoad: async () => ({ auth: await getAuth() }),
  component: Outlet,
  notFoundComponent: NotFound,
})

const screen = <T extends Record<string, unknown>>(
  load: () => Promise<T>,
  name: keyof T & string,
) => lazyRouteComponent(load, name)

export interface LoginSearch {
  /** Ruta interna a la que volver tras entrar. */
  redirect?: string
  /** Error que devuelve GitHub (p. ej., si se cancela el permiso). */
  error_description?: string
}

/** Pública. Con sesión, vuelve a donde ibas; en modo demo se puede entrar para iniciar sesión. */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? safeRedirect(search.redirect) : undefined,
    error_description:
      typeof search.error_description === 'string'
        ? search.error_description.slice(0, 300)
        : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.kind === 'user')
      throw redirect({ href: safeRedirect(search.redirect), replace: true })
  },
  component: screen(() => import('./screens/Login'), 'Login'),
})

export interface OAuthConsentSearch {
  /** Lo pone Supabase Auth al mandar aquí desde su servidor OAuth. */
  authorization_id?: string
}

/**
 * Autorizar a una app (claude.ai) a usar el MCP remoto (ADR-0036). Fuera del shell y sin cargar el core;
 * necesita una cuenta de verdad: sin sesión (o en modo demo), a /login y vuelta aquí.
 */
const oauthConsentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'oauth/consent',
  validateSearch: (search: Record<string, unknown>): OAuthConsentSearch => ({
    authorization_id:
      typeof search.authorization_id === 'string'
        ? search.authorization_id.slice(0, 200)
        : undefined,
  }),
  beforeLoad: ({ context, location }) => {
    if (context.auth.kind !== 'user')
      throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
  },
  component: screen(() => import('./screens/OAuthConsent'), 'OAuthConsent'),
})

/** Todo lo que necesita datos: sin sesión ni demo, a /login (y vuelta aquí al entrar). */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  beforeLoad: ({ context, location }) => {
    const { auth } = context
    if (auth.kind === 'anonymous') {
      throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
    }
    return { auth }
  },
  // El core se descarga en paralelo con la pantalla; nada se pinta hasta tener los dos.
  loader: ({ context }) => loadMuninn(context.auth),
  // Es la misma instancia mientras no cambie el usuario (`router.invalidate()` al cambiar).
  staleTime: Number.POSITIVE_INFINITY,
  component: AppShell,
})

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: screen(() => import('./screens/Inicio'), 'Inicio'),
})

const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'proyectos',
  component: screen(() => import('./screens/Proyectos'), 'Proyectos'),
})

const boardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'proyectos/$projectId',
  component: screen(() => import('./screens/Tablero'), 'Tablero'),
})

/**
 * Detalle de una tarea (ADR-0023): ruta propia, con enlace compartible y recargable. Cuelga del
 * tablero: en escritorio se ve como panel lateral sobre él; en móvil, a pantalla completa.
 */
const taskRoute = createRoute({
  getParentRoute: () => boardRoute,
  path: 'tareas/$taskId',
  component: screen(() => import('./screens/TareaDetalle'), 'TareaDetalle'),
})

const notesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'notas',
  component: screen(() => import('./screens/Notas'), 'Notas'),
})

/**
 * Una nota abierta: ruta propia con enlace compartible. Cuelga de la lista, como el detalle de tarea del
 * tablero (ADR-0024): editor a la derecha en escritorio, pantalla completa en móvil.
 */
const noteRoute = createRoute({
  getParentRoute: () => notesRoute,
  path: '$noteId',
  component: screen(() => import('./screens/NotaDetalle'), 'NotaDetalle'),
})

export type FinanceView = 'resumen' | 'movimientos' | 'suscripciones' | 'cuentas'

export interface FinanceSearch {
  /** Pestaña de Finanzas; sin ella, «Resumen». */
  vista?: FinanceView
}

const FINANCE_VIEWS: FinanceView[] = ['resumen', 'movimientos', 'suscripciones', 'cuentas']

const financeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'finanzas',
  validateSearch: (search: Record<string, unknown>): FinanceSearch => ({
    vista: FINANCE_VIEWS.includes(search.vista as FinanceView)
      ? (search.vista as FinanceView)
      : undefined,
  }),
  component: screen(() => import('./screens/Finanzas'), 'Finanzas'),
})

export interface AssistantSearch {
  /** Pregunta que llega desde el buscador ⌘K. */
  q?: string
}

const assistantRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'asistente',
  validateSearch: (search: Record<string, unknown>): AssistantSearch => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q.slice(0, 500) : undefined,
  }),
  component: screen(() => import('./screens/Asistente'), 'Asistente'),
})

export interface NewsSearch {
  /** Búsqueda que llega desde el buscador ⌘K. */
  q?: string
}

const newsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'noticias',
  validateSearch: (search: Record<string, unknown>): NewsSearch => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q.slice(0, 200) : undefined,
  }),
  component: screen(() => import('./screens/Noticias'), 'Noticias'),
})

const githubRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'github',
  component: screen(() => import('./screens/GitHub'), 'GitHub'),
})

const docsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'documentacion',
  component: screen(() => import('./screens/Documentacion'), 'Documentacion'),
})

/** Una guía: ruta propia, con enlace compartible; cuelga de la lista como el detalle de tarea del tablero. */
const docPageRoute = createRoute({
  getParentRoute: () => docsRoute,
  path: '$pagina',
  component: screen(() => import('./screens/DocPagina'), 'DocPagina'),
})

const moreRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'mas',
  component: screen(() => import('./screens/Mas'), 'Mas'),
})

// ─── Ajustes ─────────────────────────────────────────────────────────────────

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
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
  getParentRoute: () => appRoute,
  path: 'dev/fundamentos',
  component: screen(() => import('./dev/Fundamentos'), 'Fundamentos'),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  oauthConsentRoute,
  appRoute.addChildren([
    homeRoute,
    projectsRoute,
    boardRoute.addChildren([taskRoute]),
    notesRoute.addChildren([noteRoute]),
    financeRoute,
    assistantRoute,
    newsRoute,
    githubRoute,
    docsRoute.addChildren([docPageRoute]),
    moreRoute,
    settingsRoute.addChildren([settingsIndexRoute, settingsSectionRoute]),
    devFundamentosRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultErrorComponent: ErrorScreen,
  defaultNotFoundComponent: NotFound,
  scrollRestoration: true,
})

// Otra pestaña (o este mismo cliente) cambió de usuario: fuera los datos del anterior y a recalcular
// rutas, que mandan a /login o a la app según toque.
onAuthChange(() => {
  forgetUserData()
  router.invalidate()
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
