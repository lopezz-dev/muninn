# ADR-0033: MCP remoto por Streamable HTTP, sin estado, con el token de Supabase del usuario y alojado en una Edge Function

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** mcp
- **Complementa a:** [ADR-0009](0009-mcp-stdio-sin-borrados.md) (stdio sigue igual)

## Contexto

El MCP por stdio ([ADR-0009](0009-mcp-stdio-sin-borrados.md)) solo sirve en el ordenador donde se lanza, y con la *service role key*
en la configuración del cliente. Para usar Muninn desde el móvil o desde claude.ai hace falta un servidor remoto: accesible por HTTPS,
autenticado como el usuario (no con una llave maestra) y con las mismas herramientas, sin borrados definitivos.

## Decisión

- **Transporte:** *Streamable HTTP* del SDK oficial (`WebStandardStreamableHTTPServerTransport`), en `packages/mcp/src/http.ts` como un
  manejador `Request → Response` de la API web estándar. El mismo código corre en Node (`muninn-mcp --http`, o `MUNINN_MCP_HTTP=1`: el
  flag que lo activa) y en Deno. stdio sigue siendo lo de por defecto.
- **Sin estado:** cada petición crea su servidor MCP y su transporte, con respuestas JSON (`enableJsonResponse`). No hay sesiones que guardar
  entre instancias ni flujo SSE por GET (GET y DELETE responden 405). Las herramientas solo piden y devuelven; no necesitan notificaciones.
- **Autenticación:** `Authorization: Bearer <token de acceso de Supabase del usuario>`. Se valida con Supabase Auth (`auth.getUser`) y el core
  se crea con un cliente que lleva **ese mismo token y la clave pública**, así que **RLS** sigue filtrando por dueño
  ([ADR-0004](0004-multiusuario-con-rls.md)). El MCP remoto **nunca** usa la service role. Actor `mcp` en la actividad.
- **OAuth para claude.ai y el móvil:** sin token, la respuesta es 401 con `WWW-Authenticate: Bearer resource_metadata="…"`, y el recurso publica
  sus metadatos (RFC 9728) en `…/mcp/.well-known/oauth-protected-resource`, con **Supabase Auth** (`https://<ref>.supabase.co/auth/v1`) como
  servidor de autorización. Así, un cliente que hable OAuth (claude.ai, Claude en el móvil) inicia sesión con tu cuenta de Muninn y obtiene el
  token él solo. Requiere activar Supabase Auth como servidor OAuth 2.1 en el panel: es un paso manual y está **sin verificar** (ver gotchas/mcp).
- **Sin borrados definitivos**, como en stdio: son las mismas herramientas (`createMuninnMcpServer`).
- **Origin:** una petición con `Origin` (un navegador) solo se acepta si está en la lista (`MUNINN_MCP_ALLOWED_ORIGINS`), con CORS para ella;
  así se evita el *DNS rebinding* que menciona la especificación. Los clientes de escritorio no mandan `Origin`.
- **Alojamiento:** una Edge Function de Supabase, `mcp` (`supabase/functions/mcp`), en el mismo proyecto y región (París) que los datos, con el
  paquete empaquetado por `pnpm --filter @muninn/mcp build:edge`. Se despliega con `--no-verify-jwt`: el 401 con metadatos y el GET de los
  metadatos deben responder sin JWT; la validación la hace la función.

## Alternativas consideradas

- **Servidor Node propio (Vercel, VPS):** otro proveedor, otra región y otra factura para algo que la Edge Function ya resuelve. El modo
  `--http` de Node queda para probar en local o para un servidor propio (Backlog).
- **Con sesiones (SSE con estado):** pide afinidad de instancia o un almacén de eventos compartido, y ninguna herramienta lo necesita.
- **Service role + `MUNINN_USER_ID`, como stdio:** una llave maestra en un servicio público; un fallo de autenticación expondría a todos los usuarios.
- **Tokens personales de Muninn** (una tabla con tokens con hash, creados desde Ajustes): útiles para clientes sin OAuth y sin caducidad de 1 h,
  pero piden migración, interfaz y revocación. Si OAuth con Supabase no encaja, es el plan B y pedirá su ADR.
- **Proteger con un secreto compartido:** no identifica al usuario; RLS no podría actuar.

## Consecuencias

- Desde Claude Code ya se puede usar con una cabecera (`--header "Authorization: Bearer <token>"`), pero el token de Supabase caduca a la hora:
  para el día a día hace falta OAuth (o el plan B).
- Cada petición valida el token contra Supabase Auth (una llamada de red): con un usuario es poco; con muchos, se podría validar el JWT en local
  con las claves públicas del proyecto.
- El MCP remoto ve los mismos datos y herramientas que stdio. Los módulos desactivados tampoco lo filtran ([ADR-0028](0028-modulos-activables-solo-en-la-interfaz.md)).
- Relacionado: [gotchas/mcp](../gotchas/mcp.md), `packages/mcp/src/http.ts`, `packages/mcp/src/supabase-auth.ts`, `supabase/functions/mcp/index.ts`.
