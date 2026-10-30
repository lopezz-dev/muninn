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

### Nombres de proyecto repetidos o ambiguos

- **Síntoma:** `list_tasks` con `project: "Muninn"` devolvía las tareas de un proyecto **archivado** con el mismo nombre (pasó el 28 de
  octubre), o `create_task` con `project: "app"` caía en un proyecto inesperado.
- **Causa:** `resolveProject` busca también entre los archivados (para poder consultarlos) y se quedaba con el primero por posición.
- **Solución:** desde el 28 de octubre, primero el nombre exacto y, si no hay, los que lo contienen; entre ellos gana el activo o pausado
  sobre el archivado, y si quedan **varios sin archivar** da un error con sus ids. Un archivado solo sigue valiendo. No vuelvas a
  `byName` para proyectos: elige el primero sin mirar el estado. Para operaciones importantes, mejor el id de `list_projects` u `overview`.

### `create_tasks`: un fallo no corta el lote

- Hasta 50 tareas (`MAX_BATCH_TASKS`), cada una con `checklist` opcional; `project` arriba vale para las que no lleven el suyo.
  Devuelve `results` en el orden de la entrada: `{ index, ok: true, id, checklist }` o `{ index, ok: false, error }`. El modelo **no debe
  repetir** las que salieron bien: la descripción se lo dice.
- En el core es `m.tasks.createMany`: valida y resuelve cada tarea por separado (pide columnas una vez por proyecto) y escribe con un
  `insert` múltiple para tareas, otro para subtareas y otro para la actividad. Las claves de orden van detrás de la última de cada columna
  (`positionsAfter`), así que no hay rebalanceo. Si fallaran solo las subtareas, las tareas quedan creadas y cada una lleva `checklistError`.

### Herramientas nuevas: reutiliza los esquemas del core

- Los `inputSchema` del MCP son formas zod. Reutiliza los enums del core (`taskPriority`, `columnKind`…)
  para no duplicar valores válidos, y deja que el servicio haga la validación completa.
- Las formas que repiten varias herramientas (`projectRef`, `isoDate`, `limit(max)`) están en `tools/shapes.ts`. Para resolver por nombre,
  `pickByName(filas, ref, () => mensaje)` (`define.ts`): el mensaje enumera las opciones para que el modelo se corrija.

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
  5. **claude.ai** (funciona desde el 28 de octubre): Ajustes › Conectores › **Añadir conector personalizado** con la URL del paso 1,
     *Sign in now* y *Register automatically (DCR)*, sin cabeceras. Abre `/oauth/consent` en tu Muninn (o el login, si no tienes sesión), y
     «Permitir acceso» vuelve a claude.ai con el conector listo. Recomendado: las de lectura en *Always allow* y las de escritura en
     *Needs approval*.
- **Ref:** [ADR-0033](../adr/0033-mcp-remoto-http.md), [ADR-0036](../adr/0036-pantalla-de-autorizacion-oauth.md)

### El servidor OAuth manda a `localhost`

- **Síntoma:** al conectar claude.ai o Claude Code, el navegador abre `http://localhost:5174/oauth/consent?…` y no carga.
- **Causa:** la pantalla de autorización es *Site URL* + *Authorization Path*. Si la *Site URL* de Supabase sigue en el servidor de desarrollo,
  la autorización solo funciona en el ordenador con `pnpm dev`. Pasó el 28 de octubre aunque el paso estaba marcado como hecho.
- **Solución:** Authentication › URL Configuration › *Site URL* = `https://muninn-sepia.vercel.app`. Compruébalo sin navegador: registra un
  cliente (`POST …/auth/v1/oauth/clients/register` con `redirect_uris` y `token_endpoint_auth_method: "none"`) y pide
  `…/auth/v1/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&code_challenge=…&code_challenge_method=S256`: el `location`
  del 302 tiene que ser la web publicada. Borra luego el cliente de prueba en Authentication › OAuth Apps.

### El conector sale con el icono de Supabase

- **Síntoma:** en claude.ai, el conector «Muninn» lleva el logo de Supabase.
- **Causa:** la URL del MCP es de `supabase.co` y claude.ai, al parecer, usa el favicon de ese dominio.
- **Solución (hecha el 28-10, sin desplegar):** el SDK (1.32.1) acepta `title` e `icons` en la información del servidor (especificación
  MCP 2025-11-25). `packages/mcp/src/server.ts` crea el servidor con `title: 'Muninn'` e `icons: [MUNINN_ICON]`; el logo está en
  `src/icon.ts` como PNG de 96×96 en *data URI* (sale de `apps/web/scripts/logo.mjs`), para no atar el MCP al dominio de la web. Desde
  el 30-10 también lleva `description` y `websiteUrl` (`MUNINN_DESCRIPTION` y `MUNINN_WEBSITE` en `server.ts`). Lo comprueba
  `test/server.test.ts`. Tras redesplegar `mcp`, quita y vuelve a añadir el conector en claude.ai: la información del servidor se lee al
  conectar (fase final, pasos 2 y 7).
- **Si claude.ai no lo lee** (no está comprobado que use `icons`), la otra vía es servir el MCP desde un dominio de Muninn (un *rewrite* de
  Vercel a la función), que cambia la URL del recurso en los metadatos OAuth: necesita ADR.
- **Si cambias el logo**, regenera el *data URI* de `src/icon.ts` igual que los iconos de la web.

### Finanzas: importes en euros, cuentas y categorías por nombre

- Las herramientas de Finanzas (`packages/assistant/src/tools/finance.ts`) aceptan los importes en **euros** (`24.9`, `"24,90"`) y devuelven céntimos (`amount`,
  `balance`) y el texto (`amountText`, `balanceText`): así el modelo no multiplica por cien ni lee mal los céntimos.
- `account` y `category` admiten id o nombre (exacto y, si no, el primero que lo contiene); sin `account`, un gasto o ingreso va a la
  primera cuenta corriente. `update_transaction` con `category: null` la quita.
- Resuelve con `financeLookup(app)` (uno por llamada): lee cuentas y categorías como mucho una vez y nombra la salida con lo mismo
  (`out`). No llames a `accounts.list` en cada resolución: eran hasta cinco viajes de red por herramienta.
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
