# ADR-0036: La autorización OAuth del MCP remoto la aprueba una pantalla propia de la web, `/oauth/consent`

- **Estado:** Aceptado
- **Fecha:** 2026-10-21
- **Área:** web, mcp
- **Complementa a:** [ADR-0033](0033-mcp-remoto-http.md)

## Contexto

[ADR-0033](0033-mcp-remoto-http.md) deja a **Supabase Auth** como servidor de autorización del MCP remoto, para que claude.ai y Claude en el
móvil inicien sesión con tu cuenta de Muninn. Al poner la función `mcp` en marcha (21 de octubre) se vio que el servidor OAuth 2.1 de Supabase
**no trae pantalla de consentimiento**: redirige a una página de la app (*Site URL* + *Authorization Path*) con `?authorization_id=…`, y esa
página tiene que enseñar quién pide acceso y llamar a `approveAuthorization` o `denyAuthorization` con la sesión del usuario. Sin ella, OAuth no
funciona. Además, la web aún no está publicada: la *Site URL* es `localhost`.

## Decisión

- **Ruta `/oauth/consent`** en la web (`apps/web/src/screens/OAuthConsent.tsx`), hija de la raíz: fuera del shell y sin cargar el core, en su
  propio chunk. Necesita una cuenta de verdad: sin sesión o en modo demo, manda a `/login?redirect=…` y vuelve con el mismo `authorization_id`.
- **Llama a Supabase Auth desde `lib/oauth-consent.ts`**, con el cliente de `auth.ts`, como el login ([ADR-0022](0022-auth-y-sesion.md)): es
  autenticación, no datos, así que no pasa por `createMuninn`.
- **Enseña** el nombre de la app, la cuenta con la que entras, qué podrá hacer (ver y cambiar proyectos, tareas y notas por el MCP; nunca borrar),
  a qué web vuelves y los *scopes* pedidos en palabras. Dos botones, «Permitir acceso» y «Rechazar», con `notify`; sin «Deshacer», porque la
  decisión se la queda la otra app. Si ya diste permiso antes, Supabase devuelve directamente la dirección y se vuelve sin preguntar.
- **Configuración en Supabase** (manual, en el panel; pasos en [gotchas/mcp](../gotchas/mcp.md)): servidor OAuth 2.1 activado, *Authorization
  Path* `/oauth/consent` y **registro dinámico de clientes** activado, que es como se dan de alta claude.ai y los demás clientes MCP.
- **Mientras la web no esté publicada**, la *Site URL* es la del servidor de desarrollo: la autorización solo funciona en el ordenador donde
  corre `pnpm dev`. claude.ai en el navegador de ese ordenador sirve; el iPhone necesita la PWA publicada (F3).

## Alternativas consideradas

- **Aprobar sin preguntar** (una página que llama a `approveAuthorization` nada más cargar): con registro dinámico, cualquier app que se registre
  tendría acceso a tus datos con un clic en un enlace. La pantalla es la única barrera que ve el usuario.
- **Pantalla en la Edge Function `mcp`** (HTML servido por la función): no tiene la sesión del usuario, que vive en la web, y duplicaría el login.
- **Tokens personales de Muninn** (plan B de ADR-0033): siguen siendo la salida si un cliente no habla OAuth, pero piden tabla, interfaz y
  revocación. OAuth con Supabase cubre claude.ai sin nada de eso.
- **Registrar a mano el cliente de claude.ai** en lugar de registro dinámico: claude.ai espera registrarse solo, y cada cliente nuevo (Claude
  Code, el móvil) pediría otro alta manual.

## Consecuencias

- El registro dinámico deja que cualquier app se registre: la protección es que nada entra sin pasar por esta pantalla con tu sesión. Conviene
  revisar de vez en cuando los clientes registrados en el panel (Authentication › OAuth Apps).
- Todavía **no se pueden ver ni quitar** los permisos dados desde Muninn (la API `oauth` de supabase-js lo permite): va al Backlog, en
  Ajustes › Cuenta. La pantalla lo dice.
- Los tokens que emite el servidor OAuth llevan `client_id`; RLS los trata igual que una sesión de la app.
- Supabase recomienda claves de firma asimétricas (RS256/ES256) para OAuth, y son obligatorias si un cliente pide el *scope* `openid`.
- Relacionado: [gotchas/mcp](../gotchas/mcp.md), `apps/web/src/lib/oauth-consent.ts`, `apps/web/src/router.tsx`.
