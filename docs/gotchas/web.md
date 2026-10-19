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
