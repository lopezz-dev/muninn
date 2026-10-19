# Gotchas · core (`packages/core`)

### Comparar posiciones con `<`, nunca con `localeCompare`

- **Síntoma:** tarjetas que saltan de orden, sobre todo con claves que mezclan mayúsculas y minúsculas (`a0V` vs `a0b`).
- **Causa:** las claves de fractional-indexing se ordenan por bytes. `localeCompare` usa reglas de idioma.
- **Solución:** usa `byPosition` (`store.ts`) o los operadores `<` y `>`.
- **Ref:** [ADR-0006](../adr/0006-orden-con-fractional-indexing.md)

### `positionAt` puede devolver un `rebalance`, y hay que persistirlo

- **Síntoma:** `generateKeyBetween` lanza una excepción, o el orden queda mal tras sincronizar dos dispositivos.
- **Causa:** dos clientes generaron la misma clave a la vez.
- **Solución:** en el servicio, usa siempre `place()`, que aplica el rebalanceo antes de devolver la
  posición. No llames a `generateKeyBetween` directamente.

### No escribir en el store saltándose el servicio

- **Síntoma:** tareas en "Hecho" sin `completedAt`, falta actividad o hay posiciones duplicadas.
- **Causa:** las reglas viven en `createMuninn`, no en el store.
- **Solución:** la UI, el MCP y las integraciones usan `createMuninn`. El store es un detalle interno.
- **Ref:** [ADR-0002](../adr/0002-api-de-dominio-unica.md)

### Zod 4: `z.uuid()` es estricto

- **Síntoma:** un id "válido" se rechaza en la validación.
- **Causa:** `z.uuid()` valida la variante RFC 4122. Los ids hechos a mano en los tests (`'1'`, `'abc'`) no pasan.
- **Solución:** en los tests, usa ids reales (`crypto.randomUUID()`) o los que devuelve el propio store.

### `z.input` frente a `z.infer` en los tipos de entrada

- **Síntoma:** TypeScript exige campos opcionales al llamar al servicio.
- **Causa:** las entradas con `.optional()`, los defaults o los transforms difieren entre la entrada y la salida.
- **Solución:** los tipos `*Input` se exportan con `z.input<>` y los de consulta con `z.infer<>`. Mantén esa convención.

### "Hoy" depende de la zona horaria

- **Síntoma:** una tarea con fecha de hoy aparece como vencida, o al revés, cerca de medianoche.
- **Causa:** `dueDate` es una fecha local (`AAAA-MM-DD`) y "hoy" se calcula con `timeZone`.
- **Solución:** `createMuninn` acepta `timeZone`. En los tests, fíjala (`'UTC'`) junto con `now`.
  En un servidor (Edge Functions, agentes), pasa la zona del usuario y no la del servidor.

### `file-store` solo funciona en Node

- **Síntoma:** el build de la web falla con `node:fs`.
- **Causa:** importar `@muninn/core/file-store` desde el frontend.
- **Solución:** en la web, importa solo `@muninn/core` y `@muninn/core/supabase`.
- **Ref:** [ADR-0012](../adr/0012-paquetes-internos-como-fuente.md)

### `columns.delete` devuelve los ids movidos, incluidas las archivadas

- Para deshacer un borrado de columna hay que devolver sus tareas al orden que tenían. `delete` devuelve
  `{ movedTaskIds }` en el orden de la columna y mueve también las **archivadas**, que el tablero no ve.
- «Deshacer» recrea la columna con **otro id** (el antiguo ya no existe) y mueve las tareas de vuelta una a una.

### `checklist.counts` trocea las consultas

- **Síntoma:** el tablero de un proyecto con cientos de tareas falla al pedir el progreso de las subtareas.
- **Causa:** `in (…)` de PostgREST va en la URL: con unos cientos de ids se pasa de largo.
- **Solución:** el core lo pide de 100 en 100. Úsalo (`m.checklist.counts(ids)`) y no `checklist.list` por tarea.

### `overview()` incluye las archivadas para contar lo hecho

- `completedToday`, `completedTodayTasks` y `completedByDay` salen de **todas** las tareas del proyecto, archivadas o no.
  Lo abierto (`dueToday`, `overdue`, `upcoming`, `inProgress`, `projects[].open/done`) solo cuenta las no archivadas.

### Notas: la tarea manda sobre el proyecto, y el autoguardado no llena la actividad

- **Vínculos:** si una nota tiene `taskId`, su `projectId` es siempre el de esa tarea (`create` lo deduce y falla si
  le dices otro; `update` lo corrige). Cambiar de proyecto o quitarlo **suelta la tarea** (`taskId: null`).
- **Actividad:** `notes.update` no escribe nada si no cambia ningún campo. Las ediciones de título o texto se anotan como
  mucho una cada 10 minutos por actor (`NOTE_EDIT_WINDOW_MS`); fijar/desfijar tienen sus propias acciones (`pinned`,
  `unpinned`) y vincular se anota siempre. Sin esto, el autoguardado del editor escribiría un evento por pausa al teclear.
- **Ref:** [ADR-0007](../adr/0007-registro-de-actividad.md), [ADR-0026](../adr/0026-markdown-marked-a-react-y-textarea.md)
