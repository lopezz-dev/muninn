---
title: Tareas
description: Crea, mueve y completa tareas; prioridades, fechas y subtareas.
order: 4
status: parcial
---

# Tareas

> **Estado:** ya puedes crear, editar, mover, completar y archivar tareas desde la app, y también a través de los
> [asistentes de IA](06-asistentes-ia.md). La descripción es texto sencillo por ahora (el Markdown llegará más adelante).

## Crear una tarea

Hay tres formas: el botón **Nueva tarea** (o la tecla **N**), el **+** de la cabecera de una columna, o **Añadir tarea**
al pie de la columna: escribes el título, pulsas **Intro** y sigues con la siguiente.

Una tarea pertenece a un proyecto. Si no eliges columna, va a la primera de tipo **Por hacer** ("Pendiente" en el
tablero por defecto). Si te equivocas, **Deshacer** en el aviso la archiva.

## Abrir y editar una tarea

Pulsa una tarjeta para abrirla: en el ordenador sale un panel a la derecha, en el móvil una pantalla completa. Tiene
enlace propio, así que puedes copiarlo o recargar la página. Desde ahí cambias:

- **Título** y **descripción** (se guardan al salir del campo).
- **Estado** (la columna), **prioridad** (ninguna, baja, media, alta o urgente) y **fecha límite**.
- **Etiquetas** libres: escribe y pulsa **Intro**.
- **Subtareas** (checklist): márcalas, quítalas o añade más; la tarjeta muestra el progreso, por ejemplo 2/3.
- Ves la **actividad** de la tarea: quién la creó, movió o cambió, y cuándo.

Cada cambio avisa y se puede deshacer.

## Mover una tarea

Arrastra la tarjeta a otra columna o a otra posición dentro de la misma. Al moverla a una columna de
tipo **Hecho**, Muninn la marca como completada con la fecha. Si la sacas de ahí, vuelve a estar pendiente.

## Completar, archivar y borrar

- **Completar:** pulsa la casilla de la tarea (en Inicio, en el panel o con **Completar**) y pasa a la columna "Hecho".
  Pulsa otra vez para **reabrirla**.
- **Archivar:** la oculta del tablero sin borrarla (menú **⋯** de la tarea). **Deshacer** la recupera.
- **Borrar:** desde la app aún no se puede; archiva. Los asistentes de IA tampoco pueden borrar.

## De dónde viene cada tarea

Cada tarea recuerda su **origen**, que se muestra con una insignia:

| Origen | Cuándo |
|---|---|
| Manual | La creaste tú en la app |
| Asistente | La creó Claude u otro asistente por ti |
| GitHub | Viene de una issue de GitHub *(próximamente)* |
| Agente | La creó un agente automático *(próximamente)* |

## Vencidas, para hoy y próximas

En **Inicio** ves las tareas **vencidas**, las que vencen **hoy**, lo que tienes **en curso**, lo que vence en los
**próximos 7 días** y lo que has completado hoy. Lo mismo, por proyecto, se lo puedes preguntar a un asistente de IA.
