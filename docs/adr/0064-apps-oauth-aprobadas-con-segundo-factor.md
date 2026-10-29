# ADR-0064: Una app OAuth aprobada con el segundo factor cuenta como `aal2`, y el servidor lo comprueba

- **Estado:** Aceptado (29 de octubre de 2026; implementado en `20261029200000_oauth_mfa_grants`)
- **Fecha:** 2026-10-29
- **Área:** db, core, web, mcp
- **Complementa a:** [ADR-0062](0062-aal2-para-integraciones-sensibles.md), [ADR-0036](0036-pantalla-de-autorizacion-oauth.md)

## Contexto

[ADR-0062](0062-aal2-para-integraciones-sensibles.md) hace que, con el segundo factor activado, el servidor solo enseñe datos a sesiones
`aal2`. En la fase final (paso 4d, 29 de octubre) se comprobó lo que ese ADR dejaba abierto:

- Los tokens que emite el servidor OAuth de Supabase al MCP remoto (claude.ai, Claude Code) son **`aal1`**, también al reconectar
  después de activar el segundo factor. Con el factor activado, claude.ai ve el tablero vacío («Proyecto … no existe»).
- Los conectores de claude.ai se autentican por OAuth. Un token personal en una cabecera (plan B de [ADR-0033](0033-mcp-remoto-http.md))
  no le serviría.
- El proyecto firma los JWT con **ES256**. La clave privada no sale de Supabase, así que una Edge Function no puede emitir un JWT `aal2`
  propio que PostgREST acepte.
- La pantalla de autorización (`/oauth/consent`, [ADR-0036](0036-pantalla-de-autorizacion-oauth.md)) corre con la sesión del usuario en
  la web, y el login ya pide el código de la app antes de llegar a ella ([ADR-0061](0061-seguridad-de-la-cuenta.md)).
- `auth.sessions.oauth_client_id` dice qué app OAuth abrió cada sesión.

## Decisión

1. **Tabla `public.oauth_mfa_grants`** (`owner_id`, `client_id` → `auth.oauth_clients`, `approved_at`; clave `(owner_id, client_id)`), con
   RLS de dueño y `require_mfa`. Guarda «esta app la aprobé con el segundo factor». No se escribe directamente: solo con la función de abajo.
2. **`public.approve_oauth_client_mfa(client_id uuid)`**, `security definer`, `search_path = ''`, `execute` solo para `authenticated`.
   Hace el `upsert` si el JWT de quien llama es **`aal2`** y el cliente existe; si no, no hace nada (sin factor no hace falta). La llama
   `/oauth/consent` al pulsar «Permitir acceso», antes de aprobar la autorización, a través del core (`m.account.apps`).
3. **`mfa_satisfied()`** pasa a ser verdadera también cuando la sesión del JWT (`session_id`) es de una app OAuth (`oauth_client_id`) que
   tiene fila en `oauth_mfa_grants` para ese usuario. Se evalúa al final, solo con factor activado y `aal1`, así que lo de siempre no paga
   la consulta.
4. **Las funciones de sesiones** (`list_my_sessions`, `revoke_my_session`) y el *trigger* de GitHub siguen exigiendo `aal2` de verdad: una
   app OAuth no ve ni cierra sesiones ni vincula repos, aunque esté aprobada. Para ellas, una comprobación aparte sin la excepción.
5. **Quitar el acceso** en Apps con acceso (`m.account.apps.revoke`) borra también la fila: la app deja de ver datos al momento, no al
   caducar su token. Al desactivar el segundo factor no se borra nada (sin factor, todo pasa igual).

## Alternativas consideradas

- **Tokens personales de Muninn (plan B de ADR-0033):** no sirven para claude.ai, que solo habla OAuth, y emitir un JWT `aal2` propio no
  es posible con ES256; habría que mantener una sesión real por token. Queda en el Backlog para clientes sin OAuth.
- **Aceptar cualquier token OAuth `aal1`:** lo más corto, pero el servidor no sabría si la app se aprobó con el segundo factor. Con el
  código del correo bastaría para conectar una app y leerlo todo.
- **No hacer nada** y decir que con el segundo factor el MCP remoto no funciona: deja a claude.ai fuera justo a quien más protege su cuenta.

## Consecuencias

- Positivas: con el segundo factor activado, claude.ai sigue viendo los datos si se conectó (o reconecta) después de activarlo, y el
  servidor puede demostrar que esa aprobación pasó por el código. El código del correo solo sigue sin bastar.
- Costes: una tabla y una función más; una consulta a `auth.sessions` por sentencia en el caso OAuth con factor. Una app conectada **antes**
  de activar el segundo factor no tiene fila: hay que reconectarla una vez (la guía lo dice).
- Depende de que `/oauth/consent` pida el código de la app, que hoy solo está en `develop`: se prueba cuando `develop` pase a `main`.
- Si Supabase empieza a emitir tokens OAuth con el `aal` de la sesión que aprobó, este ADR sobra: se reemplaza y se borra la tabla.
- Relacionado: [ADR-0062](0062-aal2-para-integraciones-sensibles.md), [ADR-0036](0036-pantalla-de-autorizacion-oauth.md),
  [gotchas/db](../gotchas/db.md) («Con el segundo factor activado, el MCP remoto no ve nada»), `apps/web/src/lib/oauth-consent.ts`,
  `apps/web/src/screens/OAuthConsent.tsx`, `packages/core/src/account.ts`.
