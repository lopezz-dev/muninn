# ADR-0005: Columnas personalizables con `kind` semántico

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** core, db

## Contexto

El tablero Kanban tiene que ser totalmente personalizable: cada proyecto puede tener sus propias
columnas con nombres libres ("Shipped", "Esperando cliente"…). Pero los informes, el MCP y Jarvis
necesitan saber qué está pendiente, en curso o terminado, sin depender del nombre.

## Decisión

- Las columnas pertenecen a un proyecto (`board_columns.project_id`) y tienen nombre, color,
  límite WIP opcional y un **`kind`**: `backlog` · `todo` · `in_progress` · `review` · `done`.
- Al crear un proyecto se crean 5 columnas por defecto: Backlog, Pendiente, En curso, Revisión y Hecho.
- `completedAt` lo gestiona el core: se fija al **entrar** en una columna `done` y se limpia al salir.
  Cambiar el `kind` de una columna a `done` (o dejar de serlo) actualiza sus tareas.
- Las tareas nuevas van a la primera columna `todo` si no se indica otra.

## Alternativas consideradas

- **Estados fijos globales:** no es personalizable.
- **Estados sin semántica:** no se podría saber qué está terminado.

## Consecuencias

- Los informes (`overview`, `projectStatus`) funcionan con cualquier configuración de columnas.
- Puede haber varias columnas del mismo `kind`. `completeTask` usa la primera `done`.
- No se puede borrar la última columna de un proyecto, ni una con tareas sin indicar un destino.
