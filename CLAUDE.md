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
- El MCP no expone borrados definitivos. Tras cambiar el core, recompila el MCP.
- Comentarios en español, concisos, al estilo de alrededor. Biome formatea (`pnpm format`).
- UI: solo tokens de `@muninn/ui` (clases `bg-surface`, `text-fg-muted`, `rounded-lg`…; la paleta de Tailwind
  está desactivada). Iconos siempre vía `icons` / `<Icon name>` de `@muninn/ui`. Superficies con `glass*`
  para respetar el modo cristal. Diseño de referencia: lienzo «Muninn — Pantallas» (enlace en docs/ROADMAP.md).

## Git
- `main` producción (por defecto), `develop` integración. Ramas `feat/*`, `fix/*`, `docs/*` → PR a `develop`.
- Conventional Commits con área: `feat(core): …`, `fix(mcp): …`, `docs(adr): …`.

## Comandos
`pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm dev` · `pnpm dev:desktop` ·
`pnpm --filter @muninn/mcp build`
