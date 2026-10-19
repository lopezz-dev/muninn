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
