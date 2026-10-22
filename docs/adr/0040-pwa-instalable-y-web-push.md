# ADR-0040: PWA publicada en Vercel y avisos Web Push desde una Edge Function con cron

- **Estado:** Propuesto
- **Fecha:** 2026-10-22
- **Área:** web, db, ci

## Contexto

La F3 quiere Muninn instalable en el iPhone con avisos push (antes de un cobro, ADR-0038; más adelante, tareas y agentes). Hoy:

- La web se compila con `vite-plugin-pwa` (`apps/web/vite.config.ts`): `registerType: 'autoUpdate'`, Workbox `generateSW` con
  precarga de la app, manifiesto `standalone` con iconos de 192 y 512 (también `maskable`), `theme_color` `#0C0D10`. Desactivado en
  Tauri. El service worker solo guarda la aplicación; los datos van por IndexedDB ([ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md)).
- **No está publicada**: solo existe en `localhost`. Sin una URL con HTTPS no hay instalación en el iPhone, ni OAuth del MCP para
  claude.ai fuera de este ordenador ([ADR-0036](0036-pantalla-de-autorizacion-oauth.md): la *Site URL* es `localhost:5174`).
- **Web Push en iOS** (16.4 o superior) solo funciona con la PWA **añadida a la pantalla de inicio**, pidiendo permiso tras un gesto
  del usuario, y con el estándar (Push API + VAPID); en Safari sin instalar no hay push.
- Muninn es de un usuario hoy y se quiere poder vender: lo que se elija debe servir para varios usuarios sin rehacerlo.

## Decisión (propuesta)

**1. Dónde se publica la web: Vercel** (proyecto estático, `apps/web`, rama `main` en producción y vistas previas por PR).
Opciones valoradas:

| Opción | A favor | En contra |
|---|---|---|
| **Vercel** (recomendada) | Despliegue por PR (vistas previas), `rewrites` para el SPA, HTTPS y dominio propio en minutos; ya tienes cuenta | Plan Hobby solo para uso no comercial: si se vende, plan Pro |
| Cloudflare Pages | Gratis también comercial, CDN muy rápida | Otra cuenta y otro panel; las vistas previas por PR van aparte |
| Supabase Storage + CDN | Todo en un sitio | No es hosting de SPA: sin *fallback* a `index.html` ni cabeceras por ruta |
| Servidor propio (Caddy) | Control total, encaja con el plan de autoalojar (ADR-0003) | Mantenerlo encendido y con HTTPS; aún no existe |

Para Vercel queda preparado `apps/web/vercel.json`: *fallback* de rutas a `index.html` ([gotchas/web](../gotchas/web.md)) y
`Cache-Control: no-cache` para `sw.js` y el manifiesto (si el navegador cachea el service worker, las versiones nuevas tardan en llegar).

**2. Service worker:** se mantiene `generateSW` (Workbox) y se le añade **`push-sw.js`** con `importScripts` (`workbox.importScripts`):
solo escucha `push` (enseña la notificación con título, texto y enlace) y `notificationclick` (abre o enfoca la app en ese enlace).
No cambia la caché ni nada más; pasar a `injectManifest` solo haría falta si el SW necesitara lógica propia de datos.

**3. Suscripción a push (pendiente de implementar):**
- Tabla `push_subscriptions` (`owner_id` + RLS): `endpoint` (único), `p256dh`, `auth`, `user_agent`, `created_at`, `last_seen_at`. Una fila
  por dispositivo. Migración aditiva cuando se implemente.
- En **Ajustes › Notificaciones**: un botón «Activar avisos en este dispositivo» (el permiso **solo** se pide con un gesto). En iOS, si la
  app no está instalada, explica cómo añadirla a la pantalla de inicio en lugar del botón. Al aceptar, `pushManager.subscribe` con la
  clave pública VAPID (`VITE_VAPID_PUBLIC_KEY`, pública por definición) y se guarda vía el core (`m.push.subscribe`).

**4. Quién envía los avisos: una Edge Function `push` con `pg_cron`**, como la sincronización de GitHub (ADR-0031):
- Cada mañana (p. ej. `0 7 * * *` UTC ≈ 8–9 h en Madrid) recorre, por usuario, `m.finance.subscriptions.upcoming()` y manda un aviso por
  cobro que entra hoy en su ventana («Mañana te cobran Vercel Pro · 20,00 €»), con enlace a `/finanzas?vista=suscripciones`.
- Firma con **VAPID** (claves en los secretos de la función: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), con una
  librería de Web Push compatible con Deno. Las suscripciones que respondan `404`/`410` se borran (ya no existen en el navegador).
- No repite avisos: guarda qué se avisó (`push_log`: usuario, clave del aviso, fecha) o deriva la clave de la suscripción + `next_date`.
- Usa la service role con un `owner_id` explícito por usuario (gotchas/db), nunca la sesión de nadie.

## Alternativas consideradas

- **Avisos locales sin servidor** (`setTimeout` o *Notification Triggers*): iOS no despierta una PWA cerrada; solo avisaría con la app abierta,
  que ya hace «Próximos cobros».
- **Servicio de terceros (OneSignal, Firebase Cloud Messaging):** más SDK en el arranque y datos de uso fuera; Web Push estándar con VAPID basta.
- **Un cron en Vercel en lugar de Supabase:** separaría el envío de los datos y de los secretos de las demás funciones.

## Consecuencias

- Publicar desbloquea también el MCP con OAuth desde claude.ai y el iPhone: hay que cambiar *Site URL* y *Redirect URLs* de Supabase.
- El plan Hobby de Vercel no permite uso comercial: al vender Muninn, plan Pro o cambiar de hosting (el build es estático; mover es fácil).
- Los avisos dependen de que el cron corra en Supabase (plan gratuito: los proyectos inactivos se pausan, ADR-0003).
- Pasos manuales exactos: [gotchas/web](../gotchas/web.md) › «Publicar la PWA y activar Web Push (pasos manuales)».
- Relacionado: [ADR-0008](0008-tauri-escritorio-pwa-movil.md), [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md),
  [ADR-0038](0038-suscripciones-avisan-y-se-confirman.md).
