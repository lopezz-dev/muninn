# ADR-0084: Cada pantalla se carga con sus textos y las de la navegación se precalientan en segundo plano

- **Estado:** Aceptado
- **Fecha:** 2026-11-06
- **Área:** web

## Contexto

Desde la 0.10, los textos de cada pantalla son un namespace de i18next en diferido ([ADR-0077](0077-i18n-ingles-por-defecto-con-i18next.md)).
`useTranslation('board')` los pedía **al pintar** la pantalla, cuando el router ya había descargado el chunk y cambiado de pantalla.
El componente suspendía ya montado: React enseñaba el *fallback* del router (nada) y, al llegar los textos, revelaba la pantalla
con su retardo de ~300 ms para agrupar revelados. La primera visita a cada pantalla tras arrancar la app (y por tanto tras cada
actualización, que recarga) se veía como un destello vacío y, de golpe, la información. Las siguientes ya no, porque el namespace
queda en memoria.

Medido con la build de producción en la demo (`pnpm build` + `pnpm preview`, chunks servidos por el service worker), primera
visita: Proyectos tardaba 321 ms en pintarse; el tablero, 339 ms, con un fotograma con `<main>` vacío a los 326 ms, aunque su
chunk y su namespace llegaban en 12 ms. El precache del service worker no tenía nada que ver: todo estaba en local.

Además, en el teléfono no hay *hover*: `defaultPreload: 'intent'` ([ADR-0020](0020-tanstack-router-carga-diferida.md)) no precarga
nada antes del toque en el dock.

## Decisión

- **Una pantalla, un chunk y sus textos.** `screen()` (`router.tsx`) recibe los namespaces que usa la pantalla y los pide en paralelo
  con su chunk. El router no la pinta hasta tener los dos y, mientras, sigue viéndose la pantalla anterior. Es lo que ya decía
  ADR-0077 («se cargan en diferido con su chunk»). La precarga por intención trae también los textos.
- **Precalentado de la navegación.** Con el navegador ocioso tras el primer pintado (`requestIdleCallback`, como mucho 3 s),
  `lib/warm-up.ts` descarga el chunk (y con él los textos) de cada sección activa y de las rutas que cuelgan de ella, y el resto de
  namespaces del idioma activo (diálogos, buscador, hoja de la cuenta). Con «Ahorro de datos» no hace nada. Va en su propio chunk.

## Alternativas consideradas

- **Meter todos los namespaces en el arranque:** unos 43 kB gzip por idioma más en el JS inicial, justo lo que ADR-0077 quería evitar.
- **`useSuspense: false` en react-i18next:** la pantalla se pintaría con las claves en crudo hasta que lleguen los textos: otro destello.
- **Un `pendingComponent` (esqueleto) en el router:** cambia un destello vacío por uno gris; no quita la espera.
- **Precargar todas las rutas (Ajustes, login, OAuth, galería de desarrollo):** descarga de más; solo las secciones activas.

## Consecuencias

- La primera visita a una pantalla ya no deja `<main>` vacío por los textos: Proyectos se pinta en 14 ms en lugar de 321 ms, en la
  misma prueba. Tras el precalentado, el chunk y los textos ya están en memoria.
- Una pantalla nueva tiene que declarar sus namespaces en `screen()`. Si se olvida uno, funciona igual pero vuelve el destello (ver
  [gotchas/web](../gotchas/web.md)).
- El arranque crece 0,8 kB (0,4 kB gzip) por las listas de namespaces y el efecto que lanza el precalentado; el precalentado en sí
  va diferido. En la PWA, lo que descarga ya está en el precache del service worker; en Tauri, en local.
- No resuelve los datos: una pantalla cuya consulta no está en caché (primera visita, o nunca abierta en este dispositivo) sigue
  pintándose sin datos hasta que llegan. Queda como tarea aparte (cargar los datos en el `loader` de la ruta).
- Relacionado: [ADR-0020](0020-tanstack-router-carga-diferida.md), [ADR-0077](0077-i18n-ingles-por-defecto-con-i18next.md),
  `apps/web/src/router.tsx`, `apps/web/src/lib/warm-up.ts`, `apps/web/test/warm-up.test.ts`.
