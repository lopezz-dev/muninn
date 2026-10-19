# ADR-0011: Biome como linter y formateador

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** tooling

## Contexto

Hace falta lint y formato coherentes en todo el monorepo, rápidos y con poca configuración.

## Decisión

Usar **Biome** (`biome.json` en la raíz) con el preset `recommended`, comillas simples, sin punto
y coma y 100 columnas. `pnpm lint` comprueba y `pnpm format` corrige.

## Alternativas consideradas

- **ESLint + Prettier:** dos herramientas y más configuración y dependencias, y bastante más lento.

## Consecuencias

- Un único binario y una única configuración.
- Algunas reglas de ESLint de React no tienen equivalente exacto. Si se echan de menos, se valorará.
- Al actualizar Biome, `biome migrate` puede tocar la configuración: ver [gotchas/tooling](../gotchas/tooling.md).
