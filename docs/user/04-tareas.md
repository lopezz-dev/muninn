---
title: Tareas
description: Crea, mueve y completa tareas; prioridades, fechas y subtareas.
order: 4
status: disponible
group: tu-trabajo
icon: checklist
---

# Tareas

> **Estado:** ya puedes crear, editar, mover, completar y archivar tareas desde la app, y también a través de los
> [asistentes de IA](06-asistentes-ia.md). Las archivadas se pueden recuperar o eliminar para siempre desde la app.

## Crear una tarea

Hay tres formas: el botón **Nueva tarea** (o la tecla **N**), el **+** de la cabecera de una columna, o **Añadir tarea**
al pie de la columna: escribes el título, pulsas **Intro** y sigues con la siguiente.

Una tarea pertenece a un proyecto. Si no eliges columna, va a la primera de tipo **Por hacer** ("Pendiente" en el
tablero por defecto). Si te equivocas, **Deshacer** en el aviso la archiva.

## Abrir y editar una tarea

Pulsa una tarjeta para abrirla: en el ordenador sale un panel a la derecha, en el móvil una pantalla completa. Tiene
enlace propio, así que puedes copiarlo o recargar la página. Desde ahí cambias:

- **Título** y **descripción** (se guardan al salir del campo). La descripción se escribe en **Markdown** (negrita, listas,
  enlaces, `código`…, como en las [notas](05-notas.md#qué-markdown-se-entiende)): al salir del campo se ve ya con su formato; pulsa sobre
  el texto o **Editar** para volver a escribir. Las casillas de una lista de tareas (`- [ ] algo`) se marcan sin entrar a editar.
- **Estado** (la columna), **prioridad** (ninguna, baja, media, alta o urgente) y **fecha límite**.
- **Etiquetas** libres: escribe y pulsa **Intro**.
- **Subtareas** (checklist): márcalas, quítalas o añade más; la tarjeta muestra el progreso, por ejemplo 2/3. Para
  cambiarlas de orden, arrástralas por el asa ⠿ de su izquierda (en el ordenador aparece al pasar el ratón; en el móvil,
  mantén pulsada el asa). Con el teclado: Tab hasta el asa, Espacio, flechas y Espacio. Siempre con **Deshacer**.
- **Notas vinculadas:** las notas de esa tarea, y **Añadir nota** para crear otra ya vinculada (ver [Notas](05-notas.md)).
- Ves la **actividad** de la tarea: quién la creó, movió o cambió, y cuándo.

Cada cambio avisa y se puede deshacer.

## Mover una tarea

Arrastra la tarjeta a otra columna o a otra posición dentro de la misma. Al moverla a una columna de
tipo **Hecho**, Muninn la marca como completada con la fecha. Si la sacas de ahí, vuelve a estar pendiente.

## Completar, archivar y borrar

- **Completar:** pulsa la casilla de la tarea (en Inicio, en el panel o con **Completar**) y pasa a la columna "Hecho".
  Pulsa otra vez para **reabrirla**.
- **Archivar:** la oculta del tablero sin borrarla (menú **⋯** de la tarea). **Deshacer** la recupera.
- **Eliminar:** solo las archivadas, desde **Tareas archivadas** (abajo). Los asistentes de IA no pueden eliminar tareas.

### Tareas archivadas

En el tablero, el menú **⋯** del proyecto tiene **Tareas archivadas**: las de ese proyecto, la última que archivaste primero, con
la columna en la que estaban.

- **Recuperar** la devuelve a su columna. **Deshacer** en el aviso la vuelve a archivar.
- La **papelera** la elimina para siempre, y **Eliminar todas** hace lo mismo con toda la lista. No hay diálogo de confirmación:
  desaparece de la lista y tienes unos segundos para pulsar **Deshacer** en el aviso. Hasta que el aviso se va no se borra nada (si
  cierras la app antes, tampoco).
- Se van con ella sus subtareas. Sus **notas no se borran**: se quedan en el proyecto, sin tarea. Y en el historial queda que la
  eliminaste.
- Si viene de **GitHub** y su issue sigue abierta, Muninn la volverá a traer como tarea nueva en la próxima sincronización: eliminar
  no toca la issue. Si no quieres verla más, ciérrala en GitHub o déjala archivada.

## De dónde viene cada tarea

Cada tarea recuerda su **origen**, que se muestra con una insignia:

| Origen | Cuándo |
|---|---|
| Manual | La creaste tú en la app |
| Asistente | La creó Claude u otro asistente por ti |
| GitHub | Viene de una issue de GitHub: lleva su número y su título y descripción se cambian allí (ver [GitHub](09-github.md)) |
| Agente | La creó un agente automático *(próximamente)* |

## Vencidas, para hoy y próximas

En **Inicio** ves las tareas **vencidas**, las que vencen **hoy**, lo que tienes **en curso**, lo que vence en los
**próximos 7 días** y lo que has completado hoy. Lo mismo, por proyecto, se lo puedes preguntar a un asistente de IA.
