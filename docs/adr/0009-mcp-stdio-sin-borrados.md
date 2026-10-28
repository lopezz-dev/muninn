# ADR-0009: MCP por stdio, sin borrados definitivos y con resolución por nombre

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** mcp

## Contexto

Claude (Desktop y Code), Codex y un futuro modelo local (Jarvis) tienen que poder leer y gestionar
Muninn. Los modelos pequeños se equivocan con los UUID y una herramienta destructiva mal invocada
puede perder datos.

## Decisión

- Servidor MCP en `packages/mcp` con transporte **stdio**, que lanza cada cliente en local.
- Se construye sobre `createMuninn(store, { actor: 'mcp' })`, sin lógica propia de datos.
- **No hay herramientas de borrado definitivo**: como mucho, `archive_task`.
- Los parámetros `project` aceptan un id o un nombre, y `column` acepta un id, un nombre o un `kind`.
  Si no hay coincidencia, el error enumera las opciones válidas para que el modelo se corrija solo.
- Los errores de validación y de "no encontrado" se devuelven como `isError` con texto. Los demás
  errores se propagan.
- Almacenamiento según variables de entorno: Supabase (service key + `MUNINN_USER_ID`) o fichero local.

## Alternativas consideradas

- **MCP remoto por HTTP desde el principio:** necesita autenticación OAuth. Queda para la F2,
  para poder usarlo desde el móvil o claude.ai.
- **Exponer el CRUD completo:** demasiado riesgo para pocas ventajas.

## Consecuencias

- Funciona hoy sin Supabase.
- La service role key queda en la configuración local del cliente MCP: ver [gotchas/mcp](../gotchas/mcp.md).
