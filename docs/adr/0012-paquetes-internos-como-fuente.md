# ADR-0012: Paquetes internos como TS fuente; el MCP se empaqueta

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** tooling, mcp

## Contexto

Los paquetes internos (`@muninn/core`) solo se consumen dentro del monorepo. Compilarlos por
separado añade pasos de build y desfases entre el código y su `dist`.

## Decisión

- `@muninn/core` exporta directamente TypeScript (`"exports": { ".": "./src/index.ts" }`).
  Vite y vitest lo transpilan al vuelo.
- Los puntos de entrada que solo funcionan en Node van en subrutas (`@muninn/core/file-store`) para
  que el bundle web no arrastre `node:fs`.
- El MCP, que se ejecuta con Node fuera de Vite, se empaqueta con **tsup** e incluye el core
  (`noExternal: ['@muninn/core']`) en un único `dist/index.js`.

## Alternativas consideradas

- **Compilar cada paquete con `tsc --build`:** más lento y con más configuración.
- **Ejecutar el MCP con tsx en producción:** arranque más lento y una dependencia más en el cliente.

## Consecuencias

- No hace falta compilar para desarrollar la web ni para lanzar los tests.
- **Tras cambiar el core hay que recompilar el MCP** para que Claude vea el cambio: ver [gotchas/mcp](../gotchas/mcp.md).
