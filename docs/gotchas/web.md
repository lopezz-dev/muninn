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
- **Causa:** el core (y zod con él) se carga en diferido en el loader de la ruta raíz (`loadMuninn()`).
  Un `import { algo } from '@muninn/core'` de valor en cualquier fichero del shell lo mete en el arranque.
- **Solución:** en la UI, `import type { … } from '@muninn/core'` y los datos siempre con `useMuninn()`.
  Lo mismo con `@supabase/supabase-js`: solo a través de `loadSupabase()`.
- **Ref:** [ADR-0020](../adr/0020-tanstack-router-carga-diferida.md)

### `useMuninn()` solo funciona dentro del router

- Lee los datos del loader de la ruta raíz. Fuera de `<RouterProvider>` (por ejemplo, junto a `<Toaster />`
  en `main.tsx`) lanza un error. Todo lo que use datos va dentro del shell o de una pantalla.

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
