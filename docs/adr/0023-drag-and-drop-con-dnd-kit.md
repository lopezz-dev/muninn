# ADR-0023: Drag & drop del tablero con dnd-kit

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web

## Contexto

El tablero necesita mover tarjetas entre columnas y reordenar columnas, con **ratón, tacto (iPhone, PWA) y
teclado**, y sin engordar el JS inicial ([ADR-0020](0020-tanstack-router-carga-diferida.md)). Medido con
esbuild (minificado, sin React):

| Librería | min | gzip | Tacto | Teclado |
|---|---|---|---|---|
| `@dnd-kit/core` + `sortable` + `utilities` | 48,7 kB | 16,7 kB | Sensor propio con pulsación larga configurable | Incluido (Espacio, flechas), con avisos para lectores de pantalla |
| Pragmatic drag and drop (+ hitbox + auto-scroll) | 33,3 kB | 9,8 kB | Arrastre nativo de HTML5: en iOS funciona con pulsación larga, pero la vista previa y el auto-scroll son limitados | Ninguno: habría que construirlo |
| `@dnd-kit/react` (0.x) | 118,9 kB | 39,3 kB | Como dnd-kit | Como dnd-kit |

## Decisión

- **`@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 + `@dnd-kit/utilities`**, con versiones exactas.
- Sensores: `MouseSensor` (distancia de 6 px, para que un clic siga siendo un clic), `TouchSensor` (250 ms de
  pulsación y 8 px de tolerancia, para no pelear con el scroll) y `KeyboardSensor` (Espacio recoge y suelta,
  flechas mueven, Escape cancela; **Enter no**, porque las tarjetas son enlaces y Enter las abre).
- Las tarjetas son `<a>` ordenables (`role="link"` en vez de `button`) y las columnas se arrastran por su asa.
  El teclado entre columnas usa un `coordinateGetter` propio (`screens/tablero/dnd.ts`), porque el de
  `@dnd-kit/sortable` no sabe que una tarjeta puede cambiar de columna.
- Escritorio: columnas en fila y arrastre entre ellas. **Móvil** (< 768 px): pestañas de columnas y lista;
  mantener pulsado reordena, soltar sobre otra pestaña cambia de columna, y deslizar a la izquierda completa
  (M-Tablero.dc.html). Se elige con `matchMedia` (no con CSS, como el shell) porque montar dos contextos de
  arrastre a la vez no tiene sentido.
- Mientras se arrastra, el reparto de tarjetas es una copia local; al soltar se escribe **una sola vez**
  (`tasks.move` o `columns.move`). El orden lo calcula siempre el core ([ADR-0006](0006-orden-con-fractional-indexing.md)).
- La librería vive en el chunk del tablero: no se añade a ningún grupo de `codeSplitting`.
- El límite de tareas de una columna (WIP) **avisa pero no impide**.

## Alternativas consideradas

- **Pragmatic drag and drop:** más ligera, pero sin teclado ni tacto fino en iPhone; el trabajo que ahorra en
  kilobytes lo gasta en accesibilidad.
- **`@dnd-kit/react`:** API aún en 0.x y 70 kB más.
- **Botones «mover a la izquierda/derecha» como única vía:** son un complemento (están en el menú de columna),
  no sustituyen al arrastre.

## Consecuencias

- El chunk del tablero pesa unos 75 kB (dnd-kit incluido); el JS inicial no crece por la librería.
- dnd-kit 6 tiene poco mantenimiento. Si se queda atrás, la salida es `@dnd-kit/react` cuando llegue a 1.0.
- Relacionado: [ADR-0025](0025-escrituras-optimistas-y-deshacer.md), [gotchas/web](../gotchas/web.md),
  `apps/web/src/screens/tablero/`.
