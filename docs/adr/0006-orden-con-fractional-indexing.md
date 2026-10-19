# ADR-0006: Orden con fractional indexing

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** core, db

## Contexto

Proyectos, columnas, tareas y subtareas se reordenan arrastrando. Con índices enteros, mover una
tarjeta obliga a reescribir todas las de debajo, lo que provoca muchas escrituras y conflictos
cuando dos dispositivos sincronizan a la vez.

## Decisión

- `position` es una clave de texto generada con `fractional-indexing` (`a0`, `a0V`, `a1`…).
  Insertar entre A y B genera una clave entre las dos: solo se escribe la fila que se mueve.
- En SQL, `position text collate "C" not null`, para que Postgres ordene byte a byte igual que JavaScript.
- En JS se compara con `<` y `>` (`byPosition`), nunca con `localeCompare`.
- Si dos dispositivos generan la misma clave, `positionAt` devuelve un `rebalance` con claves
  nuevas para toda la lista, y el servicio lo persiste.

## Alternativas consideradas

- **Enteros con huecos (10, 20, 30):** se agotan y requieren renumerar.
- **Floats:** pierden precisión tras muchas inserciones en el mismo hueco.

## Consecuencias

- Cada movimiento cuesta una escritura, salvo en el caso raro de rebalanceo.
- Requiere disciplina con la colación y la comparación: ver [gotchas/core](../gotchas/core.md) y
  [gotchas/db](../gotchas/db.md).
