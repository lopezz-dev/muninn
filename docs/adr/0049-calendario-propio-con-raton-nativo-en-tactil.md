# ADR-0049: Fechas con un calendario propio con ratón y el selector nativo en táctil

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Área:** ui, web

## Contexto

Las fechas (movimiento, próximo cobro de una suscripción, vencimiento de una tarea) usaban
`<input type="date">`. En el móvil eso es lo mejor: la rueda de iOS o el calendario de Android. Pero en el
escritorio, el selector de Chromium y Edge desentona: es claro sobre el tema oscuro, va en inglés
(«Su Mo Tu», «Today», «Clear») aunque la app esté en español, empieza la semana en domingo, enseña la fecha
como `10/27/2026` y no respeta el cristal ni el acento.

## Decisión

- **`DateField` y `DatePicker` en `@muninn/ui`** (`components/date-field.tsx`). Con ratón muestran un botón
  con la fecha en español («Mar, 27 oct 2026») que abre un `Popover` de Radix con un `Calendar` propio. El
  calendario está en español, empieza la semana en lunes y siempre tiene seis filas (no salta de alto al
  cambiar de mes). Marca hoy con un punto de acento y tiene «Hoy» y, si se pide, «Quitar fecha».
- **Con puntero grueso (`pointer: coarse`) se usa el `<input type="date">` nativo.** Se decide por el puntero
  y no por el ancho: una tableta con ratón recibe el calendario, y un portátil táctil sin ratón, el nativo.
- **Teclado completo:** flechas (día y semana), Inicio/Fin (semana), RePág/AvPág (mes; con Mayús, año) y
  Enter. El foco va al día elegido al abrir y vuelve al campo al cerrar. Las fechas se calculan en UTC sobre
  `AAAA-MM-DD`, así que el día no se mueve con la zona horaria.
- **Animación:** solo la de entrada del popover (`animate-pop-in`, 180 ms ease-out), creciendo desde el campo
  (`--radix-popover-content-transform-origin`). Cambiar de mes no anima: se hace muchas veces y con teclado.
- Toda fecha nueva de la interfaz usa `DateField` (formularios) o `DatePicker` (un botón propio, como el
  vencimiento en el detalle de tarea). No vuelvas a `<input type="date">` a pelo.

## Alternativas consideradas

- **Estilar el nativo** (`color-scheme: dark`, `::-webkit-calendar-picker-indicator`): arregla el color,
  pero no el idioma, el lunes ni el formato, que dependen del navegador y del sistema.
- **Una librería** (react-day-picker): resuelve lo mismo, pero añade una dependencia y su CSS para un
  componente de unas 300 líneas que ya encaja con nuestros tokens, Radix y el modo cristal.
- **El calendario propio también en el móvil:** en el iPhone, la rueda nativa es más cómoda con el pulgar
  y ya la conoce todo el mundo.

## Consecuencias

- Positivas: el escritorio se ve como el resto de la app, en español y con la semana europea.
- Negativas / costes: el calendario es nuestro, así que su accesibilidad y su teclado también (los cubre
  `packages/ui/test/date-field.test.tsx`). No tiene selector rápido de año: para fechas lejanas se usa
  Mayús+RePág/AvPág.
- Relacionado: [ADR-0017](0017-componentes-radix-cva.md) (componentes sobre Radix),
  [ADR-0015](0015-modo-cristal.md) (cristal).
