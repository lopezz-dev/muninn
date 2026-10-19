# ADRs (Architecture Decision Records)

Un ADR registra **una decisión** que condiciona el proyecto: qué se decidió, por qué y qué
alternativas se descartaron. Sirven para no volver a debatir lo ya decidido y para que cualquier
persona o agente entienda el porqué del código.

## Cuándo escribir uno

- Elegir o cambiar una tecnología, librería o servicio.
- Cambiar el modelo de datos de forma estructural o una convención transversal.
- Aceptar un compromiso (*trade-off*) que alguien podría querer "arreglar" sin conocer el contexto.

No hace falta para detalles locales y reversibles. Si es una trampa técnica y no una decisión,
va en [gotchas](../gotchas/README.md).

## Cómo

1. Copia [`_plantilla.md`](_plantilla.md) a `NNNN-titulo-en-kebab-case.md` con el siguiente número libre.
2. Rellena `Área` con una o varias entidades de la tabla de abajo.
3. Añádelo al índice de su área en este fichero.
4. Los ADRs no se reescriben: si una decisión cambia, se crea uno nuevo con `Reemplaza a ADR-NNNN`
   y el antiguo pasa a `Reemplazado por ADR-MMMM`.

Estados: `Propuesto` · `Aceptado` · `Reemplazado por ADR-NNNN` · `Descartado`.

## Áreas (entidades)

| Área | Ámbito |
|---|---|
| `core` | `packages/core`: API de dominio, stores, validación |
| `db` | `supabase/`: esquema, RLS, migraciones, Realtime |
| `mcp` | `packages/mcp`: servidor MCP |
| `web` | `apps/web`: PWA y frontend compartido |
| `desktop` | `apps/desktop`: Tauri |
| `ci` | GitHub Actions, ramas, releases |
| `tooling` | Monorepo, TypeScript, lint, build |
| `docs` | Documentación del proyecto y de usuario |

## Índice por área

### core
- [ADR-0002](0002-api-de-dominio-unica.md) — API de dominio única (`createMuninn`)
- [ADR-0003](0003-stores-intercambiables-supabase.md) — Stores intercambiables, con Supabase como backend inicial
- [ADR-0005](0005-columnas-con-kind-semantico.md) — Columnas personalizables con `kind` semántico
- [ADR-0006](0006-orden-con-fractional-indexing.md) — Orden con fractional indexing
- [ADR-0007](0007-registro-de-actividad.md) — Registro de actividad inmutable con actor

### db
- [ADR-0003](0003-stores-intercambiables-supabase.md) — Stores intercambiables, con Supabase como backend inicial
- [ADR-0004](0004-multiusuario-con-rls.md) — Multiusuario con `owner_id` y RLS desde el día uno
- [ADR-0005](0005-columnas-con-kind-semantico.md) — Columnas personalizables con `kind` semántico
- [ADR-0006](0006-orden-con-fractional-indexing.md) — Orden con fractional indexing
- [ADR-0007](0007-registro-de-actividad.md) — Registro de actividad inmutable con actor

### mcp
- [ADR-0009](0009-mcp-stdio-sin-borrados.md) — MCP por stdio, sin borrados definitivos y con resolución por nombre
- [ADR-0012](0012-paquetes-internos-como-fuente.md) — Paquetes internos como TS fuente; el MCP se empaqueta

### web
- [ADR-0008](0008-tauri-escritorio-pwa-movil.md) — Tauri 2 para escritorio y PWA para móvil

### desktop
- [ADR-0008](0008-tauri-escritorio-pwa-movil.md) — Tauri 2 para escritorio y PWA para móvil

### ci
- [ADR-0010](0010-ramas-y-releases.md) — Ramas `main`/`develop`, Conventional Commits y release-please

### tooling
- [ADR-0001](0001-monorepo-pnpm-turborepo.md) — Monorepo con pnpm y Turborepo
- [ADR-0011](0011-biome.md) — Biome como linter y formateador
- [ADR-0012](0012-paquetes-internos-como-fuente.md) — Paquetes internos como TS fuente; el MCP se empaqueta

### docs
- [ADR-0013](0013-sistema-de-documentacion.md) — Sistema de documentación: ADRs, gotchas y docs de usuario
