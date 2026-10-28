# ADR-0024: Detalle de tarea como ruta, con panel en escritorio y pantalla en móvil

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web

## Contexto

El diseño pinta el detalle como un panel lateral sobre el tablero en escritorio (Tarea.dc.html) y como pantalla
completa en móvil (M-Tarea.dc.html). Un panel con solo estado local no se puede compartir ni recargar, y en
el móvil el botón «atrás» sacaría del tablero en lugar de cerrar la tarea.

## Decisión

- Ruta propia `/proyectos/$projectId/tareas/$taskId`, **hija del tablero** (`router.tsx`). Es un enlace
  compartible, sobrevive a una recarga y «atrás» cierra la tarea.
- Una sola ruta con dos presentaciones (`screens/TareaDetalle.tsx`): en escritorio, `SheetContent` sobre el
  tablero (que sigue pintado); en móvil, pantalla completa (el tablero no se pinta, y el dock se oculta para dejar
  sitio a la barra «Mover a… / Completar»).
- El tablero y el detalle comparten la entrada de caché `keys.board(projectId)`: una tarea se lee de ahí, así que
  lo que se mueve o edita se ve en los dos a la vez.
- Una tarea archivada o inexistente muestra «No encontramos esta tarea».
- Al cerrar el panel, el foco vuelve a la tarjeta de la que se abrió.

## Alternativas consideradas

- **Sheet sin ruta:** más simple, pero sin enlace y con «atrás» roto en móvil.
- **Pantalla propia siempre:** pierde el contexto del tablero que enseña el diseño de escritorio.

## Consecuencias

- Hay que mantener a mano la lista de rutas con prefijo (`/_app/proyectos/$projectId/tareas/$taskId`) y el
  `immersive` del shell (`AppShell.tsx`), que reconoce esa URL para ocultar el dock.
- Relacionado: [ADR-0020](0020-tanstack-router-carga-diferida.md), [ADR-0021](0021-shell-de-la-app.md).
