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

- **Síntoma:** no hay URL a la que conectar el móvil o claude.ai.
- **Causa:** la función hay que desplegarla y, para claude.ai y el móvil, activar OAuth en Supabase; no se puede hacer desde el código.
- **Solución:**
  1. **Desplegar** (CLI de Supabase con sesión): `pnpm --filter @muninn/mcp build:edge` y
     `supabase functions deploy mcp --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt`. La URL queda en
     `https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp`. Secretos opcionales: `MUNINN_TIME_ZONE` (por defecto `Europe/Madrid`) y
     `MUNINN_MCP_ALLOWED_ORIGINS` (orígenes de navegador, separados por comas; vacío = ninguno).
  2. **Comprobar** sin token: `curl -i -X POST https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp` debe dar 401 con
     `www-authenticate: Bearer resource_metadata="…"`, y `curl https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource`
     debe devolver los metadatos.
  3. **Claude Code con un token (prueba rápida, caduca a la hora):** saca tu token de acceso (en la app, DevTools › Application › Local Storage ›
     clave `muninn.auth`, campo `access_token`) y
     `claude mcp add --transport http muninn-remoto https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp --header "Authorization: Bearer <token>"`.
     No lo guardes en ningún fichero del repo.
  4. **claude.ai y el móvil (OAuth):** en Supabase › **Authentication**, activa Supabase Auth como **servidor OAuth 2.1** (si tu proyecto lo
     ofrece; cuando se escribió esto era una función nueva) con registro dinámico de clientes, y añade a *Redirect URLs* las que pida el
     cliente. Después, en claude.ai › Ajustes › Conectores › **Añadir conector personalizado**, pega la URL del paso 1: debería abrir el inicio
     de sesión de Muninn. **Sin verificar**: si el cliente no encuentra el servidor de autorización o Supabase no admite el registro dinámico,
     el plan B son tokens personales de Muninn (ADR-0033, alternativas).
- **Ref:** [ADR-0033](../adr/0033-mcp-remoto-http.md)
