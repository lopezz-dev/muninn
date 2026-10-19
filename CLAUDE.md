# Muninn — guía para agentes

Sistema operativo personal (proyectos/Kanban, notas, finanzas, GitHub, asistente). Usuario único hoy,
diseñado para venderse. Ver `docs/ARCHITECTURE.md` y `docs/ROADMAP.md`.

## Reglas
- Todo acceso a datos pasa por `createMuninn` (`packages/core/src/service.ts`). Nunca llames a Supabase
  desde la UI o el MCP: si falta algo, añádelo al core (con test) y úsalo desde ahí.
- Solo `packages/core/src/supabase-store.ts` importa Supabase. El backend debe poder cambiarse.
- Cambios de esquema = nueva migración en `supabase/migrations/` (nunca editar una ya aplicada). Toda tabla
  nueva lleva `owner_id` + RLS.
- Posiciones de orden: fractional indexing (`ordering.ts`); columnas SQL `position text collate "C"`.
- Validación de entradas con zod en `schemas.ts`; el MCP reutiliza esas formas.
- El MCP no expone borrados definitivos.
- Código y comentarios: el estilo de alrededor (comentarios en español, concisos). Biome formatea.
- UI: radios pequeños (4–6 px), estilo Claude Desktop / Shopify; nada de tarjetas muy redondeadas.

## Git
- `main` producción, `develop` integración. Ramas `feat/*` / `fix/*` → PR a `develop`.
- Conventional Commits (release-please genera versión y CHANGELOG).

## Comandos
`pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm dev` · `pnpm dev:desktop`
