# ADR-0007: Registro de actividad inmutable con actor

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** core, db

## Contexto

Jarvis y los resúmenes tienen que responder a "¿qué he hecho esta semana?" o "¿qué ha movido el
agente?". Además, el autor quiere saber qué cambios vienen de él, de Claude, de GitHub o de un agente.

## Decisión

- Tabla `activity` de solo inserción y lectura (sin políticas de `update`/`delete`).
- Cada operación de escritura del servicio registra `entity_type`, `entity_id`, `action`
  (`created`, `updated`, `moved`, `completed`, `reopened`, `archived`, `deleted`), `actor`
  (`user`, `mcp`, `github`, `agent`, `system`) y un `payload` JSON pequeño.
- El `actor` se fija al crear el servicio (`createMuninn(store, { actor: 'mcp' })`) y también
  decide el `source` por defecto de las tareas nuevas.

## Alternativas consideradas

- **Derivar la actividad de `updated_at`:** no explica qué cambió ni quién lo cambió.
- **Auditoría con triggers en Postgres:** no conoce el actor lógico (MCP o UI) y no funciona en el FileStore.

## Consecuencias

- Base para insights, resúmenes diarios y notificaciones.
- La tabla crecerá: más adelante habrá que compactar o archivar eventos antiguos.
- Las operaciones de solo orden (`moveProject`, `moveColumn`) no se registran, para no generar ruido.
