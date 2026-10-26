---
title: Asistentes de IA
description: Conecta Claude, Codex o un modelo local para que conozcan y gestionen tus proyectos.
order: 6
status: disponible
---

# Asistentes de IA

Muninn tiene dos formas de hablar con una IA:

- **El Asistente de la app**, con un modelo que corre en tu ordenador: está en [Asistente](11-asistente.md).
- **Claude, Codex u otros**, conectados a Muninn por **MCP** (Model Context Protocol), el estándar con el que los
  asistentes de IA se conectan a otras aplicaciones. Es lo que cuenta esta página.

Los dos usan **las mismas herramientas** con las mismas reglas, así que entienden lo mismo. Una vez conectado, puedes
pedirle cosas como:

- *"¿Cómo voy hoy?"*
- *"¿Qué tengo vencido en el proyecto Muninn?"*
- *"Crea una tarea urgente en Muninn para revisar el login, con fecha el viernes."*
- *"Mueve la tarea del login a En curso."*
- *"Apunta en una nota del proyecto lo que hemos decidido sobre el diseño."*
- *"He gastado 24,90 en el cine."* o *"¿Cuánto tengo en la hucha?"* (Finanzas: cuentas, gastos, ingresos y traspasos)

Puedes nombrar los proyectos, las columnas, las cuentas y las categorías por su nombre, sin preocuparte de mayúsculas. Los
importes se dicen en euros, como los escribirías tú.

**Seguridad:** el asistente puede crear, editar, mover, completar y archivar, pero **nunca borrar** nada definitivamente.
En el historial de una tarea, lo que hace Claude sale como «Claude» y lo del Asistente de la app, como «El asistente».

> **Desde claude.ai o el móvil: casi listo.** El servidor MCP remoto de Muninn (por internet, entrando con tu cuenta) ya está en marcha.
> Para añadirlo como conector en claude.ai falta activar el inicio de sesión con tu cuenta de Muninn. Cuando lo esté, claude.ai te traerá a
> una pantalla de Muninn que dice qué app pide acceso y qué podrá hacer, y tú eliges **Permitir acceso** o **Rechazar**. Verá lo mismo que la
> app y tampoco podrá borrar nada. Desde el iPhone hará falta además que la app esté publicada, y todavía no lo está.

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
| `list_finance_accounts`, `list_transactions`, `finance_month_report` | `create_transaction`, `update_transaction`, `archive_transaction` |
| `list_news`, `news_digest` (con Noticias) | |
| `list_finance_categories`, `list_subscriptions` | cuentas, categorías y suscripciones: crear, editar, apuntar o saltar un cobro, archivar |
