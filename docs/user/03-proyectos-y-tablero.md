---
title: Proyectos y tablero
description: Organiza tu trabajo en proyectos con un Kanban a tu medida.
order: 3
status: parcial
group: tu-trabajo
icon: projects
---

# Proyectos y tablero

> **Estado:** ya puedes crear y editar proyectos (nombre, descripción, color, logo y portada), mover tareas arrastrándolas,
> personalizar las columnas y ver el tablero como lista o como calendario. El color de las columnas llegará más
> adelante. En modo demo, sin cuenta, lo que hagas no se guarda (ver [Moverte por Muninn](08-moverte-por-muninn.md)).

## Proyectos

Un proyecto agrupa las tareas y notas de algo en lo que estás trabajando: una app, un cliente, una mudanza…

En la pantalla **Proyectos** (en la barra lateral, o en las pestañas del móvil) cada proyecto tiene su tarjeta con:

- Su **logo**, su **portada** y su **color**. En el ordenador y la tablet la portada es el banner de la tarjeta, con el
  logo encima; en el teléfono se ve el logo. Sin portada, el banner es un degradado de su color; sin logo, verás la
  inicial del nombre sobre su color.
- La **descripción**, si tiene. Si no, en el ordenador puedes pulsar **+ Añade una descripción**.
- Una **barra de colores** con cuántas tareas hay en cada estado (backlog, pendientes, en curso, en revisión y hechas).
- **Avisos** de un vistazo: las tareas vencidas, las que están en curso, las que tiene el agente y el repositorio de
  GitHub. Si no hay nada que mirar, dice **Al día**.
- **Lo próximo:** las dos tareas que vencen antes (una en el teléfono).
- Cuándo fue la **última actividad**, y un botón **+ Tarea** para crear una directamente en ese proyecto.

Arriba ves cuántos proyectos tienes, cuántas tareas abiertas y cuántas vencidas. Puedes filtrar (**Todos**, **Con
vencidas** y, con GitHub activado, **Con GitHub**), ordenar por **urgencia**, **actividad reciente** o **nombre**, y buscar
por nombre en el ordenador. Al final, **Archivados** guarda los proyectos que archivaste: ábrelo y pulsa **Recuperar** para
traer uno de vuelta, o la papelera para **eliminarlo para siempre** (con **Eliminar todos** vacías la lista). Eliminar un
proyecto borra también sus columnas y tareas; sus notas se quedan, sin proyecto. Tienes unos segundos para pulsar
**Deshacer** en el aviso; después ya no se puede recuperar. Si cierras Muninn antes de que pasen, no se borra nada.

Pulsa una tarjeta para abrir su tablero.

### Crear un proyecto

Pulsa **Nuevo proyecto** (en Proyectos o en Inicio), el **+** de la barra lateral, o busca «nuevo proyecto» con **⌘K** /
**Ctrl K**. Escribe el **nombre** y, si quieres, una **descripción**, elige un **color**, un **logo** y una **portada**, y
pulsa **Crear proyecto**: se abre su tablero con cinco columnas. Si te equivocas, **Deshacer** en el aviso lo archiva.

### Editar un proyecto

Pulsa el lápiz de su tarjeta (**Editar** en el teléfono) o, en el tablero, **⋯ › Editar proyecto**. Puedes cambiar el
nombre, la descripción, el color, el logo y la portada. Cada cambio avisa al guardarlo y tiene **Deshacer**.

Sobre el **logo** y la **portada**:

- El **logo** es el icono del proyecto: mejor una imagen cuadrada. Si tiene fondo transparente, se ve sobre el color del
  proyecto. Al elegirlo, Muninn saca su color principal y lo pone como color del proyecto (la muestra **Del logo**), salvo
  que ya hubieras elegido otro color a mano. Puedes cambiarlo cuando quieras. Un logo en blanco y negro no propone color.
- La **portada** es el banner de la tarjeta en el ordenador y la tablet: mejor una imagen apaisada. Es opcional; sin ella,
  el banner usa el color del proyecto.
- Pueden ser fotos o archivos JPG, PNG o WebP. Muninn los reduce en tu dispositivo antes de subirlos, así que no importa
  que sea una foto grande del móvil.
- **Quitar** deja el proyecto sin esa imagen; **Deshacer** en el aviso la recupera.
- Solo los ves tú: se guardan en tu cuenta, en privado. Sin conexión, verás la inicial y el color en su lugar.
- En modo demo se pierden al recargar, como lo demás.

Desde aquí también puedes **archivar** el proyecto.

Si un [asistente de IA](06-asistentes-ia.md) crea el proyecto por ti, puede ponerle una descripción, pero no un logo ni una portada.

### El menú del proyecto

En el tablero, el menú **⋯** de arriba tiene:

- **Editar proyecto:** nombre, descripción, color, logo y portada.
- **Nueva columna:** añade una columna al final.
- **Copiar enlace:** copia la dirección del tablero, para abrirlo directamente o guardarlo.
- **Tareas archivadas:** las tareas que archivaste en este proyecto, para recuperarlas o eliminarlas para siempre (ver
  [Tareas](04-tareas.md#tareas-archivadas)).
- **Archivar proyecto:** desaparece de las listas, pero no se borra. **Deshacer** en el aviso lo recupera, y también
  **Proyectos › Archivados**. Si estaba vinculado a un repositorio de GitHub, deja de estarlo (el aviso te lo dice): así
  puedes vincular ese repositorio a otro proyecto. **Deshacer** intenta volver a vincularlo; si te pide el segundo factor,
  vincúlalo tú en **GitHub**.

### Vincular un repositorio de GitHub

Opcional, desde **Ajustes › GitHub**: cada proyecto puede ir con un repositorio, y sus issues aparecen como tareas
del proyecto y se mantienen al día solas (ver [GitHub](09-github.md)).

## El tablero

Cada proyecto tiene su propio tablero Kanban. Al crearlo empieza con cinco columnas:

**Backlog → Pendiente → En curso → Revisión → Hecho**

### Personalizar las columnas

Desde el menú **⋯** de cada columna puedes **editarla** (nombre, tipo y límite), **moverla** a la izquierda o a la
derecha y **borrarla**. Con **Columna**, arriba junto a **Nueva tarea** (o en el menú **⋯** del proyecto), creas una nueva
al final. También puedes reordenarlas arrastrándolas por el asa de su cabecera.

En el ordenador, las columnas se reparten el ancho de la pantalla y cada una hace scroll por dentro cuando tiene muchas
tareas: así ves el tablero entero de un vistazo.

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

## Tablero, lista o calendario

Arriba del tablero tienes **Tablero · Lista · Calendario**. La lista enseña las mismas tareas, agrupadas por columna, una por fila:

- La **casilla** de cada fila la completa (o la reabre si ya está hecha), con su aviso y **Deshacer**.
- Un clic en el título abre la tarea, igual que en el tablero. Para cambiarla de columna, hazlo desde la tarea.
- Cada grupo se pliega con un clic en su cabecera y tiene su **Añadir tarea** al pie (menos «Hecho»).
- En la lista no se arrastra: para reordenar tarjetas, vuelve al tablero.
- Los filtros valen para las tres vistas.
- Muninn recuerda la vista que elegiste **en cada proyecto y en cada dispositivo**: puedes tener la lista en el móvil y el
  tablero en el ordenador.

## El calendario

El calendario coloca cada tarea en el día en que vence. Siempre se abre en hoy.

### En el ordenador

- **Mes o semana.** Elige con **Mes · Semana**. Las flechas ‹ › cambian de mes (o de semana) y **Hoy** te devuelve al día de hoy.
  Muninn recuerda si lo dejaste en mes o en semana.
- **Cada tarea es una píldora** con el color de su columna y la bandera si es de prioridad media, alta o urgente. Las **vencidas**
  (la fecha ya pasó y no están hechas) salen en rojo; las **hechas**, tachadas. Pasa el ratón por encima para ver la tarjeta entera, y
  haz clic para abrirla.
- Si en un día no caben, verás **«+N más»**: ábrelo para verlas todas. Cuanto más alta sea la ventana, más tareas caben por día.
- El botón **«N vencidas»** filtra solo las vencidas (es el filtro **Vence › Vencidas**). Púlsalo otra vez para quitarlo.
- **Arrastra una tarea a otro día** para cambiar su fecha. Solo cambia la fecha: la tarea se queda en su columna. Te sale un aviso
  («Vence el mié 4 nov») con **Deshacer**. Si la dejas un momento sobre ‹ o ›, el calendario pasa al mes siguiente o al anterior.
- **Sin fecha.** Las tareas sin fecha están en la bandeja de la derecha (ábrela o ciérrala con **Sin fecha · N**). Arrastra una a un
  día para ponerle fecha, o suelta una tarea en la bandeja para **quitarle** la fecha. Cerrada, queda una tira estrecha a la derecha:
  también puedes soltar ahí. En el mes se abre sola si tiene tareas; en la vista **Semana** empieza cerrada, para que los días
  tengan sitio.
- **En la semana** cada tarea enseña su columna, sus etiquetas y sus subtareas. Los días sin tareas se estrechan para dejar sitio a los
  que tienen.
- **Crear en un día:** pulsa el **+** que aparece al pasar el ratón por un día (o haz clic en su hueco), escribe el título y pulsa
  Enter. La tarea nace con esa fecha, en la columna «Por hacer» (puedes elegir otra). **Más opciones…** abre el formulario completo.
- **Con el teclado:** ve con Tab hasta una tarea y pulsa **Espacio** para cogerla. Las flechas ← → la mueven un día y ↑ ↓ una semana,
  **S** la lleva a «Sin fecha» y **Espacio** la suelta. **Escape** cancela.
- Dentro de un día no se ordena a mano: primero las pendientes, luego por prioridad y por columna.

### En el móvil

- Arriba ves el mes, con un punto por tarea en cada día (rojo si está vencida). Toca un día para ver sus tareas debajo.
- **Solo esta semana** pliega el mes a la semana del día elegido y deja más sitio a sus tareas. Las flechas pasan entonces de
  semana en semana; **Ver el mes** lo despliega.
- Para **cambiar la fecha**, toca el botón del calendario junto a la tarea o mantenla pulsada. Elige **Hoy**, **Mañana**,
  **Próximo lunes**, **En una semana**, otra fecha o **Quitar fecha**. Siempre con **Deshacer**.
- **Desliza a la izquierda** para completarla, como en el tablero.
- **Añadir el …** crea una tarea en el día que tienes elegido. Si hay tareas sin fecha, **Sin fecha · N** abre su lista, y desde ahí
  puedes ponerles una.
- En el móvil no se arrastra en el calendario: con el dedo es más rápido elegir en la hoja.

> **Sin conexión** puedes mirar el calendario, pero no cambiar fechas ni crear tareas: esos botones desaparecen hasta que vuelva
> la red.

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
