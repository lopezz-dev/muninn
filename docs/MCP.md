# Conectar Claude, Codex o Jarvis a Muninn (MCP)

El servidor está en `packages/mcp`. Compílalo una vez:

```bash
pnpm --filter @muninn/mcp build
```

## Origen de los datos

| Variables | Dónde guarda |
|---|---|
| *(ninguna)* | `~/.muninn/data.json` — ideal para probar ya, sin Supabase |
| `MUNINN_DATA_FILE` | El fichero JSON que indiques |
| `MUNINN_SUPABASE_URL` + `MUNINN_SUPABASE_SERVICE_ROLE_KEY` + `MUNINN_USER_ID` | Tu proyecto de Supabase, como tu usuario |

> La *service role key* se salta RLS. El servidor siempre filtra por `MUNINN_USER_ID`, pero trátala
> como una contraseña: solo en la config local de tu máquina, nunca en el repo.

## Claude Code

```bash
claude mcp add muninn --scope user -- node C:/sourcecode/personal_app/packages/mcp/dist/index.js
```

## Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json`:

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

## Codex

`~/.codex/config.toml`:

```toml
[mcp_servers.muninn]
command = "node"
args = ["C:/sourcecode/personal_app/packages/mcp/dist/index.js"]
```

## Herramientas

Lectura: `overview`, `list_projects`, `project_status`, `list_tasks`, `get_task`, `list_columns`,
`list_notes`, `recent_activity`.

Escritura: `create_project`, `create_task`, `update_task`, `move_task`, `complete_task`,
`archive_task`, `add_checklist_item`, `set_checklist_item_done`, `create_note`, `update_note`.

Los proyectos se pueden nombrar por id o por nombre ("muninn"), y las columnas por id, nombre
("En curso") o tipo (`in_progress`). No hay borrados definitivos vía MCP: como mucho, archivar.
