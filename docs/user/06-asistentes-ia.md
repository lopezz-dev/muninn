---
title: Conectar Claude y otros
description: Conecta Claude, Codex u otro asistente de IA para que conozcan y gestionen tus datos de Muninn.
order: 6
status: disponible
group: ia
icon: plug
---

# Conectar Claude y otros

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

## Conectar claude.ai

Puedes añadir Muninn como **conector** en claude.ai: Claude entra con tu cuenta de Muninn y ve lo mismo que tú en la app.

1. En claude.ai, ve a **Ajustes › Conectores** y pulsa **Añadir conector personalizado**.
2. Ponle un nombre (por ejemplo, Muninn) y pega esta dirección:
   `https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp`
3. Pulsa conectar. claude.ai te trae a una pantalla de Muninn que dice qué app pide acceso, con qué cuenta entrarás y qué podrá
   hacer. Si no tenías la sesión abierta, primero te pide entrar.
4. Elige **Permitir acceso** (o **Rechazar**). Vuelves a claude.ai con el conector listo y sus herramientas.

Un consejo: deja las herramientas de consulta como «permitir siempre» y las que cambian cosas, con «pedir aprobación», para
ver qué va a hacer antes de que lo haga.

> **Ten en cuenta:** si usas claude.ai dentro de una organización, quien la administra puede tener que permitir los conectores
> personalizados. El conector sale de momento con un icono que no es el de Muninn. Y los permisos que le das a claude.ai **todavía no se
> pueden ver ni quitar desde Muninn**.

> **Próximamente:** usarlo desde la app de Claude en el **iPhone**. Debería funcionar igual, pero aún no está probado.

---

## Configuración (avanzado)

> Esta sección es técnica: se simplificará cuando Muninn incluya un asistente de configuración.

Esto es para conectar un asistente que corre en tu ordenador (Claude Code, Claude Desktop, Codex…) directamente, sin pasar por
internet. Compila el servidor una vez desde la carpeta del proyecto:

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

En los ejemplos, cambia `C:/sourcecode/muninn` por la carpeta donde tengas Muninn.

### Claude Code

```bash
claude mcp add muninn --scope user -- node C:/sourcecode/muninn/packages/mcp/dist/index.js
```

### Claude Desktop

Edita `%APPDATA%\Claude\claude_desktop_config.json` en Windows o
`~/Library/Application Support/Claude/claude_desktop_config.json` en macOS:

```json
{
  "mcpServers": {
    "muninn": {
      "command": "node",
      "args": ["C:/sourcecode/muninn/packages/mcp/dist/index.js"]
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
args = ["C:/sourcecode/muninn/packages/mcp/dist/index.js"]
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
| `list_finance_categories`, `list_subscriptions` | `create_finance_account`, `update_finance_account`, `archive_finance_account` |
| | `create_finance_category` (las categorías aún no se editan ni se archivan) |
| | `create_subscription`, `record_subscription_charge`, `skip_subscription_charge`, `archive_subscription` |
