# Gotchas · web (`apps/web`)

### Variables de entorno de Supabase

- Se llaman `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (la clave pública `sb_publishable_…`).
  **Nunca** pongas la service role key en una variable `VITE_*`: acaba dentro del bundle.

### El service worker no se registra en Tauri

- **Síntoma:** en escritorio no hay PWA ni caché offline del service worker.
- **Causa:** es intencionado. `vite.config.ts` desactiva `VitePWA` cuando existe `TAURI_ENV_PLATFORM`.
- **Solución:** el modo offline en escritorio se resolverá en la capa de datos, no con el service worker.

### Notificaciones push en iPhone

- Solo funcionan si la PWA está **añadida a la pantalla de inicio** (iOS 16.4 o superior) y tras pedir permiso
  con un gesto del usuario (un clic). En Safari, sin instalar, no hay push.

### Módulos desactivados: qué mira cada pieza del shell

- **Síntoma:** un módulo desactivado sigue saliendo en el dock, el buscador o un atajo; o el menú parpadea al cargar.
- **Causa:** cada pieza decide por su cuenta. Todas usan `useEnabledModules()` (`lib/modules.ts`) y `sectionEnabled()`
  (`shell/nav.ts`): barra lateral, dock (`dockFor`), «Más», buscador y la tecla **N**. Los ajustes llegan por la caché de
  react-query (`keys.settings`), que rellena el loader de `_app` antes de pintar; mientras valgan `null` se enseña todo.
- **Solución:** una sección nueva con módulo se declara en `SECTION_MODULE`; no compruebes `enabledModules` a mano. El dock
  cuenta sus pestañas (`slotWidth(width, count)`): no asumas cinco.
- **Ref:** [ADR-0028](../adr/0028-modulos-activables-solo-en-la-interfaz.md)

### El buscador ⌘K es un chunk diferido que se pide al pintar el shell

- `CommandPalette` no viaja en el JS del arranque: `AppShell` lo monta dentro de `<Suspense>` y el navegador lo pide en cuanto
  se pinta el shell. Si pulsas ⌘K antes de que llegue, se abre al terminar de cargar. No lo importes de forma estática desde el shell.

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

- **Síntoma:** el dock se queda a medio camino, o en el navegador integrado de las herramientas de desarrollo
  las transiciones parecen congeladas (`getAnimations()` en `currentTime: 0`).
- **Causa:** si la página no se pinta (PWA en segundo plano, panel oculto), el navegador no da fotogramas,
  aunque `document.visibilityState` diga `visible`.
- **Solución:** toda animación en JS fija su estado final con un `setTimeout` de la duración (lo hace
  `Dock.tsx`). Para verificar fotograma a fotograma en un panel oculto, sustituye temporalmente
  `requestAnimationFrame` por `cb => setTimeout(() => cb(performance.now()), 16)`.

### El buscador ⌘K no usa `cmdk`

- Es un *combobox* propio (`shell/CommandPalette.tsx`) con la lógica pura en `palette-items.ts` (con tests).
  El foco se queda siempre en el campo y la opción activa va por `aria-activedescendant`: no pongas
  `tabIndex={0}` en las opciones ni muevas el foco a la lista.

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
  suprime el clic que sigue a un arrastre. No añadas `onClick` a la tarjeta.
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
  `list` y `checklist` (barra de formato de Notas). Si el shell pasa a usarlos, vuelven a `icons`.
- **Ref:** [ADR-0020](../adr/0020-tanstack-router-carga-diferida.md)

### Un chunk compartido `dist-*.js` (Radix) suma ~0,6 kB al arranque

- **Síntoma:** al añadir una pantalla, `pnpm --filter @muninn/web size` muestra un chunk nuevo `dist-…js` de ~8 kB (el
  `Primitive` de Radix) y el total sube ~0,6 kB, aunque la pantalla no cargue nada nuevo en el arranque.
- **Causa:** Rolldown saca a un chunk propio los módulos que importan varios chunks diferidos a la vez, y a veces los
  deja en el arranque envueltos en su `import`/`export`. No es código nuevo, es el envoltorio.
- **Solución:** nada que arreglar; solo no confundirlo con una dependencia nueva. Compara el nombre de los chunks
  antes y después.

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
- **Causa:** la sección Documentación solo importa `NN-nombre.md` (dos cifras, guion y minúsculas) y solo entiende cuatro
  claves planas de metadatos: `title` (obligatorio), `description`, `order` y `status` (`disponible`, `parcial`,
  `proximamente`; otro valor cuenta como disponible).
- **Solución:** el `# Título` con que empieza el texto se quita (el título sale de los metadatos). Una cita que empieza
  en negrita (`> **Estado:** …`) se pinta como aviso. Los enlaces entre guías van como `05-notas.md#archivar` (las anclas
  se comparan sin tildes: `#iniciar-sesión` e `#iniciar-sesion` son lo mismo); cualquier otro fichero relativo se ve como texto.
  Nada de HTML ni imágenes ([ADR-0026](../adr/0026-markdown-marked-a-react-y-textarea.md)).
- **Ref:** [ADR-0027](../adr/0027-documentacion-en-la-app-desde-docs-user.md)

### Los diálogos del shell se cargan al abrirse la primera vez

- «Nueva tarea» y «Nuevo proyecto» son `lazy` en `AppShell`: su código no viaja en el arranque. La primera vez que se abren
  hay una petición pequeña (el resto, ya en caché). Si añades otro diálogo global, haz lo mismo y mide con `size`.
