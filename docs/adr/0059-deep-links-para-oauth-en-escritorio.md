# ADR-0059: GitHub OAuth en escritorio con el deep link `muninn://auth/callback`

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** desktop, web
- **Reemplaza a:** la parte de [ADR-0022](0022-auth-y-sesion.md) que ocultaba GitHub en Tauri

## Contexto

[ADR-0022](0022-auth-y-sesion.md) ofrece GitHub OAuth con PKCE: Supabase redirige de vuelta a `/login?code=…` y supabase-js
canjea el código. En la app de escritorio eso no sirve:

- La página de GitHub no debe abrirse dentro del webview (no hay barra de direcciones ni gestor de contraseñas, y GitHub
  desaconseja autorizar dentro de una app). Se abre en el navegador del sistema con `tauri-plugin-opener`.
- Al terminar, el navegador del sistema no puede volver a `tauri://localhost` o `http://tauri.localhost`: esa dirección solo existe
  dentro de la app. La vuelta tiene que ser algo que el sistema sepa entregar a la app.
- En Windows y Linux, abrir un enlace de un esquema propio lanza **otro proceso** de la app con la URL como argumento.

Por eso el botón de GitHub estaba oculto en escritorio.

## Decisión

- **Esquema propio `muninn://`** con `tauri-plugin-deep-link` (`plugins.deep-link.desktop.schemes` en `tauri.conf.json`). El
  instalador lo registra: NSIS en Windows (registro de usuario), el `Info.plist` en macOS y el `.desktop` en Linux. En `tauri dev`
  se registra al arrancar (`register_all`, solo en debug, Windows y Linux).
- **`tauri-plugin-single-instance`** con la *feature* `deep-link`, registrado el primero: el segundo proceso le pasa la URL a la
  ventana abierta, que se trae al frente, y se cierra.
- **Flujo en la web** (`login-actions.ts`, `oauth-callback.ts`):
  1. `signInWithOAuth({ provider: 'github', options: { redirectTo: 'muninn://auth/callback', skipBrowserRedirect: true } })`:
     supabase-js guarda el verificador PKCE y devuelve la URL sin navegar.
  2. Se empieza a escuchar `onOpenUrl` **antes** de abrir el navegador, y se abre la URL con `openExternal`.
  3. Al llegar `muninn://auth/callback?code=…` se llama a `exchangeCodeForSession(code)`. Si llegan tokens en el fragmento (flujo
     implícito), `setSession`. `error=access_denied` es «cancelado»; otros `error`, un fallo con su `error_description`.
  4. Se puede cancelar desde la pantalla, y a los cinco minutos sin volver se da por abandonado.
  5. Si la app estaba cerrada al volver, arranca con el enlace: el login lo recoge con `getCurrent()` una vez por sesión.
- La lógica sin Supabase (opciones según la plataforma, análisis del enlace, espera cancelable) va en `oauth-callback.ts`, con tests.
  Las llamadas a Supabase Auth siguen en `login-actions.ts`, junto a las demás del login (ADR-0022): el cliente de auth vive en la web,
  no en el store del core, que solo recibe la sesión ya hecha.

## Alternativas consideradas

- **Servidor HTTP en `localhost` (loopback)** con `tauri-plugin-oauth`: no necesita registrar nada en el sistema, pero el puerto cambia
  y Supabase exige cada `Redirect URL` exacta o con comodín de puerto, abre un puerto en el equipo y añade otro plugin. El deep link
  también servirá para otras cosas (abrir una tarea desde un correo).
- **Abrir GitHub en una ventana del propio webview** e interceptar la navegación de vuelta: GitHub y Google lo desaconsejan (el usuario
  no puede comprobar la dirección) y no tendría la sesión de GitHub del navegador.
- **Seguir sin GitHub en escritorio:** el código por correo funciona, pero el botón desaparecía sin explicación.

## Consecuencias

- Hay que añadir `muninn://auth/callback` a las *Redirect URLs* de Supabase (paso manual, en [fase final](../fase-final.md)).
- Cualquier programa puede abrir `muninn://auth/callback?code=…`, pero sin el verificador PKCE que guardó esta app el código no
  sirve: el canje falla. Por eso solo se acepta PKCE como flujo principal.
- macOS solo registra el esquema con la app instalada en `/Applications` (o lanzada una vez desde el `.app`); en `tauri dev` no hay
  deep links en macOS. Ver [gotchas/desktop](../gotchas/desktop.md).
- Relacionado: `apps/desktop/src-tauri/src/lib.rs`, `capabilities/default.json`, `apps/web/src/lib/oauth-callback.ts`,
  `apps/web/src/lib/github-desktop-login.ts`.
