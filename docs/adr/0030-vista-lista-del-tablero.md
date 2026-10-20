# ADR-0030: Vista Lista del tablero: la misma consulta, sin arrastre, recordada por dispositivo

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web

## Contexto

El diseño del tablero (Tablero.dc.html) tiene un selector Tablero · Lista · Calendario. La F2 pide la Lista: ver las tareas de un
proyecto en filas, con los filtros que ya existen. Hay que decidir de dónde salen los datos, qué se puede hacer en ella y dónde
se guarda la vista elegida.

## Decisión

- **Misma fuente de datos:** la Lista pinta la entrada de caché del tablero (`keys.board`, [ADR-0025](0025-escrituras-optimistas-y-deshacer.md))
  y los mismos filtros (`lib/board-filter.ts`), agrupada por columna en el orden del tablero. No hay consulta nueva ni datos nuevos.
- **Sin arrastre:** ni reordenar ni cambiar de columna arrastrando. En la fila: casilla para completar o reabrir (las acciones
  optimistas de siempre, con «Deshacer»), el título como enlace al detalle y los datos de la tarea. Cada grupo se pliega y tiene
  su «Añadir tarea» (menos el de tipo `done`, como en el tablero).
- **Un chunk diferido** (`screens/tablero/BoardList.tsx`, con `lazy`): solo lo descarga quien abre la lista.
- **La vista se recuerda por proyecto y por dispositivo en localStorage** (`muninn.boardView`, `lib/board-view.ts`), no en
  `user_settings.preferences`. Es una comodidad de quien mira (en el móvil puede preferirse la lista), no un dato de la cuenta.
  Se guarda solo «Lista» (lo de por defecto no ocupa) y como mucho 200 proyectos.
- **Calendario no entra todavía:** necesita decidir cómo se arrastra una fecha y dónde van las tareas sin fecha; queda en el ROADMAP.

## Alternativas consideradas

- **Guardar la vista en `user_settings.preferences`:** te seguiría entre dispositivos, pero cada cambio sería una escritura con su
  cola y su «Deshacer», y la vista que conviene depende de la pantalla.
- **Vista en la URL (`?vista=lista`):** compartible, pero el enlace a un proyecto no la recordaría al volver desde el menú.
- **Arrastre también en la lista:** duplica la lógica de dnd-kit (índices con filtro, accesibilidad) para un caso que el tablero ya cubre.

## Consecuencias

- Una mejora de los filtros o del tablero (contadores, límites WIP) llega sola a la lista.
- En un dispositivo nuevo, todo proyecto empieza en «Tablero».
- Relacionado: [gotchas/web](../gotchas/web.md), `lib/board-view.ts`, `screens/tablero/BoardList.tsx`.
