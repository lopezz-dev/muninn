---
title: Proyectos y tablero
description: Organiza tu trabajo en proyectos con un Kanban a tu medida.
order: 3
status: parcial
---

# Proyectos y tablero

> **Estado:** todo lo descrito aquí ya funciona a través de los [asistentes de IA](06-asistentes-ia.md).
> En la app ya puedes crear y archivar proyectos y ver las columnas de su tablero (en modo demo, sin
> guardar: ver [Moverte por Muninn](08-moverte-por-muninn.md)). Crear, mover y personalizar tareas y
> columnas desde la app llegará próximamente.

## Proyectos

Un proyecto agrupa las tareas y notas de algo en lo que estás trabajando: una app, un cliente, una mudanza…

Cada proyecto tiene:
- **Nombre, descripción, color e icono.**
- **Estado:** activo, pausado o archivado. Los archivados desaparecen de las listas, pero no se borran.
- **Repositorio de GitHub** (opcional, en formato `usuario/repositorio`): las issues de ese repo
  aparecerán como tareas del proyecto *(próximamente)*.

## El tablero

Cada proyecto tiene su propio tablero Kanban. Al crearlo empieza con cinco columnas:

**Backlog → Pendiente → En curso → Revisión → Hecho**

### Personalizar las columnas

Puedes renombrarlas, reordenarlas, añadir nuevas, cambiarles el color o fijar un **límite** de tareas
(útil para no tener demasiadas cosas "en curso" a la vez).

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

Si la columna tiene tareas, Muninn te pedirá a qué columna moverlas. Un proyecto siempre necesita
al menos una columna.
