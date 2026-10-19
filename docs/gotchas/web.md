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

### Rutas profundas y recargas: hace falta *fallback* a `index.html`

- **Síntoma:** recargar `/proyectos/abc` da 404 en el servidor.
- **Causa:** el router usa el historial del navegador; esas rutas no existen como ficheros.
- **Solución:** el hosting de la PWA debe reescribir cualquier ruta desconocida a `index.html` (por ejemplo,
  en Vercel, un `rewrites` a `/`). `vite dev` y `vite preview` ya lo hacen. En Tauri, comprueba al recargar una ruta
  profunda con `pnpm dev:desktop` cuando toques la configuración de ventanas.

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
