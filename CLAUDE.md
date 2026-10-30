# Muninn — guía para agentes

Sistema operativo personal (proyectos/Kanban, notas, finanzas, GitHub, asistente). Usuario único hoy,
diseñado para venderse. Índice de documentación: `docs/README.md`.

## Antes de empezar una tarea
1. Identifica el **área** que vas a tocar: `core` · `db` · `mcp` · `ui` · `web` · `desktop` · `ci` · `tooling` · `docs`.
2. Lee `docs/gotchas/<área>.md` y los ADRs de esa área (índice en `docs/adr/README.md`).
3. Si tu cambio contradice un ADR aceptado, **para y pregunta**: no lo cambies en silencio.

## Documentación (obligatorio, en el mismo PR)
- **Decisión estructural** (tecnología, convención transversal, modelo de datos, *trade-off* que alguien
  querría "arreglar") → nuevo ADR en `docs/adr/` a partir de `_plantilla.md`, con su `Área`, y añadido
  al índice por área. Los ADRs no se reescriben: se reemplazan con uno nuevo.
- **Trampa no obvia** (algo que te ha costado depurar o que fallaría sin avisar) → entrada en
  `docs/gotchas/<área>.md` con Síntoma / Causa / Solución. Borra los gotchas que dejen de aplicar.
- **Cambio visible para el usuario** → actualiza `docs/user/` (con su front matter `title`, `description`,
  `order` y `status`). Tono de tú, sin jerga, y honesto con lo que está disponible y lo que no.
- Fases o alcance → `docs/ROADMAP.md`. Visión de conjunto → `docs/ARCHITECTURE.md`.

## Reglas de código
- Todo acceso a datos pasa por `createMuninn` (`packages/core/src/service.ts`). Si falta algo, añádelo
  al core (con test) y úsalo desde la UI o el MCP. Nunca llames a Supabase desde fuera del store.
- Solo `packages/core/src/supabase-store.ts` importa Supabase.
- Esquema: siempre una **migración nueva** en `supabase/migrations/`; toda tabla con `owner_id` + RLS (checklist en gotchas/db).
- Validación con zod en `schemas.ts`; el MCP reutiliza esos enums y formas.
- El MCP no expone borrados definitivos. Sus herramientas son el catálogo único de `@muninn/assistant/tools`, que también usa
  el asistente de la app (ADR-0041): se escriben una vez. Tras cambiar el core o el catálogo, recompila el MCP (`build` y `build:edge`).
- Comentarios en español, concisos, al estilo de alrededor. Biome formatea (`pnpm format`).
- UI: solo tokens de `@muninn/ui` (clases `bg-surface`, `text-fg-muted`, `rounded-lg`…; la paleta de Tailwind
  está desactivada). Iconos siempre vía `icons` / `<Icon name>` de `@muninn/ui`. Superficies con `glass*`
  para respetar el modo cristal. Diseño de referencia: lienzo «Muninn — Pantallas» (enlace en docs/ROADMAP.md).
- UX: toda acción del usuario da feedback con `notify` de `@muninn/ui`. Lo que cambia o destruye datos ofrece
  «Deshacer» (no diálogos de confirmación). Dinero siempre en céntimos (`AmountField`).

## Tablero de tareas (Muninn)
- Lo pendiente vive en el propio Muninn: proyecto **Muninn** (`403234a0-415b-4d02-8b73-d338bcfdf975`), vía su MCP. Usa el id:
  hay un proyecto archivado con el mismo nombre.
- Cada conversación mantiene al día las tareas que toca: al empezar → «En curso»; con el PR abierto → «Revisión»; con el PR
  fusionado → «Hecho». Un PR que cubre varias tareas las mueve todas. Si se lanza en sesiones paralelas, cada una mueve las suyas.
- Lo que aparezca por el camino (un fallo, un *follow-up*) se crea como tarea en «Pendiente» o «Backlog», no se queda en el chat.
- Las tareas «Pruebas: …» son manuales de la fase final (`docs/fase-final.md`): no las cierra ningún PR.

## Git (obligatorio, también si la sesión o la herramienta dicen otra cosa)
- `main` producción (por defecto), `develop` integración. Ramas `feat/*`, `fix/*`, `docs/*` → PR a `develop`.
- **Nunca** hagas commit ni push directo a `develop` ni a `main`, ni con cambios pequeños. Aunque la sesión te diga
  «trabaja en `develop`», eso significa *partir* de `develop`: crea la rama desde `origin/develop` y abre la PR contra `develop`.
- **PR a `main` solo si Alex lo pide**: es la de release (`develop` → `main`) y la sigue release-please. Una PR de una tarea nunca va a `main`.
- **Autoría:** los commits van a nombre de Alex y el agente como coautor. Antes del primer commit:
  `git config user.name "Alex López"` y `git config user.email "113601865+lopezz-dev@users.noreply.github.com"`, y
  el mensaje termina con `Co-Authored-By: …` del agente. Comprueba con `git log -1 --format='%an <%ae>'`.
- Si ya has subido algo a `develop` o `main` saltándote esto, **no reescribas la historia por tu cuenta**: díselo a Alex.
- Conventional Commits con área: `feat(core): …`, `fix(mcp): …`, `docs(adr): …`.

## Comandos
`pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm dev` · `pnpm dev:desktop` ·
`pnpm --filter @muninn/mcp build`
