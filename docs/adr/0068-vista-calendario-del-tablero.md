# ADR-0068: Vista Calendario del tablero: arrastrar cambia solo la fecha, bandeja «Sin fecha» y móvil sin arrastre

- **Estado:** Aceptado
- **Fecha:** 2026-10-30
- **Área:** web, ui
- **Reemplaza a:** la parte «Calendario no entra todavía» de [ADR-0030](0030-vista-lista-del-tablero.md) (la Lista sigue igual)

## Contexto

El selector del tablero ya tenía Tablero · Lista ([ADR-0030](0030-vista-lista-del-tablero.md)). El Calendario se quedó fuera
porque faltaba decidir **cómo se arrastra una fecha** y **dónde van las tareas sin fecha**. El diseño se validó el 30 de octubre
en el lienzo «Muninn — Calendario» (https://claude.ai/artifact/5a4s3wiHqsZVG88jZKwAMB), con estas decisiones elegidas.

## Decisión

- **Misma fuente de datos, ningún dato nuevo en el core.** El calendario pinta la caché del tablero (`keys.board`) con los mismos
  filtros (`lib/board-filter.ts`), y coloca cada tarea en el día de su `dueDate`. No hay consulta por rango de fechas: el
  tablero ya trae todas las tareas del proyecto. Los cálculos (rejilla, orden del día, atajos de fecha, teclado) viven en
  `lib/calendar.ts`, con tests.
- **Mes y Semana.** El mes tiene seis filas que empiezan en lunes (como el `Calendar` de ADR-0049). Cada día enseña hasta tres
  píldoras; si no caben, dos y «+N más», que abre un desplegable con todas. La semana enseña las tarjetas de siempre (`CardBody`).
- **Arrastrar cambia solo la fecha**, nunca la columna. Soltar en un día escribe `dueDate` con `setDueDate` (`patchTask`,
  optimista y con «Deshacer», [ADR-0025](0025-escrituras-optimistas-y-deshacer.md)), y el aviso dice cuándo vence («Vence el
  mié 4 nov»). Quedarse 600 ms sobre ‹ o › cambia de mes o de semana durante el arrastre.
- **Sin orden propio dentro de un día:** primero las pendientes, luego por prioridad, por columna y por su orden en la columna.
  El modelo no tiene un orden por día, y no se inventa.
- **Tareas sin fecha en una bandeja lateral** plegable. Sus tarjetas se arrastran a un día, y soltar una tarea en la bandeja le
  **quita** la fecha.
- **Hechas a la vista**, atenuadas y tachadas. Vencida = fecha pasada y sin hacer (`isOverdue`, la misma regla que el filtro):
  texto en rojo y un contador «N vencidas» que activa el filtro «Vence: Vencidas».
- **Crear en un día:** el «+» del día (o un clic en su hueco) abre `AddTaskPopover`. Tiene la fecha ya puesta y la columna por
  defecto (la primera «Por hacer», sin la del agente ni las de tipo hecho), y Enter crea y deja el campo abierto. «Más opciones…»
  abre el diálogo de Nueva tarea, que ahora acepta `dueDate` en `NewTaskPreset`.
- **Teclado:** Espacio recoge y suelta, ← → mueven un día, ↑ ↓ una semana, S lleva a «Sin fecha», Escape cancela y Enter abre
  la tarea. Con teclado, el destino no lo decide la geometría (la tarjeta flotante es más ancha que una celda): lo lleva una
  referencia que empieza en el día de la tarea.
- **Móvil (< 768 px) sin arrastre:** mes compacto con puntos y la lista del día elegido. Para cambiar la fecha, el botón del
  calendario de cada tarea o mantenerla pulsada abren la hoja «Cambiar fecha»: Hoy, Mañana, Próximo lunes, En una semana, otra
  fecha (`DateField`, nativo en táctil por ADR-0049) y Quitar fecha. Deslizar a la izquierda completa, como en el tablero
  (`SwipeToComplete`, ahora en su propio fichero). «Sin fecha · N» abre una hoja con esas tareas.
- **Sin conexión, solo lectura** ([ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md)): el arrastre, los «+» y la hoja de fecha
  se desactivan (`useOnline`) en lugar de dejar intentarlo y deshacerlo. Cuando llegue ADR-0034, se reactivan.
- **Un chunk diferido** (`screens/tablero/BoardCalendar.tsx`, con `lazy`), como la Lista. Mientras llega se pinta la rejilla con
  fantasmas.
- **Se recuerda con la vista** en `muninn.boardView`: `calendar` (mes) o `calendar-week` (semana). El mes o la semana que se ve
  no se guarda: siempre abre en hoy.
- `@muninn/ui` gana un `Popover` genérico (`components/popover.tsx`) y `Tooltip` acepta `disabled` (se cierra mientras se arrastra
  sin volver a montar el disparador).

## Alternativas consideradas

- **Franja «Sin fecha» encima de la rejilla:** le quita alto a las seis semanas, corta los títulos y no deja un destino cómodo para
  quitar la fecha.
- **Que soltar en un día cambie también la columna o el orden:** mezclaría dos gestos en uno, y el orden por día no existe en el
  modelo.
- **Consulta por rango de fechas en el core:** no hace falta mientras el tablero cargue el proyecto entero. Si un día se pagina,
  se añade a `createMuninn` con test.
- **Arrastre también en el móvil:** en un mes de 46 px por día, el dedo pelea con el scroll y tapa el destino. La hoja con atajos
  es más rápida.
- **Agenda (lista continua por días) en el móvil:** es casi la Lista ordenada por fecha y pierde la vista de conjunto del mes.
- **Dejar intentar sin conexión y deshacer** (como hace hoy el tablero): en un calendario el gesto de arrastrar es largo y
  deshacerlo al final frustra más.

## Consecuencias

- Positivas: ninguna migración ni cambio en el core o el MCP. Las mejoras de los filtros llegan solas a las tres vistas.
- Negativas / costes: el teclado no cruza de mes (las flechas se paran en el borde de lo que se ve; con el ratón sí se cruza
  sobre ‹ ›). Con más de tres tareas en un día hay que abrir «+N más».
- Relacionado: [gotchas/web](../gotchas/web.md), `lib/calendar.ts`, `lib/board-view.ts`, `screens/tablero/BoardCalendar.tsx`,
  `screens/tablero/CalendarMobile.tsx`, `screens/tablero/CalendarParts.tsx`.
