---
title: Notas
description: Apuntes que se leen y se editan en el mismo sitio, con comentarios, ordenados en carpetas y vinculados a proyectos y tareas.
order: 5
status: disponible
group: tu-trabajo
icon: notes
---

# Notas

Las notas sirven para todo lo que no es una tarea: ideas, actas de reuniones, documentación de un proyecto…
Se leen y se editan en el mismo sitio, ya con su formato, y se guardan solas mientras escribes. Por dentro son **Markdown**,
así que Claude y los demás asistentes las leen y las escriben sin problema.

> **Modo demo:** sin cuenta, tus notas solo viven en memoria y desaparecen al recargar la página.

## Dónde están

En el ordenador, **Notas** está en la barra lateral: la lista a la izquierda y la nota abierta a la derecha. En el móvil
está en **Ir a › Notas**, en la hoja de tu cuenta (o en la barra de abajo, si la pones ahí); al abrir una nota se ve a pantalla completa y la flecha de arriba te devuelve a la lista.

Cada nota tiene su propio enlace, así que puedes copiarlo o recargar la página sin perder el sitio.

## Carpetas y páginas dentro de otras

Las notas se ordenan en un **árbol**, como el índice de esta ayuda. Cada proyecto es un **espacio** con sus notas, y las
que no son de ningún proyecto van en **General**. Dentro de cada espacio, una página puede tener **páginas dentro**, a
cualquier nivel, y una **carpeta** es una página pensada para agrupar otras (puede tener texto o no).

- **Crear dentro:** pasa el ratón por una nota y pulsa **+**, o usa **⋯ › Nueva página dentro** o **Nueva carpeta dentro**.
  El **+** de la cabecera de un espacio crea una página en su primer nivel.
- **Mover:** arrastra una nota **sobre otra** para meterla dentro, o sobre su **borde de arriba o de abajo** para ponerla
  al lado. Suéltala en la **cabecera de un espacio** para llevarla a su primer nivel, también de otro proyecto. Siempre se
  mueve con todo lo que tiene dentro, y el aviso trae **Deshacer**. En el móvil, mantén pulsada la nota antes de arrastrar.
- **Plegar:** la flecha de una nota con páginas dentro las esconde o las enseña; se recuerda en este navegador.
- **Carpeta o página:** **⋯ › Convertir en carpeta** (o en página) solo cambia cómo se ve.

Al abrir una nota, arriba ves **dónde está** (Notas › espacio › las notas que la contienen) y al pie sus **páginas dentro**
y la **anterior** y la **siguiente** del árbol. Al buscar o filtrar por **Fijadas**, la lista deja el árbol y enseña los
resultados.

## Crear una nota

Pulsa el **+** de la lista (o **Nueva nota** si todavía no tienes ninguna) y escribe el título. Si tienes un proyecto
filtrado, la nota nace en ese proyecto. Si te equivocas, pulsa **Deshacer** en el aviso: la nota se archiva.

También puedes crearla desde una tarea, con **Añadir nota** en su panel: nace vinculada a esa tarea.

## Escribir

**En el ordenador** la nota se lee y se edita en el mismo sitio: pulsa en el texto y escribe. No hay modo de edición
ni vista previa.

- **Barra de arriba:** el tipo de bloque (**Texto** o **Título 1, 2 y 3**), **negrita**, *cursiva*, ~~tachado~~, código, enlace,
  listas con viñetas o numeradas, lista de tareas, cita, bloque de código, **tabla**, y **Deshacer** y **Rehacer**. Con el cursor
  dentro de una tabla, su botón añade o quita filas y columnas.
- **Al seleccionar texto** sale una barra encima con negrita, cursiva, tachado, código, enlace y **Comentar**.
- **Atajos:** **Ctrl B** negrita, **Ctrl I** cursiva, **Ctrl E** código, **Ctrl K** enlace (con texto seleccionado), **Ctrl Z**
  deshacer y **Ctrl Mayús Z** rehacer (en Mac, ⌘ en lugar de Ctrl). **Ctrl Alt M** (⌘ ⌥ M) comenta lo seleccionado.
- **Escribir como en Markdown:** `## ` al principio de una línea hace un título, `- ` una lista, `1. ` una lista numerada,
  `[ ] ` una tarea (también después de `- `), `> ` una cita y tres acentos graves un bloque de código.
- **Enlaces:** con el cursor dentro de un enlace ves su dirección, con **Abrir**, **Cambiar** y **Quitar**. **Ctrl clic** lo abre
  directamente.

**En el móvil** la nota se abre **para leer**: puedes desplazarte, seleccionar, copiar y **comentar** sin que salga el teclado,
y marcar las casillas de las tareas. Para retocar algo, pulsa el **lápiz** de arriba; con **✓** vuelves a leer.

¿Prefieres el Markdown en crudo? **⋯ › Editar como Markdown** abre el texto tal cual, con su barra de siempre; **⋯ › Volver al
editor** te devuelve.

Arriba verás **Guardado**, **Guardando…** o **Sin guardar**: Muninn guarda poco después de que dejes de escribir, al salir
del texto, al cambiar de nota y al ocultar la ventana. Si falla, te avisa y puedes **Reintentar**. Abrir una nota nunca la
cambia: solo se guarda lo que tú escribes.

### Qué se puede escribir

Títulos, **negrita**, *cursiva*, ~~tachado~~, listas con viñetas o numeradas (también unas dentro de otras), listas de tareas,
citas, código en línea y en bloque, tablas, separadores y enlaces.

En las **tablas**, si no caben (en el móvil, por ejemplo), se deslizan de lado dentro de la nota.

Por seguridad:

- El **HTML** que haya en una nota se ve como texto y se guarda tal cual: no se interpreta.
- Los **enlaces** solo pueden llevar a páginas web (`http`/`https`), correo (`mailto:`) y teléfono (`tel:`).
- Las **imágenes** no se cargan: verás su texto alternativo, y la imagen se conserva en el Markdown.

## Comentarios

Selecciona un trozo del texto y pulsa **Comentar** (o **Ctrl Alt M**). Escribe el comentario y pulsa **Comentar**
(o **Ctrl Intro**). El trozo queda **subrayado**; pasa el ratón por encima o púlsalo para abrir su hilo.

- **Dónde se ven:** si la nota tiene sitio, los hilos van **al margen derecho**, cada uno a la altura de su texto. Si no (una
  ventana estrecha, el móvil), se abren en un panel. El contador de arriba (el bocadillo con un número) abre la **lista de
  comentarios** de la nota.
- **Responder, resolver y reabrir:** cada hilo tiene su caja para responder y el botón **Resolver**. Un hilo resuelto deja de
  subrayarse; lo encuentras en la lista, en **resueltos**, con **Reabrir**. Desde **⋯ › Quitar el hilo** lo quitas. Todo avisa y se
  puede **Deshacer**.
- **Si cambias el texto:** el subrayado sigue a su trozo aunque escribas antes o después. Si borras o cambias del todo lo que
  comentaste, el hilo pasa a **Sin sitio**, con la cita tachada: no se pierde, y si el texto vuelve, recupera su sitio.
- Los comentarios **no se escriben en la nota**: el Markdown queda limpio, también para los asistentes.

### Para Claude

Al comentar, activa **Para Claude** y el hilo queda como un **encargo** («resume esto», «revisa estas cifras»…). Es pensado sobre
todo para el móvil: dejas la petición fuera de casa y Claude la atiende cuando se lo pidas por el [MCP de Muninn](06-asistentes-ia.md)
(por ejemplo, «revisa los comentarios para ti»).

Claude lee los encargos abiertos, cambia la nota si hace falta, **contesta en el hilo** lo que ha hecho y lo resuelve: lo verás
como **Resuelto por Claude**, y puedes **Reabrir** si no te convence. Si algo no está claro, te pregunta en el hilo y lo deja
abierto.

> **Próximamente:** que Claude revise los encargos solo, cada cierto tiempo, sin tener que pedírselo.

## Vincular una nota

Bajo el título, elige el **proyecto** de la nota y, si quieres, una **tarea** de ese proyecto. La flecha junto a la tarea
la abre. Desde el panel de una tarea ves sus **notas vinculadas**.

Si cambias una nota de proyecto, se desvincula de su tarea (la tarea era del proyecto anterior), pasa al primer nivel
de ese espacio y se lleva sus páginas dentro. Cada cambio avisa y se puede deshacer.

## Fijar, buscar y filtrar

- **Fijar** (la chincheta): las fijadas salen también arriba del todo, en su grupo, para tenerlas a mano.
- **Buscar:** el campo de la lista busca en el título y en el texto, sin distinguir mayúsculas ni tildes. Si escribes varias
  palabras, la nota debe tenerlas todas.
- **Filtros:** **Todas**, **Fijadas** y un chip por cada proyecto que tenga notas.

## Archivar y recuperar

Con **⋯ › Archivar nota** la nota sale de la lista, con todas sus páginas dentro, pero no se borra. **Deshacer** en el aviso la recupera. Si abres el
enlace de una nota archivada, puedes pulsar **Recuperar nota**. Desde la app aún no se pueden borrar notas, y los
asistentes de IA tampoco.

## Con los asistentes de IA

Claude y otros [asistentes](06-asistentes-ia.md) pueden crear, leer, buscar y editar tus notas por ti; lo que escriben
aparece aquí igual que lo tuyo.

También pueden **colgar una nota de otra** (una nota madre con sus hijas) y moverlas, para repartir un texto largo en
partes, y lo verás en el árbol al momento. Y pueden leer los **comentarios**, responderlos y resolverlos (ver
[Para Claude](#para-claude)); nunca borran uno.

Si activas el [informe de la mañana](11-asistente.md#informe-de-la-mañana), cada día te deja una **nota fijada** con tus
tareas, los cobros próximos y el resumen de noticias.

## En todos tus dispositivos

Con cuenta, lo que escribes o cambias en un dispositivo (también los comentarios) aparece en los demás al momento, sin recargar.

También puedes encontrar una nota desde el buscador (**⌘K** / **Ctrl K**): escribe parte del título o del texto. Y para
empezar una sin ir a Notas, busca «nueva nota».

> **Próximamente:** enlaces entre notas.
