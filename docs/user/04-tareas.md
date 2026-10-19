---
title: Tareas
description: Crea, mueve y completa tareas; prioridades, fechas y subtareas.
order: 4
status: parcial
---

# Tareas

> **Estado:** todo lo descrito aquí ya funciona a través de los [asistentes de IA](06-asistentes-ia.md).
> La interfaz visual llegará próximamente.

## Crear una tarea

Una tarea pertenece a un proyecto. Si no eliges columna, va a la primera de tipo **Por hacer**
("Pendiente" en el tablero por defecto).

Además del título, puedes añadir:
- **Descripción** en Markdown.
- **Prioridad:** ninguna, baja, media, alta o urgente.
- **Fecha límite.**
- **Etiquetas** libres.
- **Subtareas** (checklist): la tarjeta muestra el progreso, por ejemplo 2/3.

## Mover una tarea

Arrastra la tarjeta a otra columna o a otra posición dentro de la misma. Al moverla a una columna de
tipo **Hecho**, Muninn la marca como completada con la fecha. Si la sacas de ahí, vuelve a estar pendiente.

## Completar, archivar y borrar

- **Completar:** la mueve a la columna "Hecho".
- **Archivar:** la oculta del tablero sin borrarla.
- **Borrar:** la elimina para siempre. Los asistentes de IA no pueden borrar, como mucho archivar.

## De dónde viene cada tarea

Cada tarea recuerda su **origen**, que se muestra con una insignia:

| Origen | Cuándo |
|---|---|
| Manual | La creaste tú en la app |
| Asistente | La creó Claude u otro asistente por ti |
| GitHub | Viene de una issue de GitHub *(próximamente)* |
| Agente | La creó un agente automático *(próximamente)* |

## Vencidas, para hoy y próximas

Muninn te avisa de las tareas **vencidas**, las que vencen **hoy** y las de los **próximos 7 días**,
tanto por proyecto como en el resumen general.
