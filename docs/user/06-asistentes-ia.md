---
title: Asistentes de IA
description: Conecta Claude, Codex o un modelo local para que conozcan y gestionen tus proyectos.
order: 6
status: disponible
---

# Asistentes de IA

Muninn incluye un servidor **MCP** (Model Context Protocol), el estándar con el que los asistentes de IA
se conectan a otras aplicaciones. Una vez conectado, puedes pedirle cosas como:

- *"¿Cómo voy hoy?"*
- *"¿Qué tengo vencido en el proyecto Muninn?"*
- *"Crea una tarea urgente en Muninn para revisar el login, con fecha el viernes."*
- *"Mueve la tarea del login a En curso."*
- *"Apunta en una nota del proyecto lo que hemos decidido sobre el diseño."*

Puedes nombrar los proyectos y las columnas por su nombre, sin preocuparte de mayúsculas.

**Seguridad:** el asistente puede crear, editar, mover, completar y archivar, pero **nunca borrar** nada definitivamente.

> **Próximamente: desde el móvil o desde claude.ai.** Muninn ya tiene preparado un servidor MCP remoto (por internet, entrando con tu
> cuenta), pero aún no está en marcha. Cuando lo esté, podrás añadirlo como conector en claude.ai o en la app de Claude del móvil e iniciar
> sesión con tu cuenta de Muninn; verá lo mismo que la app y tampoco podrá borrar nada.

---

## Configuración (avanzado)

> Esta sección es técnica: se simplificará cuando Muninn incluya un asistente de configuración.

Compila el servidor una vez desde la carpeta del proyecto:

```bash
pnpm --filter @muninn/mcp build
```

### ¿Dónde se guardan los datos?

| Configuración | Dónde |
|---|---|
| Ninguna | En un fichero en tu equipo: `~/.muninn/data.json`. Ideal para probar. |
| `MUNINN_DATA_FILE` | En el fichero que indiques |
| `MUNINN_SUPABASE_URL` + `MUNINN_SUPABASE_SERVICE_ROLE_KEY` + `MUNINN_USER_ID` | En tu cuenta de Muninn en la nube (los mismos datos que ves en la app) |

> **Importante:** la *service role key* da acceso total a la base de datos. Guárdala solo en la
> configuración de tu equipo y no la compartas nunca.

### Claude Code

```bash
claude mcp add muninn --scope user -- node C:/sourcecode/personal_app/packages/mcp/dist/index.js
```

### Claude Desktop

Edita `%APPDATA%\Claude\claude_desktop_config.json` en Windows o
`~/Library/Application Support/Claude/claude_desktop_config.json` en macOS:

```json
{
  "mcpServers": {
    "muninn": {
      "command": "node",
      "args": ["C:/sourcecode/personal_app/packages/mcp/dist/index.js"]
    }
  }
}
```

Para usar los datos de la nube, añade un bloque `"env": { "MUNINN_SUPABASE_URL": "…", … }` dentro de `"muninn"`.
Después cierra Claude Desktop del todo y vuelve a abrirlo.

### Codex

En `~/.codex/config.toml`:

```toml
[mcp_servers.muninn]
command = "node"
args = ["C:/sourcecode/personal_app/packages/mcp/dist/index.js"]
```

### Herramientas disponibles

| Para consultar | Para actuar |
|---|---|
| `overview`: resumen del día | `create_project` |
| `list_projects` | `create_task`, `update_task` |
| `project_status`: informe de un proyecto | `move_task`, `complete_task`, `archive_task` |
| `list_tasks`: con filtros | `add_checklist_item`, `set_checklist_item_done` |
| `get_task`: con subtareas y notas | `create_note`, `update_note` |
| `list_columns`, `list_notes`, `recent_activity` | |
