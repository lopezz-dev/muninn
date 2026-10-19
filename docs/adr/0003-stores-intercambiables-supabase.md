# ADR-0003: Stores intercambiables, con Supabase como backend inicial

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** core, db

## Contexto

Hace falta un servidor siempre encendido: sincronizar escritorio y móvil, recibir webhooks de GitHub
y dejar que los agentes trabajen aunque el PC esté apagado. El autor quiere empezar rápido y gratis,
pero planea montar un servidor propio a finales de 2026 y no depender de suscripciones.

## Decisión

- El core define una interfaz `Store` (`packages/core/src/store.ts`) ligada a un usuario.
- Implementaciones: `createSupabaseStore` (Supabase cloud o self-hosted), `createFileStore`
  (JSON local, solo Node) y `createMemoryStore` (tests y demo).
- Backend inicial: **Supabase** (Postgres + Auth + Realtime + Edge Functions).
- Solo `supabase-store.ts` importa `@supabase/supabase-js`.

## Alternativas consideradas

- **Local-first con CRDTs (PowerSync, Electric, Replicache):** offline perfecto, pero mucha
  complejidad para la fase actual. Se puede añadir más adelante como otro store.
- **Servidor propio desde el principio:** más privacidad, pero hay que mantenerlo y el PC tendría que estar encendido.
- **Firebase:** NoSQL y difícil de autoalojar.

## Consecuencias

- Migrar al servidor propio consiste en desplegar Supabase self-hosted y cambiar la URL, o escribir otro store.
- El MCP funciona hoy sin Supabase gracias al FileStore.
- El plan gratuito de Supabase pausa los proyectos inactivos y permite 2 proyectos activos.
