# ADR-0019: Toda acción da feedback: notificaciones en píldora con «Deshacer»

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** ui

## Contexto

Al revisar la galería, el autor detectó que acciones como «Copiar enlace» o «Mover a…» no confirmaban nada:
el usuario no sabe si funcionaron. Además, el diseño de referencia muestra una píldora («Done: … · Undo»)
en la parte superior, en línea con la «isla» del diseño.

## Decisión

- **Regla de producto:** toda acción del usuario que cambie algo o tenga efecto fuera de la pantalla (copiar,
  mover, crear, archivar, sincronizar) muestra una notificación. Las acciones que cambian o destruyen datos
  ofrecen **«Deshacer»** en lugar de un diálogo de confirmación. Los errores se pueden cerrar a mano y duran más.
- **Componente:** `notify.success | error | info | loading | promise | dismiss` y `<Toaster />` de `@muninn/ui`.
  Por debajo usa **Sonner** (pila, deslizar para descartar, región `aria-live`, pausa al pasar el ratón), y el
  aspecto es nuestro: `NotificationPill`, una píldora de cristal de 40 px arriba en el centro, con icono por tono.
- **Icono animado que resalta la acción:** con `icon`, el icono de la acción (enlace, mover, archivar…) hace su
  gesto y se transforma en un check que se dibuja, rematado por un anillo que se expande una vez. Cada tramo dura
  menos de 300 ms, con curvas `ease-strong`, en CSS (fuera del hilo principal). El error niega con un temblor
  lateral, y al terminar una carga solo se dibuja el check, sin repetir la entrada.
- **Duraciones:** 4 s, 6 s con acción o en error, y la de carga dura hasta resolverse (`notify.promise`).
- **Portapapeles:** `copyText()`, con alternativa para contextos sin la API asíncrona, que devuelve si funcionó
  para mostrar éxito o error.
- La app nunca importa `sonner` directamente (como con los iconos: [ADR-0016](0016-iconos-phosphor-y-geist.md)).

## Alternativas consideradas

- **Radix Toast:** más bajo nivel. La pila, los gestos y las animaciones habría que hacerlos a mano.
- **Diálogos de confirmación para lo destructivo:** interrumpen. «Deshacer» es más rápido y igual de seguro si
  la operación es reversible (archivar y la actividad lo permiten).
- **Notificaciones abajo a la derecha:** en móvil chocan con el dock, y arriba en el centro encaja con la «isla».

## Consecuencias

- Cada acción nueva en la UI necesita su `notify` (lo exige `CLAUDE.md`).
- «Deshacer» obliga a que las operaciones del core sean reversibles: archivar en vez de borrar, o mover de vuelta
  con su posición anterior.
- El centro de notificaciones persistente (campana, historial, push) es otra cosa y queda en el roadmap.
