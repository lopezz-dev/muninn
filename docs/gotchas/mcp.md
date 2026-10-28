# Gotchas · mcp (`packages/mcp`)

### stdout es el canal del protocolo

- **Síntoma:** el cliente MCP se desconecta o muestra un error de JSON inválido.
- **Causa:** un `console.log` escribe en stdout y corrompe el JSON-RPC.
- **Solución:** los logs siempre van por `console.error`.

### Recompilar el MCP tras cambiar el core

- **Síntoma:** Claude no ve una herramienta o un cambio de comportamiento recién hecho.
- **Causa:** los clientes ejecutan `dist/index.js`, que lleva el core empaquetado dentro.
- **Solución:** `pnpm --filter @muninn/mcp build` y reinicia el cliente (en Claude Desktop, cierra la app del todo).
- **Ref:** [ADR-0012](../adr/0012-paquetes-internos-como-fuente.md)

### Las peticiones se procesan en paralelo

- **Síntoma:** al enviar varias llamadas seguidas, una falla porque "el proyecto no existe" aunque se creó justo antes.
- **Causa:** el servidor atiende las peticiones a la vez. Si se envían sin esperar la respuesta anterior (llamadas
  paralelas del modelo, o probar con `printf … | node`), no hay orden garantizado.
- **Solución:** para pruebas manuales, una llamada por proceso o un cliente que espere cada respuesta.
  Las operaciones dependientes deben ir en secuencia.

### La service role key se salta RLS

- **Síntoma:** ninguno, y ese es el riesgo: con un `MUNINN_USER_ID` equivocado se lee o escribe en otro usuario.
- **Solución:** guárdala solo en la configuración local del cliente MCP y nunca en el repo. Cuando haya
  MCP remoto (F2), se usará OAuth con la sesión del usuario en lugar de la service key.

### Nombres de proyecto ambiguos

- **Síntoma:** `create_task` con `project: "app"` cae en un proyecto inesperado.
- **Causa:** la resolución por nombre busca primero la coincidencia exacta y después la primera que *contiene* el texto.
- **Solución:** para operaciones importantes, que el modelo use el id que devuelven `list_projects` u `overview`.

### Herramientas nuevas: reutiliza los esquemas del core

- Los `inputSchema` del MCP son formas zod. Reutiliza los enums del core (`taskPriority`, `columnKind`…)
  para no duplicar valores válidos, y deja que el servicio haga la validación completa.

### MCP remoto: sin estado y solo POST

- **Síntoma:** un cliente que abre un flujo con `GET /mcp` recibe 405, o no llegan notificaciones del servidor.
- **Causa:** es intencionado ([ADR-0033](../adr/0033-mcp-remoto-http.md)): cada petición crea su servidor y su transporte y responde JSON. No hay
  sesión ni SSE.
- **Solución:** nada para las herramientas actuales. Si alguna necesitara progreso o notificaciones, haría falta el modo con sesiones y un
  almacén de eventos compartido (otro ADR).

### MCP remoto: el token es el del usuario, nunca la service role

- **Síntoma:** con el MCP remoto «no hay proyectos», o un `insert` falla con *row-level security*.
- **Causa:** `supabaseAuthenticator` crea el core con la clave pública y el token de la petición: RLS manda. Un token de otra cuenta ve sus datos,
  no los tuyos; un token caducado (los de Supabase duran 1 h) da 401.
- **Solución:** comprueba con qué cuenta se sacó el token. No cambies a la service role para «arreglarlo».

### La Edge Function `mcp` lleva el MCP empaquetado

- **Síntoma:** una herramienta nueva o un cambio del core no aparece en el MCP remoto.
- **Causa:** como el binario de stdio, la función usa una copia (`supabase/functions/mcp/_mcp/mcp.js`, fuera de git).
- **Solución:** `pnpm --filter @muninn/mcp build:edge` y vuelve a desplegar. El paquete no debe importar `node:*` en lo que usa `http.ts`
  (el modo `--http` de Node está en `index.ts`, que no entra en el paquete).

### MCP remoto (pasos manuales)

- **Síntoma:** no hay URL a la que conectar el móvil o claude.ai, o claude.ai no consigue iniciar sesión.
- **Causa:** la función hay que desplegarla y, para claude.ai y el móvil, activar el servidor OAuth de Supabase y apuntarlo a la pantalla
  `/oauth/consent` de la web ([ADR-0036](../adr/0036-pantalla-de-autorizacion-oauth.md)); no se puede hacer desde el código.
- **Solución:**
  1. **Desplegar** (hecho el 21 de octubre): `pnpm --filter @muninn/mcp build:edge` y, con la CLI (`npx supabase@2 login` una vez),
     `npx supabase@2 functions deploy mcp --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt --use-api`. No uses `deploy_edge_function`
     del MCP de Supabase: el paquete pesa 1,4 MB y no cabe en la llamada. La URL queda en
     `https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp`. Secretos opcionales: `MUNINN_TIME_ZONE` (por defecto `Europe/Madrid`) y
     `MUNINN_MCP_ALLOWED_ORIGINS` (orígenes de navegador, separados por comas; vacío = ninguno).
  2. **Comprobar** sin token (pasa desde el 21 de octubre): `curl -i -X POST …/functions/v1/mcp` da 401 con
     `www-authenticate: Bearer resource_metadata="…"`; `curl …/functions/v1/mcp/.well-known/oauth-protected-resource` devuelve los metadatos;
     GET da 405, un token inventado 401 y un `Origin` de navegador no permitido 403.
  3. **Claude Code con un token (prueba rápida, caduca a la hora):** saca tu token de acceso (en la app, DevTools › Application › Local Storage ›
     clave `muninn.auth`, campo `access_token`) y
     `claude mcp add --transport http muninn-remoto https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp --header "Authorization: Bearer <token>"`.
     Pruébalo con `claude -p "¿Cómo voy hoy en Muninn?" --allowedTools "mcp__muninn-remoto__*"` y quítalo con `claude mcp remove muninn-remoto`.
     No lo guardes en ningún fichero del repo.
  4. **Servidor OAuth (claude.ai y el móvil):** en Supabase › **Authentication › OAuth Server**, actívalo, pon **Authorization Path**
     `/oauth/consent` y activa **Dynamic client registration**. La pantalla queda en *Site URL* + ese camino: mientras la web no esté
     publicada, la *Site URL* (Authentication › URL Configuration) tiene que ser la del servidor de desarrollo (`http://localhost:5174`), y
     solo funciona en ese ordenador. Recomendado: claves de firma asimétricas (Settings › JWT Keys), obligatorias si un cliente pide `openid`.
     Comprueba: `curl https://yjzzubpxikpvukymgfkt.supabase.co/.well-known/oauth-authorization-server/auth/v1` da 200 (antes, 404).
  5. **claude.ai:** Ajustes › Conectores › **Añadir conector personalizado** con la URL del paso 1. Debería abrir `/oauth/consent` en tu Muninn
     (o el login, si no tienes sesión), y al pulsar «Permitir acceso» volver a claude.ai con el conector listo. **Sin verificar**: si el cliente
     no encuentra el servidor de autorización o no se puede registrar, el plan B son tokens personales de Muninn (ADR-0033, alternativas).
- **Ref:** [ADR-0033](../adr/0033-mcp-remoto-http.md), [ADR-0036](../adr/0036-pantalla-de-autorizacion-oauth.md)

### Finanzas: importes en euros, cuentas y categorías por nombre

- Las herramientas de Finanzas (`finance-tools.ts`) aceptan los importes en **euros** (`24.9`, `"24,90"`) y devuelven céntimos (`amount`,
  `balance`) y el texto (`amountText`, `balanceText`): así el modelo no multiplica por cien ni lee mal los céntimos.
- `account` y `category` admiten id o nombre (exacto y, si no, el primero que lo contiene); sin `account`, un gasto o ingreso va a la
  primera cuenta corriente. `update_transaction` con `category: null` la quita.
- No hay borrados: `archive_transaction` y `archive_finance_account`. Tras cambiar el core, `pnpm --filter @muninn/mcp build` y `build:edge`.
- Suscripciones: `list_subscriptions` (con `upcomingDays`, las que hay que avisar), `create_subscription`, `record_subscription_charge`,
  `skip_subscription_charge` y `archive_subscription`. Muninn no apunta cobros solo (ADR-0038): el modelo los apunta cuando se lo pides.
- Panel: `finance_month_report` devuelve el mismo informe que Finanzas › Resumen (ADR-0039), con céntimos y `text` ya formateado.

### Las herramientas viven en `@muninn/assistant/tools`, no en el MCP

- **Síntoma:** cambias una descripción en `packages/mcp/src/server.ts` y no la encuentras, o el asistente de la app y Claude ven
  herramientas distintas.
- **Causa:** desde la F4 hay un **catálogo único** (`packages/assistant/src/tools`, [ADR-0041](../adr/0041-asistente-local-con-catalogo-unico.md)):
  `server.ts` solo registra cada herramienta en el SDK. El asistente de la app usa el mismo catálogo.
- **Solución:** una herramienta nueva es un `defineTool({ name, title, description, input, access, module, run })` en el fichero de su área
  (`tasks.ts`, `notes.ts`, `finance.ts`). Si cambia datos, `ctx.changed({ summary, undo })` con la inversa (el asistente ofrece «Deshacer»;
  el MCP lo ignora). Nada de borrados. Después, `pnpm --filter @muninn/mcp build` y `build:edge` (los dos empaquetan `@muninn/assistant`).
