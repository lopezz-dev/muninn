---
title: Notas
description: Apuntes en Markdown, sueltos o vinculados a proyectos y tareas.
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
está en **Más › Notas**; al abrir una nota se ve a pantalla completa y la flecha de arriba te devuelve a la lista.

Cada nota tiene su propio enlace, así que puedes copiarlo o recargar la página sin perder el sitio.

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
  texto para volver a editar.

Al pulsar **Intro** dentro de una lista, la siguiente línea ya empieza con su viñeta, su número o su casilla; **Intro** sobre
un elemento vacío termina la lista. **Esc** pasa a la vista previa. Ctrl/⌘ Z deshace lo último que escribiste.

Arriba verás **Guardado**, **Guardando…** o **Sin guardar**: Muninn guarda poco después de que dejes de escribir, al salir
del campo, al cambiar de nota y al ocultar la ventana. Si falla, te avisa y puedes **Reintentar**.

### Qué Markdown se entiende

Títulos (`##`), **negrita**, *cursiva*, ~~tachado~~, listas con viñetas o numeradas, listas de tareas (`- [ ]`), citas
(`>`), código en línea y en bloque, tablas, separadores y enlaces.

Por seguridad:

- El **HTML** que escribas se muestra tal cual, como texto: no se interpreta.
- Los **enlaces** solo pueden llevar a páginas web (`http`/`https`), correo (`mailto:`) y teléfono (`tel:`).
- Las **imágenes** no se cargan: verás su texto alternativo (como enlace, si es una dirección web).

## Vincular una nota

Bajo el título, elige el **proyecto** de la nota y, si quieres, una **tarea** de ese proyecto. La flecha junto a la tarea
la abre. Desde el panel de una tarea ves sus **notas vinculadas**.

Si cambias una nota de proyecto, se desvincula de su tarea (la tarea era del proyecto anterior). Cada cambio avisa y se
puede deshacer.

## Fijar, buscar y filtrar

- **Fijar** (la chincheta): las fijadas van siempre arriba, en su grupo; después, las editadas más recientemente.
- **Buscar:** el campo de la lista busca en el título y en el texto, sin distinguir mayúsculas ni tildes. Si escribes varias
  palabras, la nota debe tenerlas todas.
- **Filtros:** **Todas**, **Fijadas** y un chip por cada proyecto que tenga notas.

## Archivar y recuperar

Con **⋯ › Archivar nota** la nota sale de la lista, pero no se borra. **Deshacer** en el aviso la recupera. Si abres el
enlace de una nota archivada, puedes pulsar **Recuperar nota**. Desde la app aún no se pueden borrar notas, y los
asistentes de IA tampoco.

## Con los asistentes de IA

Claude y otros [asistentes](06-asistentes-ia.md) pueden crear, leer, buscar y editar tus notas por ti; lo que escriben
aparece aquí igual que lo tuyo.

Si activas el [informe de la mañana](11-asistente.md#informe-de-la-mañana), cada día te deja una **nota fijada** con tus
tareas, los cobros próximos y el resumen de noticias.

## En todos tus dispositivos

Con cuenta, lo que escribes o cambias en un dispositivo aparece en los demás al momento, sin recargar.

> **Próximamente:** enlaces entre notas y buscar notas desde el buscador **⌘K**.
