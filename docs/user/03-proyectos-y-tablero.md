---
title: Proyectos y tablero
description: Organiza tu trabajo en proyectos con un Kanban a tu medida.
order: 3
status: parcial
---

# Proyectos y tablero

> **Estado:** ya puedes crear proyectos, mover tareas arrastrándolas, personalizar las columnas y ver el tablero como
> lista. La vista de calendario y el color de las columnas llegarán más adelante. En modo demo,
> sin cuenta, lo que hagas no se guarda (ver [Moverte por Muninn](08-moverte-por-muninn.md)).

## Proyectos

Un proyecto agrupa las tareas y notas de algo en lo que estás trabajando: una app, un cliente, una mudanza…

Cada proyecto tiene:
- **Nombre, descripción, color e icono.**
- **Estado:** activo, pausado o archivado. Los archivados desaparecen de las listas, pero no se borran.
- **Repositorio de GitHub** (opcional, en formato `usuario/repositorio`, desde **Ajustes › Integraciones**): las issues
  de ese repo aparecerán como tareas del proyecto cuando la sincronización esté en marcha (ver [GitHub](09-github.md)).

## El tablero

Cada proyecto tiene su propio tablero Kanban. Al crearlo empieza con cinco columnas:

**Backlog → Pendiente → En curso → Revisión → Hecho**

### Personalizar las columnas

Desde el menú **⋯** de cada columna puedes **editarla** (nombre, tipo y límite), **moverla** a la izquierda o a la
derecha y **borrarla**. Con **Añadir columna** creas una nueva al final. También puedes reordenarlas arrastrándolas
por el asa de su cabecera.

El **límite** es el número de tareas que quieres tener a la vez en esa columna (útil para no tener demasiadas cosas
"en curso"). Cuando lo alcanzas, el contador se pone en ámbar, y en rojo si lo superas. Es un aviso: Muninn no te
impide mover más tarjetas.

Cada columna tiene además un **tipo**, que le dice a Muninn qué significa, la llames como la llames:

| Tipo | Significa |
|---|---|
| Backlog | Ideas o trabajo sin planificar |
| Por hacer | Planificado, pendiente de empezar |
| En curso | Trabajando en ello |
| Revisión | Esperando revisión o validación |
| Hecho | Terminado |

Gracias al tipo, si llamas a tu última columna "Publicado", Muninn sabe que lo que hay ahí está terminado
y lo cuenta así en los resúmenes.

### Borrar una columna

Si la columna tiene tareas, eliges a qué columna pasan (**Borrar y mover sus tareas a…**). Un proyecto siempre necesita
al menos una columna. No hay diálogo de confirmación: pulsa **Deshacer** en el aviso y la columna vuelve, con sus tareas.

## Tablero o lista

Arriba del tablero tienes **Tablero · Lista**. La lista enseña las mismas tareas, agrupadas por columna, una por fila:

- La **casilla** de cada fila la completa (o la reabre si ya está hecha), con su aviso y **Deshacer**.
- Un clic en el título abre la tarea, igual que en el tablero. Para cambiarla de columna, hazlo desde la tarea.
- Cada grupo se pliega con un clic en su cabecera y tiene su **Añadir tarea** al pie (menos «Hecho»).
- En la lista no se arrastra: para reordenar tarjetas, vuelve al tablero.
- Los filtros valen para las dos vistas.
- Muninn recuerda la vista que elegiste **en cada proyecto y en cada dispositivo**: puedes tener la lista en el móvil y el
  tablero en el ordenador.

## Filtrar el tablero

En el ordenador, sobre las columnas hay una barra de filtros: un campo de texto («Filtrar tareas…») y los menús **Prioridad**,
**Etiquetas**, **Origen** (manual, asistente, GitHub o agente) y **Vence** (vencidas, hoy, próximos 7 días, más adelante o sin
fecha). En el móvil, el botón del embudo de arriba abre una hoja con lo mismo.

- El texto busca en el título, la descripción y las etiquetas, sin importar mayúsculas ni tildes; si escribes varias palabras,
  la tarea debe tenerlas todas.
- En cada menú puedes marcar **varias opciones**: vale cualquiera de ellas. Entre menús distintos se piden todos: «Prioridad: alta»
  y «Vence: hoy» enseña las tareas altas **y** de hoy.
- Arriba verás cuántas tareas se ven, por ejemplo «2 de 9 tareas», y **Quitar filtros** las vuelve a mostrar todas.
- Los contadores y los límites de las columnas siguen contando **todas** las tareas, también las ocultas.
- **Puedes arrastrar con un filtro puesto.** La tarjeta se coloca justo debajo de la que tienes encima; las tareas ocultas
  conservan su sitio.
- Los filtros se quedan al abrir y cerrar una tarea, pero no al recargar la página.

## Mover tarjetas

- **Con el ratón:** arrastra la tarjeta a otra columna o a otra posición. Un clic abre la tarea.
- **Con el dedo:** mantén pulsada la tarjeta y arrástrala. En el móvil verás una pestaña por columna: suelta la tarjeta
  sobre otra pestaña para cambiarla de columna, o desliza la tarjeta a la izquierda para completarla.
- **Con el teclado:** enfoca la tarjeta con **Tab**, pulsa **Espacio** para recogerla, muévela con las **flechas**
  y vuelve a pulsar **Espacio** para soltarla (**Esc** cancela). **Intro** abre la tarea.

Cada movimiento te lo confirma un aviso con **Deshacer**, que devuelve la tarjeta a donde estaba.
