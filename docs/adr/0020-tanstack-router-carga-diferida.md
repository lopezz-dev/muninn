# ADR-0020: TanStack Router con rutas en código y una pantalla por chunk

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web

## Contexto

`apps/web` era un único bundle de 652 kB (190 kB gzip) con la galería de desarrollo dentro, y las
pantallas que vienen (tablero con drag & drop, editor de notas, gráficos de finanzas) solo pueden
hacerlo crecer. Hace falta un router que:

- Cargue cada pantalla en diferido, para que el arranque no pague por pantallas que no se ven.
- Sea seguro de tipos: con diez secciones, subrutas (`/proyectos/$projectId`, `/ajustes/$seccion`) y
  parámetros de búsqueda (`/asistente?q=`), un enlace roto debería fallar al compilar, no en producción.
- Funcione igual en la PWA y en Tauri, sin servidor (SPA pura).
- Encaje con react-query, que ya es la capa de datos de la UI.

## Decisión

- **TanStack Router** (`@tanstack/react-router`) con **rutas definidas en código** (`apps/web/src/router.tsx`),
  sin el plugin de rutas por ficheros.
- **Una pantalla, un chunk:** cada ruta usa `lazyRouteComponent(() => import('./screens/X'), 'X')`.
  `defaultPreload: 'intent'` precarga el chunk al pasar el ratón o enfocar un enlace, así que al hacer clic
  ya suele estar descargado.
- **El shell va en el bundle inicial** (barra lateral, dock, ⌘K, pantallas de error y de «no encontrado»):
  se ve siempre y es lo que se pinta si un chunk falla.
- **`@muninn/core` se carga en diferido** en el `loader` de la ruta raíz (`loadMuninn()`), en paralelo con el
  chunk de la pantalla. El core arrastra zod, que es de lo más pesado. Los componentes lo leen con
  `useMuninn()` (datos del loader raíz). Con el login, ese mismo loader creará el store de Supabase.
- **Chunks de vendors estables** (`react`, `tanstack`, `ui-vendor`) para que sobrevivan en caché entre
  versiones. Solo se agrupan librerías que usa el shell: ver [gotchas/web](../gotchas/web.md).
- **Historial del navegador** (URLs limpias, `/proyectos/…`), no `#/…`.

Resultado medido al introducirlo con `pnpm --filter @muninn/web size` (JS que descarga `index.html`, en kB
de Vite): de 652 kB (190 kB gzip) a 619 kB (188 kB gzip), ya con router, shell y buscador incluidos. Cada
pantalla pesa entre 1 y 3 kB, el core (104 kB) llega en paralelo y la galería de desarrollo (18 kB) solo se
descarga si se visita. Lo que queda en el arranque es sobre todo React (219 kB), Phosphor, sonner y
tailwind-merge (170 kB) y TanStack Router + Query (109 kB).

## Alternativas consideradas

- **React Router 8 (modo datos):** igual de capaz para carga diferida, pero los tipos de rutas y parámetros
  exigen su generador de tipos; en TanStack salen de la propia definición.
- **wouter:** unos 2 kB frente a los ~70 kB de TanStack Router, pero sin rutas tipadas, sin validación de
  parámetros de búsqueda ni precarga por intención. Habría que construir todo eso a mano.
- **Rutas por ficheros (plugin de TanStack):** troceado automático, pero añade generación de código y un
  `routeTree.gen.ts` versionado. Con una docena de rutas, el fichero explícito se lee mejor.
- **`createHashHistory`:** evitaría configurar el *fallback* a `index.html`, pero ensucia las URLs y los
  enlaces compartidos.

## Consecuencias

- Un enlace a una ruta inexistente, o sin sus parámetros, no compila (`to="/ajustes/apariencia"` hay que
  escribirlo `to="/ajustes/$seccion" params={{ seccion: 'apariencia' }}`).
- El router añade unos 70 kB minificados al arranque, que se compensan con lo que sale del bundle inicial.
- Con historial del navegador, el hosting de la PWA tiene que servir `index.html` en cualquier ruta
  desconocida. El service worker ya lo hace al navegar sin conexión.
- Tras un despliegue, un chunk antiguo puede no existir. `ErrorScreen` lo detecta y ofrece recargar.
- Relacionado: [ADR-0021](0021-shell-de-la-app.md) (estructura de las pantallas), `apps/web/src/router.tsx`,
  `apps/web/vite.config.ts`.
