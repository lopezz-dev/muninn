# Gotchas · web (`apps/web`)

### Variables de entorno de Supabase

- Se llaman `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (la clave pública `sb_publishable_…`).
  **Nunca** pongas la service role key en una variable `VITE_*`: acaba dentro del bundle.
- **Síntoma:** en un ordenador recién clonado, la pantalla de entrada tiene el correo y «Enviar código» deshabilitados y
  dice «Este build no tiene servidor».
- **Causa:** `apps/web/.env.local` está en `.gitignore` y no viaja con el repo; sin las dos variables, `hasSupabase` es
  `false` y la app solo ofrece el modo demo. No hay error en consola.
- **Solución:** copia `.env.example` a `.env.local` con los valores de Supabase (**Settings › API Keys**, o
  `get_publishable_keys` del MCP de Supabase). Vite reinicia solo al guardar el fichero.

### El service worker no se registra en Tauri

- **Síntoma:** en escritorio no hay PWA ni caché offline del service worker.
- **Causa:** es intencionado. `vite.config.ts` desactiva `VitePWA` cuando existe `TAURI_ENV_PLATFORM`.
- **Solución:** el modo offline en escritorio se resolverá en la capa de datos, no con el service worker.

### Notificaciones push en iPhone

- Solo funcionan si la PWA está **añadida a la pantalla de inicio** (iOS 16.4 o superior) y tras pedir permiso
  con un gesto del usuario (un clic). En Safari, sin instalar, no hay push.

### Una consulta no se vuelve a pedir al montar la pantalla

- **Síntoma:** cambias algo fuera de la app (o en una tabla sin tiempo real, como `activity`), vuelves a la pantalla y sigue lo
  de antes durante unos segundos.
- **Causa:** el `queryClient` tiene `staleTime: 30_000` (ADR-0070): durante 30 s lo leído se da por bueno y montar la pantalla no
  repite la petición. Solo `invalidateQueries` (escrituras propias y tiempo real) o volver a la pestaña con datos caducados refrescan.
- **Solución:** si una escritura cambia esos datos, termínala con `invalidateQueries` de su clave (no con `refetch` a mano). Si una
  consulta concreta tiene que pedirse siempre al montar, ponle `staleTime: 0` en sus `queryOptions`.

### «Deshacer» siempre con `notifyUndo`

- **Síntoma:** pulsas «Deshacer», falla (sin conexión, por ejemplo) y no aparece ningún aviso; o sale «Cambio deshecho» aunque no se
  deshizo nada.
- **Causa:** cada acción montaba su propio `notify.success({ action: … })` y algunas no capturaban el error de la inversa, o
  comprobaban mal su resultado (las que devuelven `null` al fallar).
- **Solución:** usa `notifyUndo(título, { undo, undone?, failTitle? })` de `lib/feedback.ts`. `undo` es la inversa: si lanza, se avisa
  con `failTitle`; si devuelve `false`, es que ya avisó ella (las acciones que se llaman a sí mismas con `{ undoing: true }`). Las que
  devuelven el objeto o `null` se adaptan con `async () => (await accion(…)) !== null`. Para el parche inverso, `previousValues(antes,
  parche)` (`mutations.ts`). La inversa puede ser síncrona (los borrados diferidos de ADR-0065/0067: cancelar la espera) y, si a veces
  no la hay (mover sin el tablero en caché, el primer resumen del día), pasa `undo: null` y sale el aviso sin «Deshacer». Con
  `{ undoing: true }`, la acción no avisa de nada al acabar bien: el texto de «deshecho» va en `undone`. Única excepción: el «Deshacer»
  del asistente (`assistant-chat.ts`), que comparte la inversa con el botón de la respuesta y avisa él mismo.

### Módulos desactivados: qué mira cada pieza del shell

- **Síntoma:** un módulo desactivado sigue saliendo en la barra de pestañas, el buscador o un atajo; o el menú parpadea al cargar.
- **Causa:** cada pieza decide por su cuenta. Todas usan `useEnabledModules()` (`lib/modules.ts`) y `sectionEnabled()`
  (`shell/nav.ts`): barra lateral, barra de pestañas del teléfono (`tabsFor`), «Ir a» de la hoja «Tu cuenta», buscador y la tecla **N**. Los ajustes llegan por la caché de
  react-query (`keys.settings`), que rellena el loader de `_app` antes de pintar; mientras valgan `null` se enseña todo.
- **Solución:** una sección nueva con módulo se declara en `SECTION_MODULE`; no compruebes `enabledModules` a mano. La barra
  de pestañas reparte el ancho entre las que queden (flex): no asumas cuatro, y desde el ADR-0072 son las que elige el usuario
  (`useDockTabs`). Una sección nueva que pueda ir abajo se añade a `DOCK_OPTIONS`.
- **Ref:** [ADR-0028](../adr/0028-modulos-activables-solo-en-la-interfaz.md)

### El buscador ⌘K es un chunk diferido que se pide al pintar el shell

- `CommandPalette` no viaja en el JS del arranque: `AppShell` lo monta dentro de `<Suspense>` y el navegador lo pide en cuanto
  se pinta el shell. Si pulsas ⌘K antes de que llegue, se abre al terminar de cargar. No lo importes de forma estática desde el shell.

### En el teléfono, `/ajustes/…` no es una pantalla: abre la hoja «Tu cuenta»

- **Síntoma:** un enlace a un ajuste en el móvil abre la hoja y se cierra al instante; o al entrar de cero por
  `/ajustes/notificaciones` se ve Inicio sin la hoja; o el botón atrás repite la misma pantalla.
- **Causa:** la hoja no es una ruta ([ADR-0072](../adr/0072-dock-configurable-hoja-de-cuenta-y-menu-de-usuario.md)): su estado vive en
  `lib/account-sheet.ts` y `AppShell` la cierra cuando cambia la ruta **resuelta** (`resolvedLocation`). Al arrancar, esa ruta pasa de
  `undefined` a `/`: si eso contara como «cambio», cerraría la hoja que acaba de abrir el `beforeLoad`. Y un `navigate()` a `/ajustes/…`
  ya ha empujado la entrada al historial cuando el `beforeLoad` la redirige a la pantalla de antes, así que queda repetida.
- **Solución:** los enlaces a Ajustes, siempre con `<Link>` (un `<a>` de verdad): el shell intercepta el clic en el teléfono antes que el
  router y abre la hoja sin tocar el historial. Evita `navigate({ to: '/ajustes/…' })` en lo que se use en el móvil; si hace falta, llama
  a `accountSheet.open(sección)` cuando `isPhone()`. El primer valor de la ruta resuelta no cierra la hoja (`AppShell`).

### `@muninn/core` se importa como TypeScript fuente

- Vite lo transpila sin problema, pero no importes `@muninn/core/file-store` (usa `node:fs`).
- **Ref:** [gotchas/core](core.md)

### `@muninn/core` solo con `import type` desde la UI

- **Síntoma:** el chunk inicial vuelve a crecer unos 100 KB.
- **Causa:** el core (y zod con él) se carga en diferido en el loader de la ruta `_app` (`loadMuninn()`).
  Un `import { algo } from '@muninn/core'` de valor en cualquier fichero del shell lo mete en el arranque.
- **Solución:** en la UI, `import type { … } from '@muninn/core'` y los datos siempre con `useMuninn()`.
  Lo mismo con `@supabase/supabase-js`: solo `import type` y el cliente a través de `loadSupabase()` (`lib/auth.ts`).
- **Ref:** [ADR-0020](../adr/0020-tanstack-router-carga-diferida.md)

### `useMuninn()` solo funciona dentro de la ruta `_app`

- Lee los datos del loader de la ruta de layout `_app`. Fuera de ella (en `/login`, o junto a `<Toaster />`
  en `main.tsx`) lanza un error. Todo lo que use datos va dentro del shell o de una pantalla. `useAuth()`
  funciona en las mismas rutas.

### Los ids de ruta llevan el prefijo `/_app`

- **Síntoma:** `Argument of type '"/asistente"' is not assignable…` en `getRouteApi`.
- **Causa:** las pantallas cuelgan de la ruta de layout `_app` (sin path), y su id incluye el del padre.
- **Solución:** `getRouteApi('/_app/asistente')`. En `<Link to>` y `navigate` se sigue usando la ruta
  (`/asistente`): el prefijo es solo del id.
- **Ref:** [ADR-0022](../adr/0022-auth-y-sesion.md)

### Rutas tipadas: los parámetros van aparte

- **Síntoma:** `Type '"/ajustes/apariencia"' is not assignable to type …` al compilar.
- **Causa:** TanStack Router solo acepta rutas registradas. Las que tienen parámetros se escriben con su
  plantilla.
- **Solución:** `<Link to="/ajustes/$seccion" params={{ seccion: 'apariencia' }}>`. Una sección de Ajustes
  nueva se añade a `screens/ajustes/sections.ts`: el `beforeLoad` de la ruta da «no encontrado» a lo demás.

### Grupos de chunks: solo librerías del shell

- **Síntoma:** al añadir una librería a un grupo de `codeSplitting` en `vite.config.ts`, el JS inicial crece
  aunque esa librería solo la use una pantalla diferida.
- **Causa:** Rolldown mete en el chunk del grupo todo módulo que case con `test`, y ese chunk lo carga quien
  use cualquiera de sus módulos (el shell).
- **Solución:** agrupa solo lo que el shell ya usa (React, TanStack, sonner, Phosphor, tailwind-merge). Mide
  antes y después con `pnpm --filter @muninn/web size`. Para ver qué paquete pesa, compila con `--sourcemap`
  y suma `sourcesContent` por paquete.

### La descripción de tarea carga `marked` solo si hay descripción

- **Síntoma:** abrir una tarea sin descripción descarga ~47 kB que no usa; o, al revés, la descripción sale un instante como texto plano.
- **Causa:** `Description` (`screens/tarea/TaskBody.tsx`) importa el renderizador con `lazy` y lo envuelve en `Suspense`, con el texto
  sin formato como respaldo. Es intencionado: el panel de la tarea es de las pantallas más abiertas.
- **Solución:** no importes `markdown/Markdown` de forma estática en el detalle de tarea. Lo que no necesita `marked`
  (`markdown/tasks`, para marcar casillas) sí se puede importar directamente.

### Filtros del tablero y arrastre: el índice es el de la columna entera

- **Síntoma:** con un filtro puesto, al soltar una tarjeta cae en un sitio distinto del que se veía, o desaparece de donde estaba.
- **Causa:** la columna que se pinta es la lista filtrada, pero `tasks.move` cuenta la columna entera (índice «sin contar la
  propia tarea», [ADR-0025](../adr/0025-escrituras-optimistas-y-deshacer.md)). Pasar el índice visible tal cual coloca la tarjeta
  entre tareas ocultas.
- **Solución:** `BoardDesktop` y `BoardMobile` convierten con `fullIndex(columnaEntera, listaVisible, id)` (`lib/board-filter.ts`, con tests):
  arriba del todo, delante de la primera visible; en otro sitio, justo debajo de la visible que queda encima; sin visibles, al final.
  Los contadores y el límite de la columna usan el total (`total` en `Column`), no las visibles. Si añades otra forma de mover
  tarjetas, usa `fullIndex`; «Deshacer» ya usa la columna entera y no depende del filtro.
- **Reparto por columnas:** visibles, `groups` (filtradas) y `totals` (columna entera) salen de `useBoardGroups` (`lib/board-groups.ts`),
  el mismo para Tablero, móvil, Lista y el contador de la cabecera; no vuelvas a llamar a `filterTasks` + `groupByColumn` en una
  vista. Sin filtro, `groups` y `totals` son **el mismo objeto**: no los mutes.

### La vista Lista no tiene arrastre y su vista vive en localStorage

- **Síntoma:** en la lista no se puede reordenar; o en otro dispositivo el proyecto se abre en «Tablero» aunque elegiste «Lista».
- **Causa:** es intencionado ([ADR-0030](../adr/0030-vista-lista-del-tablero.md)). `BoardList` pinta la caché del tablero sin dnd-kit, y la
  vista se guarda por proyecto en `localStorage['muninn.boardView']` (`lib/board-view.ts`), no en la cuenta. El calendario guarda ahí
  su escala (`calendar` / `calendar-week`) y, con el sufijo `:open`, que en el móvil se dejó el mes desplegado. Si añades otra
  preferencia de la vista, súmala a `STORED` o `readAll` la tirará como valor desconocido.
- **Solución:** si añades una acción a la fila (mover, archivar…), usa las de `task-actions.ts` para que sea optimista y con «Deshacer».
  Las filas llevan `data-task-id` en el enlace: `Tablero` devuelve el foco ahí al cerrar el panel de la tarea, en las tres vistas.

### Calendario: con teclado, el destino no sale de la geometría

- **Síntoma:** con Espacio se recoge una píldora del mes y, sin mover nada, el aviso dice «sobre el miércoles» (el día de al lado). Si
  se suelta ahí, la tarea cambia de fecha sin quererlo.
- **Causa:** la tarjeta flotante (`DragOverlay`) mide 240 px y una celda unos 120. Con teclado no hay puntero, y una colisión por
  centro (`closestCenter`) cae en el día cuyo centro está más cerca del de la tarjeta, que ya no es el suyo.
- **Solución:** `BoardCalendar` lleva el destino del teclado en una referencia (`keyTarget`), que empieza en el día de la tarea (o en
  «Sin fecha»), y su `collisionDetection` la devuelve tal cual cuando no hay puntero. Con ratón o dedo se usa `pointerWithin`. Si
  añades otro destino (otro panel que reciba tareas), dale un id en `lib/calendar.ts` y súmalo a `keyboardTarget` o a la tecla que lo
  elija.
- **Cruzar de mes (o de semana):** si el día destino no se ve, su celda aún no existe y el `coordinateGetter` no tiene dónde llevar la
  tarjeta. Entonces apunta `keyTarget` a ese día, cambia `anchor` (`anchorFor`) y deja la tarjeta donde está. Como el `KeyboardSensor`
  solo mueve en un `keydown` (y lo escucha en el documento), un efecto despacha una tecla falsa `SETTLE_CODE` en los fotogramas
  siguientes hasta que dnd-kit ha medido la celda nueva, y el getter la coloca ahí. No quites `SETTLE_CODE` del getter ni le pongas un
  código que otro atajo de la app escuche. ADR-0068 lo daba como coste aceptado: ya no lo es.
- **Ref:** [ADR-0068](../adr/0068-vista-calendario-del-tablero.md)

### Calendario: soltar cambia solo `dueDate`

- **Síntoma:** al soltar en un día se espera que la tarea «se mueva» de columna u orden, o el «Deshacer» devuelve otra columna.
- **Causa:** es intencionado ([ADR-0068](../adr/0068-vista-calendario-del-tablero.md)): `setDueDate` (`task-actions.ts`) es un `patchTask`
  de un solo campo. El orden dentro de un día lo calcula `tasksByDay` (pendientes, prioridad, columna, posición) y no se guarda.
- **Solución:** no llames a `moveTask` desde el calendario. Las fechas son texto `AAAA-MM-DD`: usa las funciones de `lib/calendar.ts` y
  `lib/dates.ts`, nunca `new Date(dueDate)` en hora local.

### Tiempo real: una tabla o un dato sincronizable nuevo

- **Síntoma:** lo que cambias en otro dispositivo no aparece, o aparece solo al recargar.
- **Causa:** `lib/sync.ts` solo escucha las tablas de `SYNC_TABLES` (las de la publicación `supabase_realtime`) y traduce cada
  una a lo que refresca (`scopesOf`). Una tabla nueva no entra sola.
- **Solución:** añádela a la publicación (migración, [gotchas/db](db.md)), a `SYNC_TABLES` y a `scopesOf`, con su caso en
  `test/sync.test.ts`. Una clave de caché nueva debe colgar de un prefijo que ya se invalida (`['projects', …]`, `['tasks', …]`,
  `['notes', …]`, `['settings']`) o tener su propio ámbito.
- **Ojo:** un borrado solo trae la clave primaria; sin `project_id`, `scopesOf` refresca todos los tableros.
- **Ref:** [ADR-0029](../adr/0029-tiempo-real-y-cache-sin-conexion.md)

### Los eventos de tus propios cambios no pisan lo optimista

- **Síntoma:** una tarjeta o un interruptor «salta» atrás un instante justo después de soltarlo, cuando hay Realtime.
- **Causa:** tu propio cambio también genera un evento; si se refrescara la caché mientras tu escritura sigue en cola, la lectura
  traería el estado anterior.
- **Solución:** `createSync` nunca refresca un ámbito con escrituras en cola (`isBusy(clave)`, de `mutations.ts`) y espera a que se
  vacíe. Toda escritura optimista nueva debe pasar por `serial(clave, …)` con la clave de lo que cambia (el proyecto, `note:<id>`,
  `settings`…) para quedar protegida. Probado en `test/sync.test.ts`.

### Caché sin conexión: cambia `CACHE_VERSION` si cambia la forma de los datos

- **Síntoma:** tras actualizar la app, una pantalla falla o enseña datos raros hasta recargar dos veces.
- **Causa:** la caché de react-query de la versión anterior se recupera de IndexedDB (`lib/offline.ts`) antes del primer pintado.
- **Solución:** sube `CACHE_VERSION` cuando cambie lo que guarda una consulta (el tipo de `BoardData`, un campo del core…): lo
  guardado con otra versión se descarta. Caduca sola a los 7 días. Se borra al cerrar sesión (`forgetUserData`).
- **Verificar:** DevTools › Application › IndexedDB › `muninn-cache` (hay una clave `queries:<id de usuario>`).

### Probar el tiempo real con dos pestañas

- En el navegador integrado, abre la misma cuenta en dos pestañas (`tabs_create`) y cambia algo en una: la otra se actualiza sola
  (hasta ~1 s por los 400 ms de agrupación). Una pestaña en segundo plano también recibe los eventos. Para probar el modo sin
  conexión no sirve `navigator.onLine`: usa el test de `test/offline.test.ts` (IndexedDB simulado) o corta la red del sistema.

### Rutas profundas y recargas: hace falta *fallback* a `index.html`

- **Síntoma:** recargar `/proyectos/abc` da 404 en el servidor.
- **Causa:** el router usa el historial del navegador; esas rutas no existen como ficheros.
- **Solución:** el hosting de la PWA debe reescribir cualquier ruta desconocida a `index.html` (por ejemplo,
  en Vercel, un `rewrites` a `/`). `vite dev` y `vite preview` ya lo hacen. En Tauri, comprueba al recargar una ruta
  profunda con `pnpm dev:desktop` cuando toques la configuración de ventanas.

### iPhone: en pantallas táctiles todos los campos de texto miden 16 px

- **Síntoma:** al tocar un campo en el iPhone, Safari amplía la página y no vuelve.
- **Causa:** iOS hace zoom en cualquier `input`, `textarea` o `select` con `font-size` < 16 px (y el viewport no desactiva el zoom, a
  propósito: sería un problema de accesibilidad).
- **Solución:** una regla global en `apps/web/src/index.css`, bajo `@media (pointer: coarse)` y **fuera de `@layer`** (así gana a las clases
  de Tailwind, que están en capa). Un campo con `text-xs` pasa a 16 px en el móvil: si en un campo muy pequeño (la etiqueta de la tarea)
  se ve apretado, ajusta el alto, no la letra. Sin probar aún en un iPhone real: va en [pruebas-iphone](../pruebas-iphone.md).

### Animaciones con `requestAnimationFrame` y ventanas sin pintar

- **Síntoma:** una animación en JS se queda a medio camino, o en el navegador integrado de las herramientas de desarrollo
  las transiciones parecen congeladas (`getAnimations()` en `currentTime: 0`).
- **Causa:** si la página no se pinta (PWA en segundo plano, panel oculto), el navegador no da fotogramas,
  aunque `document.visibilityState` diga `visible`.
- **Solución:** toda animación en JS fija su estado final con un `setTimeout` de la duración. Mejor aún, anima con
  CSS (la barra de pestañas, ADR-0054, usa una transición de `flex-basis`). Para verificar fotograma a fotograma en un panel oculto, sustituye temporalmente
  `requestAnimationFrame` por `cb => setTimeout(() => cb(performance.now()), 16)`.

### La barra de pestañas flota por encima del borde en la app instalada del iPhone

- **Síntoma:** en la app añadida a la pantalla de inicio (iOS, barra de estado `black-translucent`), al abrirla la barra
  queda unos 55 pt por encima del borde de abajo, con fondo vacío debajo. Al cambiar de sección se coloca bien. En Safari
  no pasa.
- **Causa:** a veces iOS calcula el visor de la app instalada como la pantalla menos la barra de estado, así que
  `position: fixed; bottom: 0` termina a esa altura. Es un fallo de WebKit, no de nuestro CSS.
- **Solución:** `useStandaloneGap` en `shell/TabBar.tsx` compara `screen` con `innerHeight` solo si `navigator.standalone`,
  y baja la barra la diferencia (como mucho 80 px; si no hay diferencia, no hace nada). Solo se puede comprobar en un iPhone real: va en
  [pruebas-iphone](../pruebas-iphone.md).
- **Ojo:** iOS corrige después el visor sin lanzar siempre `resize`. Si la corrección se queda puesta, la barra baja de más y se
  corta por debajo del borde (visto el 28 de octubre en el iPhone). Por eso se vuelve a medir al cambiar de pantalla, al volver a la
  app (`visibilitychange`), con `visualViewport` y a los 250 ms y 1 s. Para simularlo en el navegador: `navigator.standalone = true` y
  `screen.height` = `innerHeight + 47` con `Object.defineProperty`, navega, y después iguala `screen.height` y navega otra vez.

### En escritorio la ventana no hace scroll: lo hace `<main>`

- **Síntoma:** algo que escucha `window.scroll` o usa `window.scrollTo` no hace nada en escritorio, o un `sticky` se pega
  a un sitio raro.
- **Causa:** desde el [ADR-0050](../adr/0050-scroll-dentro-de-la-pantalla-en-escritorio.md), en ≥ 768 px el shell mide
  `h-dvh` y el scroll es de `<main id="contenido">`. `window.scrollY` vale 0. En el móvil sigue siendo la ventana.
- **Solución:** en escritorio, usa `document.getElementById('contenido')`. El router ya lo devuelve arriba al cambiar de
  pantalla (`scrollToTopSelectors`) y recuerda su posición (`data-scroll-restoration-id`). Para que una lista haga scroll
  dentro, la cadena entera necesita `min-h-0` (desde `Page fit` hasta la lista con `overflow-y-auto`): un solo eslabón
  sin él y crece en lugar de hacer scroll.
- **En una guía de Documentación** el texto tiene su propio scroll, `#guia` ([ADR-0071](../adr/0071-guia-de-documentacion-a-la-altura-de-la-ventana.md)):
  ahí `#contenido` tampoco se mueve. El router lo vuelve arriba al cambiar de guía.

### El buscador ⌘K no usa `cmdk`

- Es un *combobox* propio (`shell/CommandPalette.tsx`) con la lógica pura en `palette-items.ts` (con tests).
  El foco se queda siempre en el campo y la opción activa va por `aria-activedescendant`: no pongas
  `tabIndex={0}` en las opciones ni muevas el foco a la lista.

### Búsquedas: palabra a palabra con `words`/`matchesAll`, no frase entera

- **Síntoma:** una búsqueda de la web encuentra «Café con leche» con «café leche» pero otra no con «leche café».
- **Causa:** cada pantalla filtraba a su manera; unas por palabras, otras con `normalize(q)` + `includes` (frase entera).
- **Solución:** todo filtro de texto en el navegador usa `words(query)` y `matchesAll(texto, términos)` de `lib/text.ts`
  (sin tildes ni mayúsculas, todas las palabras en cualquier orden). Junta en un solo texto los campos donde se busca, con
  `
` entre ellos, para que las palabras puedan estar en campos distintos.
- **Ojo:** el `search` del core en el servidor (`tasks.list`, `notes.list`…, que usa el ⌘K para tareas y notas) también busca
  por palabras en cualquier orden, pero distingue tildes (`ilike`): «documentacion» no encuentra «Documentación» en el servidor.

### Sesión: saber si hay usuario sin descargar supabase-js

- `getAuth()` mira primero si existe la clave `muninn.auth` en localStorage (la `storageKey` del cliente).
  Si no está y la URL no trae `?code=` (vuelta de GitHub), no hay sesión y no se descarga supabase-js.
  **Si cambias `storageKey`, cambia también `SESSION_KEY`**, o la app creerá que nunca hay sesión.
- Las acciones del formulario (`sendEmailCode`, `verifyEmailCode`, GitHub, mensajes de error) están en
  `lib/login-actions.ts` para que viajen en el chunk del login. No las vuelvas a meter en `auth.ts`: el
  shell lo importa y acabarían en el arranque.

### `onAuthStateChange` avisa más de lo que parece

- **Síntoma:** la app recarga datos al volver a la pestaña o cada hora.
- **Causa:** supabase-js emite `SIGNED_IN` al recuperar la sesión al enfocar la pestaña, y `TOKEN_REFRESHED`
  al renovar el token.
- **Solución:** `auth.ts` solo reacciona si cambia el **id** del usuario. Al cambiar, `forgetUserData()`
  descarta la instancia del core y vacía react-query: los datos de un usuario no pueden verse en la
  sesión de otro.

### Estado `mfa`: sesión abierta, pero falta el código de la app

- **Síntoma:** tras entrar con el código del correo, la app vuelve a /login y enseña «Falta un paso» en lugar de entrar.
- **Causa:** la cuenta tiene segundo factor y la sesión aún es `aal1`. `getAuth()` devuelve `{ kind: 'mfa', account }` (lo mira
  `secondFactorStep` en `lib/auth.ts`), `/_app` manda a /login y `screens/login/Entrada.tsx` enseña el paso del código.
- **Solución:** es lo esperado ([ADR-0061](../adr/0061-seguridad-de-la-cuenta.md)). Dentro de la app, `useAuth()` nunca ve `mfa`
  (`AppAuthState`). Una ruta nueva que necesite una cuenta completa compara con `kind === 'user'`, no con `!== 'anonymous'`.
- **Ojo:** el estado se calcula al resolver `getAuth()`, una vez por arranque o cambio de usuario.

### Volver de GitHub con el segundo factor: la sesión llega sin factores

- **Síntoma:** con un factor TOTP verificado, entrar con GitHub iba directo a la app, sin «Falta un paso». En el registro de Supabase:
  `authorize?provider=github` → `token?grant_type=pkce` y ninguna llamada a `factors/…/challenge`. El servidor seguía protegido
  (`require_mfa`, ADR-0062), pero la app trataba la sesión `aal1` como cuenta completa.
- **Causa:** `mfa.getAuthenticatorAssuranceLevel()` sin argumentos no va a la red: saca `nextLevel` de `session.user.factors`, y el usuario
  que guarda el canje PKCE llega sin `factors`. Sale `aal1` → `aal1`, como una cuenta sin segundo factor. Lo mismo pasa con una sesión
  abierta antes de activarlo.
- **Solución:** `secondFactorStep` (`lib/auth.ts`): con `aal2` o con el factor ya en la sesión, decide sin red; con `aal1` y sin factores,
  pregunta al servidor con `mfa.listFactors()` (hace `getUser()`; `totp` solo trae los verificados). Cuesta una petición al arrancar
  a las cuentas sin segundo factor. Sin red, `getAuth()` se queda con lo guardado; `/oauth/consent` no (ver abajo).

### `/oauth/consent` y el segundo factor

- **Síntoma:** «Claude ya puede usar tu Muninn» sin aviso, pero con el factor activado la app no ve nada.
- **Causa:** la aprobación solo vale si queda apuntada con `approve_oauth_client_mfa` desde una sesión `aal2` (ADR-0066). La RPC devuelve
  `false` (sin lanzar) si la sesión es `aal1` o la autorización ya no está pendiente.
- **Solución:** la pantalla pregunta antes con `consentSecondFactor()` (al servidor, sin fiarse de la sesión guardada): con el factor sin
  pasar enseña «Falta un paso» y manda a /login con `resetAuth()`, que pide el código y vuelve; nunca enseña «Permitir acceso». Con el
  factor pasado, `false` o un error de la RPC es fallo: aprueba igual y avisa de quitarle el acceso y reconectar. Sin segundo factor en
  la cuenta no llama a la RPC.
- **Ojo:** el 30 de octubre a las 08:03 UTC no hubo ni la llamada ni su *preflight*, cuando a las 08:39 y después sí: lo más probable es
  que la pestaña corriera el bundle anterior (la versión con la RPC salió a las ~07:22 UTC y la PWA es `autoUpdate`: la primera carga
  tras publicar sirve lo que tenía el service worker). Al probar algo recién publicado, recarga dos veces.

### `/login` no tiene shell ni datos

- La pantalla de login cuelga de la raíz, no de `_app`: no uses ahí `useMuninn()`, `useAuth()` ni nada del
  shell. Tras iniciar sesión hay que `router.invalidate()`: el loader de `_app` tiene
  `staleTime: Infinity` y, sin invalidar, seguiría con la instancia anterior (la de la demo).

### GitHub OAuth no se ofrece en Tauri

- El proveedor redirige a una URL web; sin deep links, la sesión acabaría en el navegador del sistema.
  `isTauri` (de `TAURI_ENV_PLATFORM`) oculta el botón en escritorio. En la web, el botón solo sale si
  `GET /auth/v1/settings` dice que GitHub está activado.

### Vite recarga la página al descubrir dnd-kit y el modo demo se queda sin datos

- **Síntoma:** al abrir el tablero por primera vez tras instalar dependencias, el proyecto que acabas de crear en
  modo demo «no existe» («No encontramos este proyecto»).
- **Causa:** Vite optimiza `@dnd-kit/*` al verlo por primera vez en desarrollo y recarga la página; el modo demo vive en
  memoria ([ADR-0022](../adr/0022-auth-y-sesion.md)), así que se pierde.
- **Solución:** solo ocurre una vez por entorno. Si pasa, crea el proyecto otra vez. Con sesión iniciada no se nota.

### Las tarjetas son enlaces *y* elementos ordenables

- **Síntoma:** Enter no abre la tarea, o un clic al soltar una tarjeta navega al detalle.
- **Causa:** `useSortable` pone `role="button"` y `KeyboardSensor` arranca con Espacio **y Enter**.
- **Solución:** `SortableTaskCard` pasa `attributes: { role: 'link', … }` y el sensor de teclado se configura con
  `keyboardCodes: { start: ['Space'], … }`. El `MouseSensor` lleva `distance: 6` (un clic no es un arrastre) y dnd-kit
  suprime el clic que sigue a un arrastre. No añadas `onClick` a la tarjeta. Los sensores de todas las vistas con arrastre
  (escritorio, móvil y calendario) salen de `useBoardSensors(coordinateGetter)` (`screens/tablero/dnd.ts`): solo cambia a dónde
  llevan las flechas; no montes `useSensors` a mano en una vista nueva.
- **Ref:** [ADR-0023](../adr/0023-drag-and-drop-con-dnd-kit.md)

### Tacto: `touch-action` y la capa de «deslizar para completar»

- **Síntoma:** en móvil, tocar una tarjeta no abre nada; o el scroll vertical se queda atascado al arrastrar.
- **Causa:** (1) la capa verde de «Hecho» (`absolute inset-0`) quedaba por encima de la tarjeta y se comía el toque;
  (2) `touch-action` decide quién se queda con el gesto.
- **Solución:** la capa lleva `pointer-events-none` y la tarjeta que se desliza es `relative`. Las tarjetas de móvil usan
  `touch-pan-y` (el navegador scrollea en vertical, el horizontal es del deslizar) y el `TouchSensor` espera 250 ms
  (`delay`) con 8 px de `tolerance`. Mientras hay un arrastre en curso, deslizar no hace nada (`useDndContext().active`).
  Si tocas esto, pruébalo en un iPhone real: el navegador integrado simula clics, no gestos táctiles.

### Un cambio optimista que pisa una petición en vuelo

- **Síntoma:** una tarjeta «salta» a su sitio antiguo justo después de soltarla.
- **Causa:** había un `refetch` del tablero en curso (volver a la pestaña, `invalidate`) y su respuesta llegó después
  del cambio en caché.
- **Solución:** `optimistic()` (`lib/mutations.ts`) cancela la petición solo si hay una en vuelo y, si no, es síncrono, para
  que `setQueryData` ocurra en el mismo instante en que se suelta. No añadas un `await` antes de tocar la caché en un
  manejador de arrastre.
- **Ref:** [ADR-0025](../adr/0025-escrituras-optimistas-y-deshacer.md)

### `useMatch` con `shouldThrow: false` para saber si hay una tarea abierta

- El tablero (`Tablero.tsx`) es la ruta padre del detalle y necesita saber si hay una tarea abierta: `useMatch({ from:
  '/_app/proyectos/$projectId/tareas/$taskId', shouldThrow: false })`. En móvil, con tarea abierta, el tablero no se pinta
  (solo `<Outlet />`); en escritorio se pinta debajo del panel.

### Las tareas de «Hechas hoy» incluyen archivadas

- `overview()` cuenta las tareas completadas hoy y en los últimos 7 días **también si se archivaron después**. Si archivas
  una hecha, desaparece del tablero pero no de Inicio. Es intencionado: archivar no es deshacer.

### Un icono que solo usa una pantalla no va en `icons`

- **Síntoma:** al añadir un icono nuevo, el JS inicial sube unos 3 kB por icono aunque solo lo use una pantalla diferida.
- **Causa:** Phosphor trae los seis grosores de cada icono, todo lo de `icons` viaja en el arranque, y además el grupo
  `ui-vendor` de `vite.config.ts` carga en el arranque todo módulo de `@phosphor-icons` que alguien use.
- **Solución:** iconos de una sola pantalla en `screenIcons` (`packages/ui/src/screen-icons.tsx`, fichero aparte para que
  no compartan chunk con `icons`) y su nombre en `SCREEN_ICONS` de `vite.config.ts`, que los saca del grupo. Hoy:
  `list` y `checklist` (barra de formato de Notas) `compass`, `plug`, `shield` y `partial` (Documentación), `sun` y `reset` (Ajustes) y
  `devices`, `key` y `signOut` (Ajustes › Cuenta). `notify` solo acepta los de `icons`. Las pantallas que los leen de
  datos usan `AppIcon` (`components/AppIcon.tsx`), que junta `icons` y `screenIcons`. Si el shell pasa a usarlos, vuelven a `icons`.
- **Ref:** [ADR-0020](../adr/0020-tanstack-router-carga-diferida.md)

### Un chunk compartido `dist-*.js` (Radix) suma ~0,6 kB al arranque

- **Síntoma:** al añadir una pantalla, `pnpm --filter @muninn/web size` muestra un chunk nuevo `dist-…js` de ~8 kB (el
  `Primitive` de Radix) y el total sube ~0,6 kB, aunque la pantalla no cargue nada nuevo en el arranque.
- **Causa:** Rolldown saca a un chunk propio los módulos que importan varios chunks diferidos a la vez, y a veces los
  deja en el arranque envueltos en su `import`/`export`. No es código nuevo, es el envoltorio.
- **Solución:** nada que arreglar; solo no confundirlo con una dependencia nueva. Compara el nombre de los chunks
  antes y después.
- Algo parecido pasa con un módulo pequeño que comparten dos pantallas diferidas (`lib/seo.ts`, para el login y las guías). Va en un chunk
  aparte, y su nombre entra en el mapa de precarga del chunk de entrada: unos 30 bytes, sin cambio en gzip.

### Notas: un editor por nota y autoguardado sin pérdidas

- **Síntoma:** texto escrito que «desaparece» al cambiar de nota o al volver atrás, o un guardado antiguo que pisa a uno nuevo.
- **Causa:** el editor guarda el texto 700 ms después de la última pulsación; si se reutilizara el mismo componente al
  cambiar de nota, el texto pendiente iría a la nota equivocada.
- **Solución:** `NotaDetalle` monta `<NoteEditor key={noteId}>`: cada nota tiene su propio editor, que guarda lo pendiente
  al desmontarse (`useNoteDraft`), al ocultarse la pestaña y al salir del campo. Todas las escrituras de una nota van en
  cola (`serial('note:<id>')`, `lib/note-actions.ts`). El autoguardado **no** usa `notify`: el estado «Guardado» está en la barra.
- **Ref:** [ADR-0026](../adr/0026-markdown-marked-a-react-y-textarea.md)

### Editar un `textarea` por código sin perder el deshacer

- **Síntoma:** tras pulsar **B** (negrita) o continuar una lista con Enter, Ctrl/⌘ Z no deshace, o deshace de golpe todo lo anterior.
- **Causa:** asignar `textarea.value` o usar `setRangeText` borra el historial de deshacer del campo.
- **Solución:** `applyEdit` (`markdown/edit.ts`) selecciona el tramo y usa `document.execCommand('insertText')`, que
  lo conserva y dispara el `input` que espera React. Solo si no existe, cae a `setRangeText` más un evento `input` a mano.

### Las barras de formato van arriba, no sobre el teclado

- En iOS el teclado no cambia el alto de la página (no hay `interactive-widget`), así que una barra pegada abajo quedaría tapada.
  La del editor de notas es `sticky` arriba. Sus botones llevan `onMouseDown={e => e.preventDefault()}`: así no le quitan el
  foco al `textarea` ni cierran el teclado al tocarlos.

### Escribir una guía de `docs/user` para la app

- **Síntoma:** una guía no sale en el menú, un enlace no funciona o un aviso no se destaca.
- **Causa:** la sección Documentación solo importa `NN-nombre.md` (dos cifras, guion y minúsculas) y solo entiende seis
  claves planas de metadatos: `title` (obligatorio), `description`, `order`, `status` (`disponible`, `parcial`,
  `proximamente`; otro valor cuenta como disponible), `group` (`primeros-pasos`, `tu-trabajo`, `modulos`, `ia`,
  `cuenta`; sin él, la guía cae en «Más guías») e `icon` (un nombre de `icons` o `screenIcons`). El test de
  `test/docs.test.ts` falla si una guía no tiene grupo o su icono no existe.
- **Solución:** el `# Título` con que empieza el texto se quita (el título sale de los metadatos). Una cita que empieza
  en negrita (`> **Estado:** …`) se pinta como aviso. Los enlaces entre guías van como `05-notas.md#archivar` (las anclas
  se comparan sin tildes: `#iniciar-sesión` e `#iniciar-sesion` son lo mismo); cualquier otro fichero relativo se ve como texto.
  `> **Estado:**` lleva el círculo a medias y `> **Próximamente:**` va en neutro con reloj. Nada de HTML ni imágenes
  ([ADR-0026](../adr/0026-markdown-marked-a-react-y-textarea.md)).
- **Ref:** [ADR-0027](../adr/0027-documentacion-en-la-app-desde-docs-user.md), [ADR-0052](../adr/0052-documentacion-con-grupos-iconos-y-portada.md)

### Los diálogos del shell se cargan al abrirse la primera vez

- «Nueva tarea» y «Nuevo proyecto» son `lazy` en `AppShell`: su código no viaja en el arranque. La primera vez que se abren
  hay una petición pequeña (el resto, ya en caché). Si añades otro diálogo global, haz lo mismo y mide con `size`.

### La insignia de GitHub solo es enlace fuera de las tarjetas

- **Síntoma:** la insignia «GitHub #42» de una tarjeta no abre la issue.
- **Causa:** la tarjeta entera es un `<a>` (y elemento ordenable de dnd-kit): un enlace dentro de otro es HTML no válido y rompe el clic y el
  teclado.
- **Solución:** en las tarjetas, `SourceBadge` sin `link`; en el detalle de la tarea (y donde no haya un enlace alrededor), con `link` y
  `externalUrl`. El título y la descripción de una tarea de GitHub son de solo lectura en el detalle (`fromGithub` en `TaskBody.tsx`).

### Pantalla GitHub: las «Ejecuciones recientes» salen de la actividad, no de GitHub Actions

- **Síntoma:** una ejecución del agente que falló en Actions no sale como «Falló», o «Trabajando» sigue aunque el workflow ya acabó.
- **Causa:** es intencionado. Muninn no recibe `workflow_run` ([ADR-0032](../adr/0032-columna-para-el-agente.md), alternativas). `agentRuns`
  (`lib/github-overview.ts`, con tests) cruza dos cosas: las tareas que están **ahora** en la columna del agente («Trabajando», con la hora
  de su último cambio) y el último evento `agent_*` de cada tarea en la actividad (`recentActivity({ actions })`). Un fallo del workflow
  llega como `agent_stopped` cuando el workflow quita la etiqueta; hasta entonces la tarea sigue en la columna.
- **Solución:** si quieres el estado real de cada ejecución, hay que suscribir el webhook a `workflow_run` y guardarlo (nuevo ADR). Las consultas
  de la pantalla cuelgan de `['tasks', …]` y `['projects', …]`: la actividad no está en `SYNC_TABLES`, pero cada paso del agente mueve una
  tarea y eso ya la refresca.

### Finanzas: una sola cola y un solo prefijo de caché

- **Síntoma:** un saldo que «salta» atrás un instante tras apuntar un movimiento, o un cambio de otro dispositivo que no se ve en el resumen.
- **Causa:** saldos, listas del mes y últimos movimientos dependen unos de otros. Por eso todas las escrituras de Finanzas van por la misma
  cola (`serial('finance')`, `lib/finance-actions.ts`) y todas las consultas cuelgan de `['finance', …]` (`lib/finance-queries.ts`).
- **Solución:** una acción nueva de Finanzas usa `run` (la cola) y `settleFinance`; una consulta nueva cuelga de `['finance', …]`. El tiempo
  real refresca ese prefijo entero (`scope` `finance`) y espera a que se vacíe la cola. Lo optimista (`cacheTransaction`, `cacheBalances`)
  calcula el saldo igual que la vista del servidor (`applyToBalances`, con tests); si cambias la regla del saldo, cambia las dos.
- **Ojo:** la lista del mes se filtra en el navegador (`filterTransactions`): el core solo recibe el mes. La pestaña va en la URL
  (`/finanzas?vista=movimientos`); el mes, no (vuelve al actual al entrar).

### Publicar la PWA y activar Web Push (pasos manuales)

- **Síntoma:** no se puede instalar Muninn en el iPhone, ni conectar el MCP con OAuth desde otro dispositivo, ni recibir avisos push.
- **Causa:** la web solo existe en `localhost`; publicarla, el dominio, los secretos y los despliegues no se pueden hacer desde el código
  ([ADR-0040](../adr/0040-pwa-instalable-y-web-push.md): hosting en Vercel aceptado; Web Push, propuesto).
- **Estado (26-10-2026):** pasos 1 y 2 hechos. Proyecto `muninn` del equipo Kodemaru, rama de producción `develop`, en
  `https://muninn-sepia.vercel.app`. Faltan los pasos 3 (opcional), 4 y 5.
- **Solución (publicar, con Vercel):**
  1. Vercel › **Add New › Project** › importa `lopezz-dev/muninn`. **Root Directory** = `apps/web` (deja marcado *Include files outside the
     root directory*). `apps/web/vercel.json` ya trae el build, el *fallback* a `index.html` y las cabeceras de caché del service worker.
     **Production Branch** = `main` (hasta que `main` alcance a `develop`, puedes usar `develop` para probar).
  2. **Environment Variables** (Production y Preview): `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (las de `apps/web/.env.local`;
     la publicable, nunca la service role). Despliega.
  3. Dominio (opcional): Vercel › **Domains** › añade el tuyo y crea el registro DNS que te pida.
  4. Supabase › **Authentication › URL Configuration**: *Site URL* = la URL publicada (así `/oauth/consent` funciona fuera de este
     ordenador, ADR-0036) y añade `https://<tu-url>/**` a *Redirect URLs* (deja las de `localhost`). En GitHub › la OAuth App de Muninn, la
     *Homepage URL* puede pasar a la publicada (el *callback* no cambia).
  5. Comprueba: abrir `https://<tu-url>/finanzas` y recargar no da 404; en el iPhone, Safari › Compartir › **Añadir a pantalla de inicio**
     y abrirla desde el icono (pantalla completa, sin barra de Safari). La lista de [pruebas-iphone](../pruebas-iphone.md) ya se puede pasar.
- **Solución (Web Push):** el código está hecho (tablas `push_subscriptions` y `push_log`, `m.push` en el core, Ajustes › Notificaciones,
  `public/push-sw.js` y la Edge Function `push`). Falta, en este orden:
  1. **Claves VAPID** (una vez, en tu equipo; no las pegues en el chat ni en el repo): `npx web-push generate-vapid-keys`. Guarda las dos
     en tu gestor de contraseñas: si cambias la pública, todas las suscripciones dejan de valer y hay que volver a activar cada dispositivo.
  2. **Migración:** aplica `supabase/migrations/20261028180000_push_subscriptions.sql` (SQL Editor o `npx supabase@2 db push`). Si usas
     `apply_migration` del MCP de Supabase, alinea la versión (ver [gotchas/db](db.md)).
  3. **Secretos de la función** (Supabase › **Edge Functions › Secrets**, o `npx supabase@2 secrets set NOMBRE=valor`):
     `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:<tu correo>`: los servicios de push escriben ahí si algo va mal).
     Reutiliza `MUNINN_SYNC_SECRET` (el del cron de GitHub) y, opcional, `MUNINN_TIME_ZONE` (`Europe/Madrid` por defecto).
  4. **Desplegar:** `pnpm --filter @muninn/core build:edge` (genera `supabase/functions/push/_core/muninn.js`, fuera de git) y
     `npx supabase@2 functions deploy push --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt --use-api`. `--no-verify-jwt` porque el cron no
     manda JWT; la función comprueba su secreto (`/push/send`) o la sesión (`/push/test`).
  5. **Web:** Vercel › Environment Variables (Production y Preview): `VITE_VAPID_PUBLIC_KEY` = la **pública** (lo es por diseño; nunca la
     privada) y vuelve a desplegar. En local, en `apps/web/.env.local`. Sin ella, Ajustes › Notificaciones dice «Avisos sin configurar».
  6. **Cron diario** (SQL Editor; `pg_cron`, `pg_net` y el secreto `muninn_sync_secret` del Vault ya existen por GitHub). `0 7 * * *` es
     UTC: las 8 en invierno y las 9 en verano en Madrid.
     ```sql
     select cron.schedule('muninn-push-charges', '0 7 * * *', $
       select net.http_post(
         url := 'https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/push/send',
         headers := jsonb_build_object(
           'content-type', 'application/json',
           'x-muninn-sync-secret',
           (select decrypted_secret from vault.decrypted_secrets where name = 'muninn_sync_secret')
         ),
         body := '{}'::jsonb,
         timeout_milliseconds := 30000
       );
     $);
     ```
  7. **Site URL:** la de Supabase (paso 4 de arriba) debe ser la URL publicada. El permiso de avisos va por origen: lo concedido en una
     vista previa de Vercel no vale en producción, y el enlace del aviso abre la app en el origen donde se activó.
  8. **Probar a mano:** `curl -X POST -H "x-muninn-sync-secret: <MUNINN_SYNC_SECRET>" https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/push/send`
     responde `{ users, results: [{ alerts, sent, removed, failed }], pruned }`; sin secreto, 401. Desde la app, **Enviar prueba**.
- **Ojo:** en iOS el permiso solo se puede pedir desde la PWA **instalada** y tras un toque (`enablePush` llama a `requestPermission` lo
  primero, antes de cualquier otra espera). Si la desinstalas, la suscripción muere y la función la borra al recibir `404`/`410`.
- **Ojo:** un aviso de cobro se apunta en `push_log` (`charge:<suscripción>:<fecha>`) cuando llega al menos a un dispositivo: si el cron
  corre dos veces no repite, y si un día no corre (proyecto pausado), el siguiente avisa de lo que siga dentro de la ventana. Si todos los
  dispositivos fallan, se reintenta al día siguiente. El cron borra el registro de más de 90 días.
- **Ojo:** `push_subscriptions` es única por `(owner_id, endpoint)`, no por `endpoint`: con RLS, un `upsert` no ve la fila de otro usuario.
  Por eso al **cerrar sesión** la app borra la fila de este dispositivo y cancela la suscripción del navegador (`leaveThisDevice`).
- **Ojo:** solo se admiten direcciones de servicios de push conocidos (`isPushServiceUrl` en `schemas.ts`: FCM, Mozilla, Apple y
  Windows), en el core, en un `check` de la tabla y otra vez antes de enviar. La función hace un POST a esa dirección desde la red de
  Supabase: aceptar cualquier `https://` sería un SSRF. Si un navegador nuevo usa otro servicio, añádelo en los tres sitios.
- **Ojo:** la función usa `npm:web-push`, que tira de `crypto` y `https` de Node. Si el runtime de Supabase lo rompe (errores de
  `createECDH` en los logs), cámbialo por una librería nativa de Deno con la misma forma (`sendNotification` → código HTTP): lo demás
  (qué avisar, a quién, borrar con 410) está en el core y no cambia.

### Asistente: todo en su chunk, y el historial en el dispositivo

- **Síntoma:** el JS inicial crece al tocar el asistente, o una conversación de otra cuenta aparece tras cambiar de usuario.
- **Causa:** `@muninn/assistant` (catálogo, bucle, proveedores) solo debe viajar con la pantalla Asistente: si el shell lo importa, entra
  en el arranque. El historial vive en IndexedDB (`muninn-assistant`, `lib/assistant-history.ts`), no en la cuenta ([ADR-0041](../adr/0041-asistente-local-con-catalogo-unico.md)).
- **Solución:** importa `@muninn/assistant` solo desde `screens/Asistente.tsx`, `screens/asistente/*` y los `lib/assistant-*` que usan
  ellas; Ajustes usa `lib/assistant-settings.ts`, que no lo importa (repite los dos valores por defecto). `forgetUserData` borra el
  historial al cerrar sesión o cambiar de usuario.
- **Ojo:** «Deshacer» guarda las inversas **en memoria** (`useAssistantChat`): tras recargar, los cambios siguen listados pero sin botón (la
  actividad conserva quién hizo qué). La demo usa el proveedor guionizado (`lib/assistant-demo.ts`) sobre el store en memoria: lo que hace
  es real dentro de la demo. Para probar el estado «Ollama no responde» basta con una sesión en un ordenador sin Ollama.

### Asistente: el borrador vive en el `Composer` y los turnos van con `memo`

- **Síntoma:** escribir en la caja del asistente va a tirones con conversaciones largas; o, en un test, `useImageAttachments` se queda
  colgado hasta el *timeout*.
- **Causa:** si el borrador (o las imágenes) vuelve a la pantalla `Asistente`, cada tecla repinta todas las respuestas y su Markdown.
  `Reply` y `UserBubble` son `memo`: un `onUndo` creado en línea o un objeto nuevo por render los repinta igual. Y `useImageAttachments`
  pregunta por la visión cada vez que cambia el `provider`: uno creado en cada render (sin `useMemo`) entra en bucle.
- **Solución:** el borrador y las imágenes son del `Composer` (`screens/asistente/Composer.tsx`, con `useImageAttachments`). La pantalla
  le habla con su *handle* (`prefill` para `?q=` sin modelo, `clear`, `submit` de las sugerencias, `focus`). A `Reply` pásale
  `onUndo(turnId)` estable (`useCallback`) y booleanos, no funciones nuevas. El `provider`, siempre memorizado.

### Asistente: los módulos desactivados no se ofrecen al modelo

- **Síntoma:** en la demo «He gastado 24,90…» responde «Finanzas está desactivado».
- **Causa:** el asistente solo pasa al modelo las herramientas de los módulos activos (`toolsFor`, ADR-0028 y ADR-0041). Si el modelo pide una
  de un módulo oculto, el bucle le contesta que el usuario lo tiene desactivado para que se lo diga. El MCP sigue viéndolo todo.
- **Solución:** activa el módulo en Ajustes › Módulos. No lo «arregles» pasando todo el catálogo.

### Noticias: todo cuelga de `['news', …]` y la cola `news`

- Fuentes, artículos y resumen se refrescan juntos (`scope` `news` del tiempo real) y las escrituras van por `serial('news')` (`lib/news.ts`).
  Los filtros (tema, guardadas, búsqueda) se aplican en el navegador sobre los 200 últimos: el core solo los lista.
- El resumen se genera solo la primera vez que se abre Noticias en el día **si** hay artículos recientes y Ollama responde
  (`lib/news-digest.ts`, una generación a la vez por pestaña). En la demo no se genera (no hay modelo): se ve el texto que lo explica.
- «Crear tarea» abre el diálogo de siempre con el título y el enlace ya puestos (`openNewTask({ title, description })`).

### Un `import()` dinámico de un paquete que otra pantalla importa estático engorda el arranque

- **Síntoma:** al añadir una pantalla, `pnpm --filter @muninn/web size` sube ~2–3 kB gzip y aparece en el arranque un `dist-*.js` de ~10 kB
  con utilidades de Radix (`useId`, `useControllableState`…), aunque la pantalla nueva es diferida.
- **Causa:** `lib/news-digest.ts` hacía `await import('@muninn/assistant')`, que la pantalla Asistente importa de forma estática. Rolldown
  reparte entonces los módulos compartidos en chunks nuevos y uno de ellos (Radix) acaba colgando del shell.
- **Solución:** desde código que ya vive en un chunk diferido (una pantalla y sus `lib/`), importa `@muninn/assistant` de forma estática.
  Antes de abrir el PR, compara `size` con la rama anterior; para encontrar al culpable, quita imports de la pantalla nueva de uno en uno.

### Informe de la mañana: el programador solo se carga si está activado

- **Síntoma:** el informe no se hace a su hora aunque Muninn está abierto; o el iPhone no genera ninguno.
- **Causa:** `AppShell` solo monta `MorningReportRunner` (chunk propio, con `@muninn/assistant`) si `preferences.morningReport.enabled`, y el
  runner no hace nada en móviles (`isHandheld`): lo prepara el ordenador ([ADR-0043](../adr/0043-informe-de-la-manana-en-local.md)). Mira cada
  minuto y compara la hora local `HH:MM` con la elegida.
- **Solución:** para probarlo, pon la hora un par de minutos más tarde o usa «Hacer ahora» (Ajustes › Asistente e IA). Los ajustes viven en
  `lib/morning-report-prefs.ts` (sin `@muninn/assistant`, para que Ajustes no lo cargue); la generación, en `lib/morning-report.ts`.
- **Ojo:** la página de Ajustes importa la generación con `import()` dinámico solo al pulsar «Hacer ahora». Si un día lo importas de forma
  estática allí, mide `size`.

### Ajustes en `preferences`: el cambio se calcula dentro de la cola

- **Síntoma:** un ajuste vuelve a su valor anterior al tocar otro justo después (p. ej. cambias la hora del informe y pulsas el interruptor
  sin salir del campo: el aviso dice «a las 20:29» y luego «cada día a las 08:30»).
- **Causa:** `m.settings.update` fusiona por clave de `preferences`, pero cada clave (`morningReport`…) se guarda entera. Si dos cambios leen
  el estado antes de escribir, el segundo escribe la copia vieja y pisa al primero; `serial` ordena las escrituras, no las lecturas.
- **Solución:** lee lo guardado **dentro** de `serial('settings', …)` y aplica solo tu parche, como `savePrefs` en `lib/morning-report-prefs.ts`
  (con test en `test/morning-report.test.ts`). Lo mismo para cualquier otra clave de `preferences` con varios campos.

### Vercel: qué URL es pública y cómo se toca el proyecto

- **Síntoma:** una URL de despliegue (`muninn-<hash>-kodemaru.vercel.app`) redirige al login de Vercel; o el MCP de Vercel contesta
  `403 forbidden` al crear o cambiar el proyecto.
- **Causa:** la protección por defecto del equipo Kodemaru es *Vercel Authentication* en `all_except_custom_domains`: las URLs de cada
  despliegue y de rama piden sesión de Vercel, pero los dominios del proyecto (`muninn-sepia.vercel.app` y los que añadas) son públicos.
  El conector MCP de Vercel no tiene permiso de escritura en ese equipo; la CLI (`vercel`, con sesión en este equipo) sí.
- **Solución:** comparte y prueba siempre la URL de producción, no la del despliegue. Para cambiar el proyecto usa la CLI con el id y el
  equipo explícitos, p. ej. `vercel api "/v9/projects/prj_9QxS82caEAdwuyXwXcfAVLFImmZL?teamId=team_KBorOe6hUDxwOXVixaaqDdwf"`. La rama de
  producción se cambia con `PATCH /v9/projects/<id>/branch` (`{"branch":"main"}` al pasar a `main`, paso 9 de la [fase final](../fase-final.md)).
- **Ojo:** no rebajes la protección del equipo para «abrir» una URL de despliegue: la de producción ya es pública y la app pide su login.

### Iconos y favicon salen del logo: si cambia el logo, regenéralos

- **Síntoma:** la pestaña, la PWA instalada o el icono de iOS enseñan un logo distinto del de la app.
- **Causa:** `public/favicon.*`, `apple-touch-icon.png` e `icon-*.png` son ficheros generados. La geometría y los colores del logo
  (`shell/Logo.tsx`) están copiados en `scripts/logo.mjs`, que no lee el componente. La imagen social (`og-image.jpg`) lleva texto
  en Geist y se dibuja aparte, en el navegador.
- **Solución:**
  - Cambia la geometría en `scripts/logo.mjs` y ejecuta `pnpm --filter @muninn/web icons`. No necesita dependencias: escribe los
    PNG y el ICO con `zlib`.
  - Para la imagen social, con `pnpm dev`, abre `/scripts/og-image.html`, pulsa «Descargar» y guárdala en `public/og-image.jpg`.
  - Los `maskable` y el de iOS llenan el cuadrado, sin esquinas transparentes: iOS pinta de negro la transparencia, y Android
    recorta los `maskable` con su forma. El pájaro cabe en la zona segura (radio del 40 %).
  - El navegador y el service worker guardan el favicon en caché: para ver el nuevo, recarga forzando o abre una ventana privada.
  - Los iconos de escritorio salen del mismo dibujo: `pnpm --filter @muninn/desktop icons` ([gotchas/desktop](desktop.md)).
- **Ref:** [ADR-0045](../adr/0045-seo-de-la-web-sin-ssr.md)

### Metas por página: `usePageMeta`, sin canónica fija

- **Síntoma:** al compartir un enlace de una guía, la tarjeta dice «Muninn · Tu sistema operativo personal» y no el título de la guía.
  O Google trata todas las rutas como la misma página.
- **Causa:** todas las rutas sirven el mismo `index.html`. Las tarjetas (WhatsApp, Slack, X…) no ejecutan JavaScript y solo leen las
  metas de ese HTML, que son las de toda la app. Un `<link rel="canonical">` fijo allí diría que cada ruta es la portada.
- **Solución:**
  - Las páginas públicas llaman a `usePageMeta({ title, description })` (`lib/seo.ts`). Pone el título, la descripción, `og:*`,
    `twitter:*` y la canónica (la ruta sin `?…` ni `#…`), y al salir los devuelve a como estaban. Eso lo leen Google y los
    buscadores que ejecutan JavaScript.
  - Las pantallas privadas siguen con `PageHeader`, que solo cambia el título.
  - Que las tarjetas lleven el título de la guía necesitaría prerender (propuesta del ADR-0045).
  - El dominio de producción está escrito a mano en el repo: si cambia, sigue [Cambiar el dominio de la web](#cambiar-el-dominio-de-la-web-lista-completa).
- **Ojo en tests:** en jsdom, `document.head.innerHTML = …` también borra el `<title>`; pon `document.title` después.
- **Ref:** [ADR-0045](../adr/0045-seo-de-la-web-sin-ssr.md)

### Cambiar el dominio de la web: lista completa

- **Síntoma:** tras pasar a un dominio propio (o a otro `*.vercel.app`), la tarjeta al compartir enseña la URL vieja, los buscadores
  siguen el sitemap viejo, entrar con GitHub vuelve al dominio anterior o el Asistente de la web no llega a Ollama.
- **Causa:** la URL de producción (hoy `https://muninn-sepia.vercel.app`) no sale de una variable. Las tarjetas y los buscadores no
  ejecutan JavaScript, así que va escrita a mano en el repo; y además está configurada en varios servicios.
- **Solución:** al cambiarla, repasa todo esto (y busca la vieja con `git grep muninn-sepia`).
  - **En el repo**, en un PR a `develop`:
    - `apps/web/index.html`: `og:url`, `og:image` y `twitter:image`;
    - `apps/web/public/robots.txt`: la línea `Sitemap:`;
    - `apps/web/public/sitemap.xml`: cada `<loc>`;
    - la URL en los docs que la citan: `ROADMAP.md`, `fase-final.md`, ADR-0040 y la entrada «Vercel: qué URL es pública» de aquí.
  - **Fuera del repo** (a mano, cada uno en su panel):
    - Vercel › *Settings › Domains*: añadir el dominio (el `*.vercel.app` puede quedarse como alias);
    - Supabase › *Authentication › URL Configuration*: *Site URL* y `https://<dominio>/**` en *Redirect URLs* (el OAuth del MCP,
      `/oauth/consent`, depende de la *Site URL*, ADR-0036);
    - GitHub › la OAuth App de Muninn: *Homepage URL* (el *callback* es de Supabase y no cambia);
    - `OLLAMA_ORIGINS` en cada ordenador que use el Asistente desde la web, y reiniciar Ollama;
    - el secreto `MUNINN_MCP_ALLOWED_ORIGINS` de la función `mcp`, si incluye la URL de la web;
    - si el MCP ya se sirve desde el dominio de la web (`/mcp`): el secreto con sus URL públicas y los conectores de claude.ai y Claude
      Code, que hay que quitar y volver a añadir con la URL nueva (ver gotchas/mcp, «El conector sale con el icono de Supabase»);
    - Search Console (cuando esté dado de alta): añadir la propiedad nueva y volver a enviar `sitemap.xml`.
    - Cloudflare › Turnstile: añadir el dominio a los *hostnames* del widget del CAPTCHA (ADR-0060), o el login fallará.
  - **Comprueba** después: pega la URL nueva en un chat (sale la tarjeta), abre `/robots.txt` y `/sitemap.xml`, y entra con GitHub.
    Las apps instaladas (PWA) de la URL vieja no se mudan solas: hay que instalarlas otra vez desde la nueva.
- **Ref:** [ADR-0045](../adr/0045-seo-de-la-web-sin-ssr.md), [ADR-0040](../adr/0040-pwa-instalable-y-web-push.md)

### Ajustes: un ajuste nuevo se da de alta en dos sitios

- **Síntoma:** un ajuste nuevo no sale en el buscador de Ajustes, o cambia su valor y no aparece el punto de «cambiado»
  ni el botón de restablecer.
- **Causa:** el buscador no recorre las filas pintadas (obligaría a montar todas las secciones): lee `SETTINGS_INDEX`
  de `lib/settings-search.ts`. Y la marca de «cambiado» solo conoce las preferencias de `changedPrefs`
  (`lib/settings-changes.ts`).
- **Solución:** añade la entrada al índice con el mismo `id` que la fila (`<PrefRow id="…">` pinta `id="ajuste-…"`).
  Si el ajuste tiene un valor de fábrica claro, añádelo también a `PrefKey`, `PREF_SECTION`, `changedPrefs` y
  `resetPrefs`. `test/settings.test.ts` falla si una entrada apunta a una sección que no existe o repite fila.
- **Al saltar a un ajuste** desde los resultados, la sección se monta en el mismo render en que cambia la dirección: el
  resaltado (`useFlashHash`) busca el elemento un fotograma después. Si lo buscas en el efecto directamente, aún no está
  y no se resalta nada (sin error).
- **Ref:** [ADR-0053](../adr/0053-ajustes-por-grupos-buscador-y-restablecer.md)

### La pantalla se sale por la derecha en el teléfono

- **Síntoma:** en el iPhone una pantalla se puede arrastrar hacia los lados o las tarjetas aparecen cortadas por la
  derecha; en el ordenador se ve bien. Desde el ADR-0054 `<main>` lleva `overflow-x: clip` en el teléfono, así que el
  síntoma puede ser solo «el borde derecho de las tarjetas no se ve».
- **Causa:** una rejilla sin columnas en el tamaño pequeño (`grid gap-3 lg:grid-cols-3`) usa una pista implícita
  `auto`, que crece hasta el ancho mínimo de su contenido. Un título con `truncate` (`white-space: nowrap`) dentro la
  estira hasta su longitud entera.
- **Solución:** declara siempre las columnas desde el tamaño más pequeño: `grid grid-cols-1 lg:grid-cols-3` (en
  Tailwind v4, `grid-cols-1` es `minmax(0, 1fr)`). En filas flex, el hijo que se recorta necesita `min-w-0`.
- **Verificar:** abre la pantalla a 390 px de ancho con títulos largos.
- **Ref:** [ADR-0054](../adr/0054-shell-responsive-en-tres-tamanos.md)

### La imagen de un proyecto no carga, o carga y luego deja de cargar

- **Síntoma:** una tarjeta enseña la inicial aunque el proyecto tiene imagen, o la imagen desaparece tras un día con la
  app abierta.
- **Causa:** la imagen se pinta con una URL firmada que caduca a las 24 h (`projectImageQuery`, con 12 h de vigencia en
  react-query). Sin conexión no se puede pedir otra, y una URL caducada da error. En modo demo es un `blob:` que muere al
  recargar.
- **Solución:** es el comportamiento previsto: `ProjectAvatar` y `ProjectCover` caen a la inicial y el color si la imagen
  falla (`onError`). No guardes la URL en ningún sitio (ni en la base de datos ni en estado propio): pide siempre
  `projects.imageUrl(path)` a través de la consulta.
- **Ref:** [ADR-0055](../adr/0055-imagen-de-proyecto-en-storage.md)

### CAPTCHA de la entrada: Turnstile (pasos manuales)

- **Síntoma:** con el CAPTCHA activo en Supabase, «Enviar código» falla con «No hemos podido comprobar que no eres un
  robot» (`captcha_failed`), o el botón se queda en «Comprobando…».
- **Causa:** Supabase exige `captchaToken` en `signInWithOtp` y el build no lleva `VITE_TURNSTILE_SITE_KEY`, el
  *hostname* no está en el widget de Cloudflare (Turnstile da error 110200) o se reutilizó un token (son de un solo uso).
- **Solución / orden para activarlo** (ADR-0060; la lista viva está en `docs/fase-final.md`, paso 4c):
  1. Cloudflare › Turnstile › *Add widget* con los *hostnames* de la web publicada, `localhost` y `tauri.localhost`.
  2. `VITE_TURNSTILE_SITE_KEY` en Vercel (Production y Preview) y en `.env.local`; redesplegar y ver que el widget carga.
  3. **Después**, Supabase › Authentication › Attack Protection: Turnstile con la clave **secreta**. Al revés, el login
     publicado deja de funcionar hasta que llegue el despliegue con la variable.
- Sin la variable no se descarga nada de Cloudflare: los entornos locales y la demo no necesitan clave. Para probar el
  widget en local sin cuenta, Cloudflare publica claves de prueba (`1x00000000000000000000AA` siempre pasa).
- `verifyOtp` y GitHub no llevan token: Supabase solo lo comprueba al pedir el código. Si algún día se añade otra
  llamada protegida (contraseñas, `resend`, registro anónimo), tiene que pedir su propio token.
- Si cambias el dominio, añádelo también a los *hostnames* del widget (lista de «Cambiar el dominio de la web»).

### Ajustes › Cuenta no sale en la demo: cómo ver el segundo factor sin cuenta

- **Síntoma:** en el modo demo, Ajustes › Cuenta solo enseña «Estás en modo demo», aunque el core de la demo tiene la
  seguridad simulada (`memory-account.ts`: vale cualquier código menos `000000`).
- **Causa:** `Seccion.tsx` corta en `auth.kind === 'demo'` antes de pintar Sesiones, Segundo factor y Apps.
- **Solución:** para revisar los diálogos en la demo, en local y sin commitear, haz que esa rama devuelva `<SegundoFactor />`
  y navega con el router (recargar borra la demo). La demo no genera QR (`qrCode: ''`): el diálogo enseña un hueco que
  manda a la clave. Para ver el QR, envuelve `m.account.mfa.enroll` desde la consola y devuelve un `data:image/svg+xml`.

### Color de columna: el punto sale de `ColumnDot`, y las tareas llevan una copia

- **Síntoma:** cambias el color de una columna y en la Lista o en el calendario las tareas siguen con el punto de antes, o una
  vista nueva pinta el color del tipo aunque la columna tenga uno propio.
- **Causa:** las tareas del tablero llevan una copia de su columna (`TaskWithColumn.column`: nombre, tipo y `color`), y el color
  propio (`board_columns.color`, un nombre de la paleta como `violet`) tiene prioridad sobre el del tipo (`KIND_DOT`).
- **Solución:** pinta el punto con `ColumnDot` (o `columnDot`, si necesitas la clase y el estilo por separado) de
  `screens/tablero/Column.tsx`, nunca con `KIND_DOT[column.kind]` a pelo. `updateColumn` (`lib/column-actions.ts`) actualiza a la vez
  la columna y la copia de cada tarea; si añades otra forma de cambiar una columna, haz lo mismo.

### Subtareas: dnd-kit también en el detalle de la tarea

- **Síntoma:** el chunk del detalle de tarea pesa más que antes, o en el móvil el asa de una subtarea no responde al primer toque.
- **Causa:** `screens/tarea/Checklist.tsx` reordena con dnd-kit (como las categorías de Finanzas), así que la librería ya no vive
  solo en el chunk del tablero ([ADR-0023](../adr/0023-drag-and-drop-con-dnd-kit.md)); Vite la saca a un chunk compartido. En
  tacto, el asa espera 200 ms pulsada (`TouchSensor`) para no pelear con el scroll.
- **Solución:** no la metas en un grupo de `codeSplitting`: se pide al abrir una tarea, no al arrancar. El orden lo calcula el core
  (`checklist.move`, índice entre las demás) y la acción optimista con «Deshacer» es `moveChecklistItem` (`lib/task-actions.ts`).
