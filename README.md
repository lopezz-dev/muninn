# Muninn

> En la mitología nórdica, Huginn (el pensamiento) y **Muninn (la memoria)** eran los cuervos de Odín:
> volaban cada día por el mundo y volvían a contarle lo que habían visto.

Muninn es un sistema operativo personal: proyectos con tableros Kanban personalizables, notas,
finanzas personales, issues de GitHub convertidos en tareas, y un asistente (Claude por MCP o un modelo
local) que conoce todo ese contexto. Escritorio (Windows, Linux, macOS) y móvil (PWA) sincronizados.

## Estructura

```
apps/
  desktop/     Tauri 2 — envuelve el build de apps/web
  web/         React + Vite — PWA instalable (iPhone) y frontend del escritorio
packages/
  core/        API de dominio (createMuninn) + stores (Supabase, fichero, memoria)
  mcp/         Servidor MCP para Claude / Codex / Jarvis
supabase/
  migrations/  Esquema SQL con RLS
docs/          Arquitectura, roadmap, MCP
```

## Desarrollo

Requisitos: Node 24, pnpm 10, Rust estable (para escritorio).

```bash
pnpm install
pnpm dev            # web en http://localhost:5173
pnpm dev:desktop    # app de escritorio (Tauri)
pnpm test           # tests
pnpm lint           # Biome
pnpm typecheck
```

Supabase: crea un proyecto, aplica `supabase/migrations/*.sql` (SQL editor o `supabase db push`)
y copia `apps/web/.env.example` a `apps/web/.env.local`.

MCP: ver [docs/user/06-asistentes-ia.md](docs/user/06-asistentes-ia.md). Funciona sin Supabase (guarda en `~/.muninn/data.json`).

## Documentación

Todo parte de [docs/README.md](docs/README.md):

- **[ADRs](docs/adr/README.md):** decisiones de arquitectura y su porqué, por área.
- **[Gotchas](docs/gotchas/README.md):** trampas no obvias por área. Léelas antes de tocar esa parte.
- **[Docs de usuario](docs/user/README.md):** guías de uso, que también se muestran dentro de la app.

## Ramas y releases

- `main`: producción. `develop`: integración. Trabajo en ramas `feat/*`, `fix/*`, `docs/*` → PR a `develop`.
- Commits en formato [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat:`, `fix:`, `chore:`…).
- Al llegar a `main`, **release-please** abre un Release PR con versión y CHANGELOG. Al mergearlo se publica la
  GitHub Release y **tauri-action** adjunta los instaladores de Windows, Linux y macOS.
- Firma de macOS: añade los secretos `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
  `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` y `APPLE_TEAM_ID`. Sin ellos el `.dmg` sale sin firmar.

Más detalle en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/ROADMAP.md](docs/ROADMAP.md).
