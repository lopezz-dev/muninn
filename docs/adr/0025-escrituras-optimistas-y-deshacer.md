# ADR-0025: Escrituras optimistas, serializadas por proyecto y con «Deshacer»

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web, core

## Contexto

Con Supabase, mover una tarjeta son varios viajes de red (leer, calcular la clave de orden, escribir, anotar
la actividad). Si la tarjeta espera a la respuesta para moverse, el arrastre se siente roto. Además, toda
acción que cambia datos debe ofrecer «Deshacer» ([ADR-0019](0019-feedback-con-notificaciones.md)).

## Decisión

- **Una entrada de caché por tablero** (`keys.board(projectId)`: columnas, tareas y subtareas hechas/total).
  Las acciones (`lib/task-actions.ts`, `lib/column-actions.ts`) cambian esa entrada **al instante**
  (`applyTaskMove`, `applyColumnMove`…, funciones puras con tests), escriben en el core y, si falla, la
  devuelven a como estaba y avisan con `notify.error`.
- Las escrituras de un proyecto van **de una en una** (`serial` en `lib/mutations.ts`): dos movimientos seguidos no
  pueden adelantarse. Al acabar la última pendiente se vuelve a pedir el tablero para recoger lo que calculó el
  servidor (claves de orden, `completedAt`).
- Cada acción avisa con `notify` y su «Deshacer» hace la inversa: mover de vuelta a su columna e índice, restaurar
  los valores anteriores, quitar lo creado (se **archiva**; la UI no borra tareas), recrear una columna con sus
  tareas en su orden.
- El core ofrece lo que hace falta para deshacer: `tasks.restore`, `checklist.add(..., { done, index })` y
  `columns.delete` devolviendo los ids movidos.
- Realtime de Supabase **no** se activa todavía: es su propia fase (ver [ROADMAP](../ROADMAP.md)). Mientras, la
  caché se refresca al volver a la pestaña.

## Alternativas consideradas

- **`useMutation` con `onMutate` por acción:** más ceremonia para lo mismo, y su `scope` serializa por id de
  mutación, no por proyecto con rollback propio.
- **Esperar al servidor:** latencias de segundos con Supabase.
- **Diálogos de confirmación:** descartados por ADR-0019.

## Consecuencias

- Si falla una escritura con otras en cola, la vuelta atrás restaura el estado anterior a esa acción y el refresco
  final reconcilia el resto.
- «Deshacer» de un movimiento devuelve la tarjeta a su **índice**, no a su clave exacta: el orden relativo es el
  mismo, y completar/reabrir vuelve a fijar `completedAt` con la hora del deshacer.
- Relacionado: [ADR-0006](0006-orden-con-fractional-indexing.md), [gotchas/web](../gotchas/web.md).
