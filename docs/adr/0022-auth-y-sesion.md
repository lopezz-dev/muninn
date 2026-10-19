# ADR-0022: Auth y gestión de sesión: código por correo y GitHub con Supabase Auth

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web, db, core

## Contexto

Hasta ahora la app funcionaba solo en modo demo (datos en memoria). Para guardar los datos en Supabase con
RLS ([ADR-0004](0004-multiusuario-con-rls.md)) hace falta saber quién es el usuario. Condiciones:

- La misma UI corre en la **PWA** (iPhone instalado en la pantalla de inicio) y en **Tauri** (escritorio).
  En iOS, la PWA instalada no comparte almacenamiento con Safari, y en Tauri un enlace del correo abre el
  navegador del sistema, no la app.
- supabase-js pesa 214 kB (54 kB gzip): no puede entrar en el arranque ([ADR-0020](0020-tanstack-router-carga-diferida.md)).
- Se quiere poder vender: el registro debe funcionar sin intervención, y los datos de un usuario no
  pueden verse nunca en la sesión de otro, tampoco en las cachés del cliente.
- Se mantiene un modo demo sin cuenta para probar la app.

## Decisión

- **Supabase Auth** con dos métodos, sin contraseñas:
  - **Código de un solo uso por correo** (`signInWithOtp` + `verifyOtp({ type: 'email' })`). Funciona igual
    en la PWA y en Tauri porque no hay redirección: el usuario teclea el código en la app. La plantilla de
    correo (`supabase/templates/`: `acceso.html` y `registro.html`, con la marca y los colores de la app) envía
    **solo el código**, sin enlace mágico.
  - **GitHub OAuth** (PKCE). Vuelve a `/login?redirect=…&code=…` y supabase-js canjea el código al crear el
    cliente. **Oculto en Tauri** hasta que haya deep links. El botón solo aparece si el proveedor está
    activado en el proyecto (`GET /auth/v1/settings`), para no ofrecer algo que falla.
  - El registro está abierto (`shouldCreateUser: true`): el primer código crea la cuenta. Cerrarlo es un
    interruptor del panel de Supabase («Allow new users to sign up»).
- **Sesión en localStorage** con clave fija `muninn.auth` (no la de por defecto, `sb-<ref>-auth-token`). Así se
  sabe **sin descargar supabase-js** si hay una sesión guardada: sin sesión ni vuelta de GitHub, el login se
  pinta sin pedir ese chunk (el login lo precarga mientras escribes el correo).
- **Rutas** (TanStack Router):
  - La ruta raíz resuelve el estado en `beforeLoad` (`getAuth()`, memorizado): `user`, `demo` o `anonymous`.
    Se pone en el contexto del router.
  - `/login` es pública. Con sesión, redirige al destino (`?redirect=`, solo rutas internas: `safeRedirect`).
  - Todo lo demás cuelga de una ruta de layout `_app` que, sin sesión ni demo, redirige a `/login` con el
    destino. Su `loader` crea el servicio: con sesión,
    `createMuninn(createSupabaseStore(supabase, user.id))`; en demo, `createMemoryStore()`.
- **Cambio de usuario** (iniciar o cerrar sesión, aquí o en otra pestaña): se descarta la instancia del
  core, se vacía la caché de react-query (`queryClient.clear()`) y se invalida el router. Solo cuenta si
  cambia el id del usuario: refrescar el token o volver a la pestaña no recarga nada.
- **Cerrar sesión** con `signOut({ scope: 'local' })`: solo este dispositivo. No lleva «Deshacer», porque no
  cambia ni borra datos ([ADR-0019](0019-feedback-con-notificaciones.md)); sí un aviso. Está en
  Ajustes › Cuenta y en el buscador ⌘K. El pie de la barra lateral muestra nombre y avatar, y lleva a Cuenta.
- **Modo demo** se mantiene, en memoria, con una marca en localStorage (`muninn.demo`) para que recargar no
  te devuelva al login. Se entra desde el login y se sale desde Ajustes › Cuenta o ⌘K.
- **Apariencia en `user_settings.preferences.appearance`** (nuevo `settings` en el core y en los stores).
  localStorage sigue como caché para aplicarla antes del primer render. Al entrar, la de la cuenta gana; si
  la cuenta no tiene, se sube la del dispositivo. Cada cambio se guarda en los dos sitios.

Medido con `pnpm --filter @muninn/web size`: el JS inicial pasa de 619,0 kB (187,6 kB gzip) a 624,6 kB
(189,5 kB gzip). Son la sesión, el router y el pie de la barra lateral; las acciones del formulario
(`login-actions.ts`) van en el chunk del login. supabase-js (214 kB) y el core (114 kB) siguen en diferido.

## Alternativas consideradas

- **Enlace mágico:** es lo que dice el diseño, pero en la PWA de iPhone iniciaría la sesión en Safari y no
  en la app instalada, y en Tauri abriría el navegador. Necesitaría deep links y un *universal link*.
- **Contraseñas:** más fricción y más superficie (recuperación, fugas). El código cubre el mismo caso.
- **`getUser()` en cada navegación:** valida el token contra el servidor, pero añade una petición por
  pantalla. La autorización real la hace RLS en el servidor; para decidir qué pantalla pintar basta la
  sesión local (`getSession()`).
- **Un `AuthProvider` de React con el estado:** duplicaría lo que el router ya resuelve antes de pintar
  (redirecciones sin parpadeo, `beforeLoad` tipado).
- **`@supabase/ssr` y cookies:** no hay servidor; la app es una SPA.
- **Modo local persistente (IndexedDB)** en lugar de la demo en memoria: más fiel al texto «Modo local» del
  diseño, pero es otro store entero. Queda para más adelante.

## Consecuencias

- Hay que configurar el proyecto de Supabase a mano: plantillas de correo con el código, Site URL y
  Redirect URLs, y el proveedor GitHub: ver [gotchas/db](../gotchas/db.md).
- El SMTP de serie de Supabase solo envía a los miembros del equipo, tiene un límite bajo por hora y no deja
  guardar plantillas: los correos salen por un SMTP propio (Resend), con remitente provisional
  `no-reply@shion.es` hasta tener el dominio de Muninn.
- Las claves de acceso (passkeys), el segundo factor y la gestión de sesiones quedan en el ROADMAP
  («Acceso y seguridad»); cuando lleguen, un ADR nuevo actualizará este.
- `useMuninn()` lee el loader de `/_app` y los `getRouteApi` llevan ese prefijo (`/_app/asistente`): ver
  [gotchas/web](../gotchas/web.md).
- En escritorio no hay GitHub hasta que existan deep links (backlog).
- Reemplaza la nota de [ADR-0021](0021-shell-de-la-app.md) de que la apariencia vive solo en localStorage.
- Relacionado: `apps/web/src/lib/auth.ts`, `lib/login-actions.ts`, `lib/session.ts`, `lib/muninn.ts`,
  `src/router.tsx`, `screens/Login.tsx`, `packages/core/src/service.ts` (`settings`).
