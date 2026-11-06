import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { i18n } from './i18n'
import { accountSheet, isPhone, settingsViewOf } from './lib/account-sheet'
import { getAuth, onAuthChange, safeRedirect } from './lib/auth'
import {
  type DocLang,
  docKeyOf,
  docLangOf,
  docPath,
  isDocsPath,
  otherDocLang,
} from './lib/doc-slugs'
import { legacyHref } from './lib/legacy-routes'
import { loadMuninn } from './lib/muninn'
import { forgetUserData } from './lib/session'
import { settingsSection } from './screens/ajustes/sections'
import { ErrorScreen } from './screens/ErrorScreen'
import { NotFound } from './screens/NotFound'
import { AppShell } from './shell/AppShell'
import { PublicShell } from './shell/PublicShell'

/**
 * Rutas de la app (ADR-0020). Cada pantalla es un chunk aparte (`lazyRouteComponent`) que se
 * precarga al pasar el ratón o enfocar su enlace (`defaultPreload: 'intent'`).
 * El shell (barra lateral, barra de pestañas, ⌘K) va en el bundle inicial.
 */
const rootRoute = createRootRoute({
  beforeLoad: async ({ location }) => {
    // Las rutas en español de antes (ADR-0077, fase 3): a la nueva, antes de resolver nada.
    const hash = location.hash ? `#${location.hash}` : ''
    const legacy = legacyHref(location.pathname, location.searchStr, hash)
    if (legacy) throw redirect({ href: legacy, replace: true })
    // Quién usa la app (ADR-0022). Memorizado: solo la primera navegación espera.
    return { auth: await getAuth() }
  },
  component: Outlet,
  notFoundComponent: NotFound,
})

const screen = <T extends Record<string, unknown>, K extends keyof T & string>(
  load: () => Promise<T>,
  name: K,
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
  // El formulario o, con el segundo factor pendiente, su código (ADR-0061).
  component: screen(() => import('./screens/login/Entrada'), 'Entrada'),
})

export interface OAuthConsentSearch {
  /** Lo pone Supabase Auth al mandar aquí desde su servidor OAuth. */
  authorization_id?: string
}

/**
 * Autorizar a una app (claude.ai) a usar el MCP remoto (ADR-0036). Fuera del shell; el core solo se carga al aprobar (ADR-0064);
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
  beforeLoad: async ({ context, location }) => {
    const { auth } = context
    // Sin sesión, o con el segundo factor por escribir: a /login (ese paso sale allí), salvo la documentación, que
    // es pública (ADR-0076) y se lee en un marco propio, sin datos.
    if (auth.kind === 'anonymous' || auth.kind === 'mfa') {
      if (!isDocsPath(location.pathname)) {
        throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
      }
      // Sin sesión, la interfaz va en el idioma de la URL (ADR-0077); no se guarda como preferencia.
      const lang = docLangOf(location.pathname)
      if (i18n.language !== lang) await i18n.changeLanguage(lang)
      return { auth: null }
    }
    return { auth }
  },
  // El core se descarga en paralelo con la pantalla; nada se pinta hasta tener los dos. Sin sesión (solo en lo
  // público), no hay core: `useMuninn()` no se llama en esas pantallas.
  loader: ({ context }) => (context.auth ? loadMuninn(context.auth) : null),
  // Es la misma instancia mientras no cambie el usuario (`router.invalidate()` al cambiar).
  staleTime: Number.POSITIVE_INFINITY,
  component: AppFrame,
})

/** El shell de la app o, sin sesión en una página pública, el marco de la documentación. */
function AppFrame() {
  const visitor = appRoute.useRouteContext({ select: (c) => c.auth === null })
  return visitor ? <PublicShell /> : <AppShell />
}

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: screen(() => import('./screens/Inicio'), 'Inicio'),
})

const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects',
  component: screen(() => import('./screens/Proyectos'), 'Proyectos'),
})

const boardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId',
  component: screen(() => import('./screens/Tablero'), 'Tablero'),
})

/**
 * Detalle de una tarea (ADR-0023): ruta propia, con enlace compartible y recargable. Cuelga del
 * tablero: en escritorio se ve como panel lateral sobre él; en móvil, a pantalla completa.
 */
const taskRoute = createRoute({
  getParentRoute: () => boardRoute,
  path: 'tasks/$taskId',
  component: screen(() => import('./screens/TareaDetalle'), 'TareaDetalle'),
})

const notesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'notes',
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

export type FinanceView = 'overview' | 'transactions' | 'subscriptions' | 'accounts'

export interface FinanceSearch {
  /** Pestaña de Finanzas; sin ella, «Resumen». */
  view?: FinanceView
}

const FINANCE_VIEWS: FinanceView[] = ['overview', 'transactions', 'subscriptions', 'accounts']

const financeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'finance',
  validateSearch: (search: Record<string, unknown>): FinanceSearch => ({
    view: FINANCE_VIEWS.includes(search.view as FinanceView)
      ? (search.view as FinanceView)
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
  path: 'assistant',
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
  path: 'news',
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

// ─── Documentación: en inglés en /docs y en español en /es/docs (ADR-0077) ─────

const docsScreen = screen(() => import('./screens/Documentacion'), 'Documentacion')
const docPageScreen = screen(() => import('./screens/DocPagina'), 'DocPagina')

/**
 * Una guía con el slug del otro idioma (`/docs/notas`, o un enlace de antes de la fase 4) va a su ruta. Lo que no es
 * de ningún idioma se queda: la pantalla dice que no existe.
 */
const guideInItsLanguage = (lang: DocLang, slug: string) => {
  if (docKeyOf(slug, lang)) return
  const other = otherDocLang(lang)
  if (docKeyOf(slug, other)) throw redirect({ href: docPath(other, slug), replace: true })
}

const docsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'docs',
  component: docsScreen,
})

/** Una guía: ruta propia, con enlace compartible; cuelga de la lista como el detalle de tarea del tablero. */
const docPageRoute = createRoute({
  getParentRoute: () => docsRoute,
  path: '$pagina',
  beforeLoad: ({ params }) => guideInItsLanguage('en', params.pagina),
  component: docPageScreen,
})

const esDocsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'es/docs',
  component: docsScreen,
})

const esDocPageRoute = createRoute({
  getParentRoute: () => esDocsRoute,
  path: '$pagina',
  beforeLoad: ({ params }) => guideInItsLanguage('es', params.pagina),
  component: docPageScreen,
})

/**
 * En el teléfono, Ajustes no es una pantalla: se abre la hoja «Tu cuenta» (ADR-0072) encima de la pantalla en la que
 * estabas, o de Inicio si se entra de cero. Devuelve a dónde volver.
 */
function sheetInstead(view: string): string {
  accountSheet.open(view)
  const back = router.state.resolvedLocation
  return back && !settingsViewOf(back.pathname) ? back.href : '/'
}

/** «Más» ya no existe (ADR-0072): lo que había ahí está en la hoja de tu cuenta. */
const moreRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'mas',
  beforeLoad: () => {
    throw redirect({ href: isPhone() ? sheetInstead('root') : '/', replace: true })
  },
})

// ─── Ajustes ─────────────────────────────────────────────────────────────────

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings',
  beforeLoad: ({ location }) => {
    const view = settingsViewOf(location.pathname)
    if (!view || !isPhone() || (view !== 'root' && !settingsSection(view))) return
    throw redirect({ href: sheetInstead(view), replace: true })
  },
  component: screen(() => import('./screens/ajustes/Ajustes'), 'Ajustes'),
})

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  // El menú va a la izquierda: se abre una sección. En el teléfono no se llega aquí (lo lleva la hoja).
  beforeLoad: () => {
    throw redirect({ to: '/settings/$seccion', params: { seccion: 'appearance' }, replace: true })
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
  path: 'dev/foundations',
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
    esDocsRoute.addChildren([esDocPageRoute]),
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
  // En escritorio hace scroll <main>, no la ventana (ADR-0050): al cambiar de pantalla también vuelve arriba. Lo
  // mismo el texto de una guía, que lleva su propio scroll (ADR-0071).
  scrollToTopSelectors: ['#contenido', '#guia'],
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
