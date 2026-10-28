# Arquitectura

```
┌──────────── apps/desktop (Tauri 2) ─────┐   ┌── apps/web (PWA) ──┐
│  carga el build de apps/web             │   │  iPhone / navegador │
└───────────────┬─────────────────────────┘   └─────────┬──────────┘
                │            @muninn/core               │
                └──────────────► createMuninn(store) ◄──┘
                                       │
        ┌──────────────────────────────┼─────────────────────────────┐
        │                              │                             │
  createSupabaseStore            createFileStore              createMemoryStore
  (cloud o self-hosted)          (~/.muninn/data.json)        (tests / demo)
        │
  Supabase: Postgres + Auth + Realtime + Edge Functions + Storage
        ▲            ▲                 ▲
   webhooks GitHub   agentes (F4)     cron noticias (función `news`, ADR-0042)

  packages/assistant ── catálogo único de herramientas · bucle · proveedores (Ollama, guion) ──► pantalla Asistente (ADR-0041)
         ▲                       └─ app ──► http://localhost:11434 (Ollama, solo en el ordenador)
  packages/mcp ── createMuninn(store, { actor: 'mcp' }) + catálogo ──► Claude Desktop / Claude Code / Codex (stdio)
               └─ http.ts (Streamable HTTP, token del usuario) ── supabase/functions/mcp ──► claude.ai / móvil (ADR-0033)

  packages/ui ── tokens.ts → tokens.css (--mn-*) → theme.css (Tailwind v4) ──► apps/web (y por tanto desktop)
                 icons (Phosphor) · fonts (Geist) · applyAppearance (cristal, acento)
```

## Principios

1. **Una sola API de dominio.** `@muninn/core` (`createMuninn`) es la única puerta a los datos.
   La UI, el MCP, la sincronización con GitHub y los agentes la usan igual. Una función nueva
   en el core está disponible para todos.
2. **El backend es intercambiable.** Nadie importa Supabase salvo `supabase-store.ts`.
   Migrar a tu servidor = Supabase self-hosted (mismo store) u otro `Store`.
3. **Multiusuario desde el día uno.** Todas las tablas tienen `owner_id` + RLS. Hoy lo usas tú;
   mañana se puede vender sin rehacer el esquema.
4. **Todo deja rastro.** Cada cambio escribe en `activity` con el actor (`user`, `mcp`, `github`,
   `agent`, `assistant`). De ahí salen los resúmenes ("¿qué he hecho esta semana?") y los insights.

## Frontend (`apps/web`)

```
main.tsx ── RouterProvider ── rootRoute (beforeLoad: getAuth → user | demo | anonymous)
                                 ├─ /login (pública, chunk propio; supabase-js en diferido)
                                 └─ _app (sin sesión → /login · loader: loadMuninn → core + store del usuario)
                                      └─ AppShell: Sidebar (≥ 1024 px; raíl en 768–1023) · TabBar (< 768 px) · ⌘K · diálogos
                                           └─ <Outlet/>: screens/* (un chunk por pantalla)
```

- **Rutas** en `src/router.tsx` (TanStack Router, tipadas): ver [ADR-0020](adr/0020-tanstack-router-carga-diferida.md).
- **Navegación** compartida por barra lateral, barra de pestañas y buscador en `src/shell/nav.ts`: ver [ADR-0021](adr/0021-shell-de-la-app.md)
  y [ADR-0054](adr/0054-shell-responsive-en-tres-tamanos.md) (teléfono, tablet y ordenador).
- **Datos:** `useMuninn()` + react-query (`src/lib/queries.ts`). Un tablero es una sola entrada de caché (`keys.board`) que las
  acciones (`task-actions.ts`, `column-actions.ts`) actualizan al instante, escriben en el core de una en una por proyecto y
  deshacen si falla; todas dan feedback con «Deshacer» ([ADR-0025](adr/0025-escrituras-optimistas-y-deshacer.md)).
- **Tablero y detalle:** `/proyectos/$projectId` (drag & drop con dnd-kit, [ADR-0023](adr/0023-drag-and-drop-con-dnd-kit.md)) y su hija
  `/proyectos/$projectId/tareas/$taskId` ([ADR-0024](adr/0024-detalle-de-tarea-como-ruta.md)).
- **Notas:** `/notas` (lista con búsqueda y filtros) y su hija `/notas/$noteId` (editor), como tablero y detalle de tarea. El Markdown
  vive en `src/markdown/`: `marked` → elementos de React sin HTML ([ADR-0026](adr/0026-markdown-marked-a-react-y-textarea.md)),
  que Documentación y la descripción de tareas reutilizan.
- **Finanzas:** `/finanzas?vista=resumen|movimientos|cuentas` ([ADR-0037](adr/0037-modelo-de-datos-de-finanzas.md)). Las consultas cuelgan de
  `['finance', …]` y las escrituras van por una sola cola (`lib/finance-actions.ts`), con los saldos actualizados al instante.
- **Documentación:** `/documentacion` y `/documentacion/$pagina`. Las guías de `docs/user` se importan al compilar
  ([ADR-0027](adr/0027-documentacion-en-la-app-desde-docs-user.md)).
- **Sesión:** `src/lib/auth.ts` (Supabase Auth: código por correo y GitHub; modo demo en memoria). Al cambiar
  de usuario se vacían el core y react-query: ver [ADR-0022](adr/0022-auth-y-sesion.md).
- **Apariencia:** `src/lib/appearance.ts` (en `user_settings.preferences`, con localStorage como caché).
- **Galería de desarrollo:** `/dev/fundamentos` (sin enlace en la navegación).

## Modelo de datos

| Tabla | Para qué |
|---|---|
| `projects` | Proyectos. `github_repo` (owner/repo) los vincula con GitHub; `agent_column_id`, su columna «Para el agente» ([ADR-0032](adr/0032-columna-para-el-agente.md)). |
| `board_columns` | Estados del Kanban **por proyecto**, totalmente personalizables. `kind` (`backlog`, `todo`, `in_progress`, `review`, `done`) da semántica independiente del nombre. |
| `tasks` | Tareas. `source` (`manual`, `github`, `mcp`, `agent`) + `external_id`/`external_url` para el origen. `completed_at` se gestiona solo al entrar/salir de una columna `done`. |
| `task_checklist_items` | Subtareas (la barra de progreso de las tarjetas). |
| `notes` | Notas Markdown, opcionalmente vinculadas a proyecto o tarea. |
| `activity` | Log inmutable de eventos. |
| `user_settings` | Módulos activados y preferencias. |
| `finance_accounts` | Cuentas (corriente, ahorro, inversión, efectivo…) con su saldo inicial. El saldo **no se guarda**: lo suma la vista `finance_account_totals` ([ADR-0037](adr/0037-modelo-de-datos-de-finanzas.md)). |
| `finance_categories` | Categorías de gastos o de ingresos; las de serie llevan `key` y se siembran la primera vez. |
| `finance_transactions` | Movimientos: gasto, ingreso o traspaso entre cuentas, en céntimos y siempre positivos ([ADR-0018](adr/0018-dinero-en-centimos.md)). Ahorrar o invertir es un traspaso. |
| `news_sources` | Fuentes RSS del usuario, con tema y estado de la última descarga ([ADR-0042](adr/0042-noticias-rss-con-descarga-en-servidor.md)). |
| `news_items` | Artículos descargados por la Edge Function `news`, sin duplicados por `(source_id, guid)`; los no guardados caducan a los 30 días. |
| `news_digests` | El resumen del día (uno por fecha), generado en el ordenador con el modelo local. |
| `github_outbox` | Cola de salida hacia GitHub: tareas de una issue que se completaron o reabrieron en Muninn (`kind = 'state'`, [ADR-0031](adr/0031-sync-github-issues-tareas.md)) o que entraron o salieron de la columna del agente (`kind = 'agent'`, ADR-0032). |
| Storage `project-images` | Logo y portada de cada proyecto (`projects.image_path` y `cover_path` guardan las rutas, [ADR-0056](adr/0056-logo-y-portada-de-proyecto-con-color-del-logo.md)), privados, en `<owner_id>/<project_id>/…` y leída con URL firmadas ([ADR-0055](adr/0055-imagen-de-proyecto-en-storage.md)). |

### Sincronización con GitHub

`supabase/functions/github` (Edge Function, Deno) recibe los webhooks de `issues` y `pull_request` y, cada 5 minutos (`pg_cron`), reconcilia
y vacía la cola de salida; la app le pide vaciarla al momento tras mover una tarea de GitHub (`/sync` con `scope: outbox`). Los PRs del
agente (rama `agent/issue-<n>`) mueven su tarea con actor `agent` ([ADR-0032](adr/0032-columna-para-el-agente.md)). No tiene lógica propia: usa `createMuninn(store, { actor: 'github' })` y `@muninn/core/github`, empaquetados con
`pnpm --filter @muninn/core build:edge`. El token de GitHub es un secreto de la función ([ADR-0031](adr/0031-sync-github-issues-tareas.md)).

### Orden en el tablero

Las posiciones usan **fractional indexing** (claves de texto: `a0`, `a0V`, `a1`…). Mover una tarjeta
solo reescribe esa tarjeta, lo que evita conflictos al sincronizar entre dispositivos. Las columnas
`position` usan `collate "C"` para que Postgres ordene igual que JavaScript. Si dos dispositivos
generan la misma clave, el core rebalancea la columna.

## Módulos

Muninn se organiza en módulos activables (`user_settings.enabled_modules`). Desactivar un módulo lo oculta del menú, de
la barra de pestañas y del buscador; no borra datos ni cambia lo que ve el MCP ([ADR-0028](adr/0028-modulos-activables-solo-en-la-interfaz.md)):

| Módulo | Estado |
|---|---|
| `tasks` (proyectos + Kanban) | F1 — core listo |
| `notes` | F1 — core listo |
| `github` (issues → tareas) | F2 |
| `finance` (gastos, ingresos, ahorro, inversión, suscripciones) | F3 — core listo (ADR-0037) |
| `news` (RSS + resúmenes) | F4 — core, función `news` (desplegada, con cron) y pantalla (ADR-0042) |
| `focus` (temporizador "isla") | Backlog |

## Distribución

- **Web y móvil:** la PWA de `apps/web`, publicada en Vercel ([ADR-0040](adr/0040-pwa-instalable-y-web-push.md)).
- **Escritorio:** al fusionar el Release PR de release-please en `main`, `release.yml` publica la GitHub Release con los
  instaladores de Windows (NSIS), macOS y Linux, firmados para el actualizador, y su `latest.json`
  ([ADR-0010](adr/0010-ramas-y-releases.md)). Las apps instaladas leen ese `latest.json` del repo público al abrirse y ofrecen
  «Reiniciar» ([ADR-0046](adr/0046-repo-publico-con-licencia-mit.md), [ADR-0047](adr/0047-actualizaciones-de-escritorio-firmadas.md)).
