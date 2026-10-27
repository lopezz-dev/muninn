# ADR-0047: En escritorio la pantalla cabe en la ventana y el scroll va dentro de las listas

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Área:** web, ui

## Contexto

Con el [ADR-0045](0045-pantallas-a-todo-el-ancho-y-alto.md) las pantallas ya ocupan todo el ancho y el alto, pero el
scroll seguía siendo de la página entera. En Movimientos, por ejemplo, al bajar por la lista desaparecían la cabecera,
los filtros y el formulario. En el tablero las columnas tenían 280 px fijos, así que con cinco o seis columnas había
que hacer scroll lateral, también para llegar a «Añadir columna», que iba al final. Queremos que, siempre que se
pueda, todo quepa en la ventana y que solo hagan scroll las listas que no caben.

## Decisión

- **En escritorio (≥ 768 px) la ventana no hace scroll; lo hace `<main>`.** El shell mide `h-dvh`, `<main>` lleva
  `overflow-y-auto` y `data-scroll-restoration-id`, y el router lo vuelve arriba al cambiar de pantalla
  (`scrollToTopSelectors: ['#contenido']`). En el móvil no cambia nada: hace scroll la página, que es lo que esperan
  Safari, el teclado y el dock.
- **`Page fit`:** la pantalla mide exactamente lo que deja `<main>` (`md:min-h-0`) y el bloque que crece lleva
  `min-h-0` y su propio `overflow-y-auto`. Sin `fit`, una pantalla más alta que la ventana hace scroll entera (dentro
  de `<main>`), como el Resumen de Finanzas o la Documentación. Si una pantalla con `fit` no cabe ni con sus listas al
  mínimo (una ventana muy baja), su contenido desborda y `<main>` hace scroll: nunca se corta nada.
- **Pantallas que caben:**
  - **Tablero:** las columnas se reparten el ancho (entre 240 y 360 px cada una) y las tarjetas hacen scroll dentro de
    su columna; la cabecera y «Añadir tarea» quedan a la vista. Solo hay scroll lateral si las columnas no caben ni a
    240 px. **«Columna»** pasa a la cabecera del proyecto (y a su menú ⋯): ya no está al final de la fila.
  - **Movimientos** (≥ 1024 px, con el formulario al lado): la lista de días hace scroll dentro de su tarjeta.
  - **Inicio** (≥ 1024 px): las filas de tarjetas se reparten el alto y cada lista hace scroll dentro de su tarjeta.
  - **Notas** y el **Asistente** ya funcionaban así, con su lista o su caja de escribir fijas (`sticky`).

## Alternativas consideradas

- **Scroll de la ventana con cabeceras `sticky`:** vale para una cabecera, pero no para dos columnas con listas
  independientes (movimientos y formulario, o varias columnas del tablero).
- **Alto fijo (`h-dvh`) en cada pantalla:** cortaría el contenido de las pantallas largas. Con `fit` opcional, cada
  pantalla decide.
- **Hacerlo también en el móvil:** en iOS, el scroll de un elemento interno pierde gestos del sistema (tocar la barra
  de estado para subir, la barra de Safari que se oculta) y choca con el dock. En el móvil, una sola columna con
  scroll de página es lo natural.

## Consecuencias

- Positivas: la cabecera, los filtros y las acciones no se van al bajar por una lista. El tablero se ve entero sin
  scroll lateral en una pantalla normal.
- Negativas / costes: en escritorio `window.scrollY` siempre es 0. Lo que escuche el scroll de la ventana o use
  `scrollTo` en escritorio tiene que mirar `#contenido` (ver docs/gotchas/web.md). Un `sticky` dentro de `<main>` se
  pega al borde de `<main>`, no de la ventana (es lo mismo a la vista).
- Relacionado: [ADR-0045](0045-pantallas-a-todo-el-ancho-y-alto.md), [ADR-0021](0021-shell-de-la-app.md),
  `apps/web/src/shell/AppShell.tsx`, `apps/web/src/components/Page.tsx`, `apps/web/src/router.tsx`.
