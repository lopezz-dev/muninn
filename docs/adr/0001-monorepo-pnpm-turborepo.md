# ADR-0001: Monorepo con pnpm y Turborepo

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** tooling

## Contexto

Muninn tiene varias piezas que comparten tipos y lógica: PWA, escritorio, servidor MCP y, más
adelante, sincronización con GitHub y agentes. Repartirlas en varios repos obligaría a publicar
paquetes y sincronizar versiones para cada cambio del dominio.

## Decisión

Un único repositorio con workspaces de **pnpm** (`apps/*`, `packages/*`) y **Turborepo** para
orquestar `build`, `typecheck`, `test` y `dev` con caché.

## Alternativas consideradas

- **Varios repositorios:** demasiada fricción para una sola persona.
- **npm/yarn workspaces:** pnpm es más rápido, más estricto con las dependencias fantasma y ya lo usa el autor.
- **Nx:** más potente, pero más configuración de la necesaria.

## Consecuencias

- Un cambio en `@muninn/core` se refleja al instante en todas las apps.
- Los scripts de raíz (`pnpm test`, `pnpm build`…) delegan en Turborepo.
- Los scripts de instalación de dependencias están bloqueados por defecto (pnpm 10): ver
  [gotchas/tooling](../gotchas/tooling.md).
