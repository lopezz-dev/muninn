---
title: Notas
description: Apuntes en Markdown, ordenados en carpetas y páginas con hijas, y vinculados a proyectos y tareas.
order: 5
status: disponible
group: tu-trabajo
icon: notes
---

# Notas

Las notas sirven para todo lo que no es una tarea: ideas, actas de reuniones, documentación de un proyecto…
Se escriben en **Markdown** y se guardan solas mientras escribes.

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

La nota tiene dos modos, arriba a la derecha:

- **Editar:** el texto en Markdown, con una barra de formato: título (**H**, pulsa otra vez para cambiar de nivel o quitarlo),
  **negrita**, *cursiva*, lista, lista de tareas, código y enlace. Selecciona un texto antes de pulsar un botón para
  aplicárselo; si ya lo tiene, se quita. En el ordenador, **Ctrl B** y **Ctrl I** (⌘ en Mac) ponen negrita y cursiva.
- **Vista previa:** la nota ya con su formato. Las casillas de las listas de tareas se pueden marcar aquí mismo. Pulsa sobre el
  texto para volver a editar; si seleccionas un trozo para copiarlo, la nota sigue en vista previa.

Al pulsar **Intro** dentro de una lista, la siguiente línea ya empieza con su viñeta, su número o su casilla; **Intro** sobre
un elemento vacío termina la lista. **Esc** pasa a la vista previa. Ctrl/⌘ Z deshace lo último que escribiste.

Arriba verás **Guardado**, **Guardando…** o **Sin guardar**: Muninn guarda poco después de que dejes de escribir, al salir
del campo, al cambiar de nota y al ocultar la ventana. Si falla, te avisa y puedes **Reintentar**.

### Qué Markdown se entiende

Títulos (`##`), **negrita**, *cursiva*, ~~tachado~~, listas con viñetas o numeradas, listas de tareas (`- [ ]`), citas
(`>`), código en línea y en bloque, tablas, separadores y enlaces.

En las **tablas**, las columnas cortas (fechas, códigos, versiones) se ajustan a lo que ocupan y no se
parten; la de texto largo se reparte el ancho que queda. Si la tabla no cabe (en el móvil, por ejemplo), se desliza
de lado dentro de la nota.

Por seguridad:

- El **HTML** que escribas se muestra tal cual, como texto: no se interpreta.
- Los **enlaces** solo pueden llevar a páginas web (`http`/`https`), correo (`mailto:`) y teléfono (`tel:`).
- Las **imágenes** no se cargan: verás su texto alternativo (como enlace, si es una dirección web).

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
partes, y lo verás en el árbol al momento.

Si activas el [informe de la mañana](11-asistente.md#informe-de-la-mañana), cada día te deja una **nota fijada** con tus
tareas, los cobros próximos y el resumen de noticias.

## En todos tus dispositivos

Con cuenta, lo que escribes o cambias en un dispositivo aparece en los demás al momento, sin recargar.

También puedes encontrar una nota desde el buscador (**⌘K** / **Ctrl K**): escribe parte del título o del texto. Y para
empezar una sin ir a Notas, busca «nueva nota».

> **Próximamente:** enlaces entre notas.
