# ADR-0071: En escritorio la guía de Documentación cabe en la ventana, con «Anterior / Siguiente» fijo y el texto más ancho

- **Estado:** Aceptado
- **Fecha:** 2026-10-30
- **Área:** web, docs
- **Reemplaza a:** ADR-0052, en parte (la guía centrada con tope de 760 px)

## Contexto

Con el [ADR-0052](0052-documentacion-con-grupos-iconos-y-portada.md), una guía abierta en escritorio era una pantalla
sin `fit` ([ADR-0050](0050-scroll-dentro-de-la-pantalla-en-escritorio.md)): hacía scroll entera, con el índice y
«En esta página» `sticky`. Para pasar a la siguiente guía había que bajar hasta el final del texto. Además, el texto
se centraba con un tope de 760 px entre el índice y «En esta página», y en una pantalla de 1920 px quedaban casi
200 px vacíos a cada lado, con separaciones de 48 px entre columnas. Alex quiere que se lea como una app de
escritorio: todo a la vista y aprovechando el ancho.

## Decisión

- **En escritorio (≥ 768 px), con una guía abierta, la pantalla es `Page fit`.** El índice de la izquierda,
  el texto y «En esta página» tienen cada uno su scroll. El texto hace scroll en `#guia` y **«Anterior / Siguiente»
  queda fijo debajo**, fuera de ese scroll. El pie del índice («Versión… · generada desde docs/user») va abajo del todo.
- **El router devuelve `#guia` arriba al cambiar de guía** (`scrollToTopSelectors`), igual que `#contenido`, y
  recuerda su posición (`data-scroll-restoration-id`).
- **Columnas más juntas y texto más ancho:** 32 px entre columnas (antes 40–48), el texto ya no se centra y su tope
  pasa a 1000 px; «En esta página» va justo a su lado. Lo que sobre en pantallas muy anchas queda a la derecha del todo.
- **En el móvil no cambia nada:** hace scroll la página y «Anterior / Siguiente» va al final del texto.
- La portada de Documentación no cambia (sin `fit`, hace scroll entera).

## Alternativas consideradas

- **Solo «Anterior / Siguiente» `sticky` abajo dentro de `<main>`:** funciona, pero el índice y «En esta página»
  seguirían dependiendo de `sticky` con un `max-h` calculado a mano, y la barra tapa el final del texto si no se
  reserva su alto. Con `fit` cada columna mide lo que debe.
- **Mantener el tope de 760 px y solo reducir los huecos:** el hueco no venía de los `gap`, sino del centrado
  dentro de una columna de más de 1000 px.
- **Texto sin tope:** en monitores grandes las líneas pasan de 150 caracteres y cuesta seguirlas.

## Consecuencias

- Positivas: se cambia de guía sin bajar; los tres paneles se ven siempre; el texto aprovecha el ancho.
- Negativas / costes: líneas más largas que la medida de lectura del ADR-0048 (unos 120 caracteres a 1000 px). Lo
  que escuche el scroll de una guía en escritorio tiene que mirar `#guia`, no `#contenido` (ver docs/gotchas/web.md).
- Relacionado: [ADR-0048](0048-pantallas-a-todo-el-ancho-y-alto.md), [ADR-0050](0050-scroll-dentro-de-la-pantalla-en-escritorio.md),
  [ADR-0052](0052-documentacion-con-grupos-iconos-y-portada.md), `apps/web/src/screens/Documentacion.tsx`,
  `apps/web/src/screens/DocPagina.tsx`, `apps/web/src/router.tsx`.
