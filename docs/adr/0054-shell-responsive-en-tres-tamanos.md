# ADR-0054: Shell en tres tamaños: barra de pestañas en el teléfono, raíl en tablet y barra lateral en el ordenador

- **Estado:** Reemplazado por ADR-0072 en las pestañas del teléfono, el botón del Asistente y «Más»; lo demás sigue vigente
- **Fecha:** 2026-10-28
- **Área:** web, ui
- **Reemplaza a:** [ADR-0021](0021-shell-de-la-app.md) en lo que toca al móvil (el dock con menisco) y al corte de la barra lateral

## Contexto

En el iPhone la app se veía mal: Inicio se salía por la derecha, cuatro tarjetas grandes con ceros se comían la
pantalla, las mismas tareas salían dos veces («En curso» y «Próximos días») y el dock con menisco ocupaba casi 150 px
abajo, con las pestañas sin nombre salvo la activa. Además, el shell solo conocía dos tamaños: en un iPad en vertical
(768–1023 px) la barra lateral de 240 px dejaba el contenido en poco más de 500 px.

El nuevo diseño está en el lienzo «Muninn — Móvil 2.0» (enlace en docs/ROADMAP.md). Al revisarlo, el autor pidió
esquinas «cuadradas con un redondeo sutil» (los radios de siempre, nada de píldoras), el logo de Muninn para el
Asistente en lugar del destello, y que todo funcione en los tres tipos de dispositivo.

## Decisión

- **Tres tamaños, cortes de Tailwind:**
  - **Teléfono (< 768 px, sin prefijo / `max-md:`):** barra de pestañas flotante abajo (`shell/TabBar.tsx`). Cuatro
    pestañas con icono **y nombre** (Inicio, Proyectos, Finanzas, Más; las de un módulo apagado desaparecen) y, aparte,
    un botón cuadrado de 62 px con el **logo de Muninn** que abre el Asistente. Radios del sistema: `rounded-dock`
    (12 px) en la barra y el botón, `rounded-lg` en cada pestaña.
  - **Tablet (768–1023 px, `md:`):** la barra lateral es un **raíl de iconos** de 64 px con zonas de 44 px; los
    nombres quedan como `sr-only` y salen en un tooltip a la derecha. Los proyectos no caben y se llega a ellos desde
    Proyectos.
  - **Ordenador (≥ 1024 px, `lg:`):** la barra lateral completa de 240 px, como hasta ahora.
- **El Asistente no es una pestaña:** tiene su botón propio, siempre a un toque. Lo que no tiene pestaña (Notas,
  Noticias, GitHub, Documentación, Ajustes) sigue viviendo en «Más» y marca esa pestaña (`tabIndexOf` en `nav.ts`).
- **La barra se encoge al bajar** por la página (queda solo la pestaña activa) y vuelve al subir o cerca del
  principio. Encogida, el primer toque solo la despliega. Es una transición CSS de `flex-basis`; con «Reducir
  movimiento» no se anima.
- **Las pantallas piensan en anchos de tarjeta, no solo de ventana.** Una rejilla siempre declara sus columnas desde el
  tamaño más pequeño (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`); una fila que vive en tarjetas de distinto ancho usa
  consultas de contenedor (`@container` y `@md:`), como las filas de tarea de Inicio.
- **En el teléfono, `<main>` lleva `overflow-x: clip`** como red de seguridad: nada puede arrastrar la pantalla hacia
  los lados. `clip` no crea contenedor de scroll, así que los `sticky` y el scroll de la ventana (ADR-0050) no cambian.
- Se mantiene del ADR-0021: un solo shell, los tamaños se cambian por CSS y no por JS (salvo el tooltip del raíl, que
  solo decide si se pinta), el foco a `<main>` al cambiar de sección y el buscador ⌘K.

## Alternativas consideradas

- **Mantener el dock con menisco:** era lo aprobado, pero sin nombres en las pestañas, alto y con mucha animación en JS
  (`dock-geometry.ts`) para una barra que debe pasar desapercibida.
- **Asistente como quinta pestaña:** con cinco pestañas y nombres, en 358 px no caben con holgura, y el Asistente
  es una acción («pregunta») más que un sitio.
- **El dock también en tablet:** en un iPad sobra ancho para un raíl, que además se parece más al ordenador.
- **Barra lateral completa desde 768 px (lo de antes):** en un iPad en vertical deja el contenido demasiado estrecho.
- **Arreglar el desbordamiento solo pantalla a pantalla:** hace falta igualmente (las rejillas con `grid-cols-1`),
  pero sin la red de seguridad cualquier pantalla nueva puede volver a romper el teléfono.

## Consecuencias

- Positivas: el teléfono gana unos 40 px de alto útil y las pestañas se entienden sin tocarlas. El iPad tiene su propio
  diseño. Desaparecen `Dock.tsx`, `dock-geometry.ts` y su animación fotograma a fotograma.
- Negativas / costes: hay que probar cada pantalla en tres anchos (390, 820 y 1280 px). `overflow-x: clip` esconde un
  desbordamiento en vez de enseñarlo: si algo se ve cortado por la derecha en el teléfono, la causa es la misma de
  siempre (ver docs/gotchas/web.md). El resto de pantallas del lienzo nuevo (tablero, detalle de tarea, hojas) llega
  por fases (docs/ROADMAP.md).
- Relacionado: [ADR-0021](0021-shell-de-la-app.md), [ADR-0048](0048-pantallas-a-todo-el-ancho-y-alto.md),
  [ADR-0050](0050-scroll-dentro-de-la-pantalla-en-escritorio.md), `apps/web/src/shell/TabBar.tsx`,
  `apps/web/src/shell/Sidebar.tsx`, `apps/web/src/shell/nav.ts`, `apps/web/src/screens/Inicio.tsx`.
