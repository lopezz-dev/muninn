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
| `ui` | `packages/ui`: tokens de diseño, tema de Tailwind, iconos, apariencia |
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
- [ADR-0018](0018-dinero-en-centimos.md) — El dinero se maneja en céntimos enteros
- [ADR-0022](0022-auth-y-sesion.md) — Auth y gestión de sesión: código por correo y GitHub con Supabase Auth
- [ADR-0025](0025-escrituras-optimistas-y-deshacer.md) — Escrituras optimistas, serializadas por proyecto y con «Deshacer»
- [ADR-0026](0026-markdown-marked-a-react-y-textarea.md) — Markdown con marked a elementos de React y un editor sobre `textarea`
- [ADR-0031](0031-sync-github-issues-tareas.md) — Sync GitHub: issues ↔ tareas con webhook y reconciliación en una Edge Function

### db
- [ADR-0003](0003-stores-intercambiables-supabase.md) — Stores intercambiables, con Supabase como backend inicial
- [ADR-0004](0004-multiusuario-con-rls.md) — Multiusuario con `owner_id` y RLS desde el día uno
- [ADR-0005](0005-columnas-con-kind-semantico.md) — Columnas personalizables con `kind` semántico
- [ADR-0006](0006-orden-con-fractional-indexing.md) — Orden con fractional indexing
- [ADR-0007](0007-registro-de-actividad.md) — Registro de actividad inmutable con actor
- [ADR-0018](0018-dinero-en-centimos.md) — El dinero se maneja en céntimos enteros
- [ADR-0022](0022-auth-y-sesion.md) — Auth y gestión de sesión: código por correo y GitHub con Supabase Auth
- [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md) — Tiempo real por invalidación de caché y caché de solo lectura sin conexión
- [ADR-0031](0031-sync-github-issues-tareas.md) — Sync GitHub: issues ↔ tareas con webhook y reconciliación en una Edge Function

### mcp
- [ADR-0009](0009-mcp-stdio-sin-borrados.md) — MCP por stdio, sin borrados definitivos y con resolución por nombre
- [ADR-0012](0012-paquetes-internos-como-fuente.md) — Paquetes internos como TS fuente; el MCP se empaqueta

### ui
- [ADR-0014](0014-tokens-y-tailwind-v4.md) — Tokens en TypeScript → variables CSS, con Tailwind v4 como capa de utilidades
- [ADR-0015](0015-modo-cristal.md) — Modo cristal (blur) global, activable
- [ADR-0016](0016-iconos-phosphor-y-geist.md) — Iconos Phosphor y fuente Geist autoalojada
- [ADR-0017](0017-componentes-radix-cva.md) — Componentes base sobre Radix, con variantes cva y `cn()`
- [ADR-0018](0018-dinero-en-centimos.md) — El dinero se maneja en céntimos enteros
- [ADR-0019](0019-feedback-con-notificaciones.md) — Toda acción da feedback: notificaciones en píldora con «Deshacer»
- [ADR-0021](0021-shell-de-la-app.md) — Shell de la app: barra lateral en escritorio, dock con menisco en móvil y ⌘K

### web
- [ADR-0008](0008-tauri-escritorio-pwa-movil.md) — Tauri 2 para escritorio y PWA para móvil
- [ADR-0014](0014-tokens-y-tailwind-v4.md) — Tokens en TypeScript → variables CSS, con Tailwind v4 como capa de utilidades
- [ADR-0020](0020-tanstack-router-carga-diferida.md) — TanStack Router con rutas en código y una pantalla por chunk
- [ADR-0021](0021-shell-de-la-app.md) — Shell de la app: barra lateral en escritorio, dock con menisco en móvil y ⌘K
- [ADR-0022](0022-auth-y-sesion.md) — Auth y gestión de sesión: código por correo y GitHub con Supabase Auth
- [ADR-0023](0023-drag-and-drop-con-dnd-kit.md) — Drag & drop del tablero con dnd-kit
- [ADR-0024](0024-detalle-de-tarea-como-ruta.md) — Detalle de tarea como ruta, con panel en escritorio y pantalla en móvil
- [ADR-0025](0025-escrituras-optimistas-y-deshacer.md) — Escrituras optimistas, serializadas por proyecto y con «Deshacer»
- [ADR-0026](0026-markdown-marked-a-react-y-textarea.md) — Markdown con marked a elementos de React y un editor sobre `textarea`
- [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md) — La sección Documentación se genera con `docs/user/*.md` importados al compilar
- [ADR-0028](0028-modulos-activables-solo-en-la-interfaz.md) — Los módulos activables ocultan la interfaz; los datos y el MCP no cambian
- [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md) — Tiempo real por invalidación de caché y caché de solo lectura sin conexión

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
- [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md) — La sección Documentación se genera con `docs/user/*.md` importados al compilar
