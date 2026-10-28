# ADR-0002: API de dominio única (`createMuninn`)

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** core

## Contexto

Los mismos datos se van a tocar desde la UI (escritorio y móvil), el servidor MCP (Claude, Codex,
Jarvis local), la sincronización con GitHub y agentes automáticos. Si cada uno escribe directamente
en la base de datos, las reglas ("al mover a Hecho se marca `completedAt`", "una tarea no puede
cambiar de proyecto moviéndola", el log de actividad…) se duplican y acaban divergiendo.

## Decisión

Todo acceso a datos pasa por `createMuninn(store, { actor })` en `packages/core/src/service.ts`.
El servicio valida las entradas con zod, aplica las reglas de negocio, mantiene el orden y registra la
actividad con el `actor` que la origina. Los clientes nunca usan el store ni Supabase directamente.

## Alternativas consideradas

- **Lógica en la base de datos (triggers/RPC):** funciona para todos los clientes, pero es más
  difícil de testear, ata la lógica a Postgres y complica el modo fichero local.
- **Un backend HTTP propio:** añade un servicio que mantener y desplegar; por ahora no compensa.

## Consecuencias

- Una función nueva en el core está disponible en la UI y en el MCP sin trabajo extra.
- Las reglas se testean con el store en memoria, sin red (`packages/core/test`).
- Lo que no se pueda garantizar en el cliente (integridad entre tablas, permisos) se refuerza
  también en la base de datos: ver [ADR-0004](0004-multiusuario-con-rls.md).
