---
title: GitHub
description: Las issues de tus repositorios, como tareas de su proyecto.
order: 9
status: parcial
---

# GitHub

> **Estado:** ya puedes vincular un repositorio a cada proyecto y Muninn sabe tratar las tareas que vienen de GitHub, pero la
> sincronización todavía no está en marcha: corre en el servidor y le faltan unos pasos de puesta en marcha. Hasta entonces,
> vincular un repositorio no trae nada. La pantalla **GitHub** (repositorios y agentes) llegará después.

## Vincular un repositorio

En **Ajustes › Integraciones** verás tus proyectos, cada uno con un campo para su repositorio. Escribe `usuario/repositorio` (por
ejemplo `lopezz-dev/muninn`) o pega la dirección que copias de GitHub, y pulsa **Intro** o sal del campo. Te lo confirma un aviso con
**Deshacer**. Para desvincularlo, deja el campo vacío.

Cada repositorio va con un solo proyecto. En esa misma pantalla ves si el módulo **GitHub** está activado y si ya ha llegado alguna issue.

## Qué hará la sincronización

Cuando esté activa:

- Cada **issue abierta** del repositorio aparece como tarea del proyecto, en la columna «Por hacer», con sus etiquetas. Las issues que
  ya estaban cerradas no se traen, ni las *pull requests*.
- **Cerrar la issue completa la tarea**, y reabrirla la devuelve a «Por hacer». Al revés también: **completar la tarea cierra la issue**,
  y reabrirla la reabre. Lo de GitHub llega en unos segundos; lo de Muninn tarda como mucho unos 5 minutos en llegar a GitHub.
- Si la issue se borra o se pasa a otro repositorio, su tarea se **archiva** (no se borra).

## Las tareas que vienen de GitHub

- Llevan la insignia **GitHub** con su número de issue (por ejemplo, «GitHub #42») en el tablero y en la lista. En el detalle de la
  tarea, la insignia es un enlace que abre la issue.
- Su **título y su descripción** los manda GitHub: en Muninn se ven pero no se editan, y se actualizan solos cuando cambian en la issue.
- Todo lo demás es tuyo: la columna, el orden, la prioridad, la fecha, las subtareas, las notas y las etiquetas (las de la issue se copian
  solo al crearse la tarea).
- Si **archivas** una tarea de GitHub, Muninn no la vuelve a sacar aunque la issue cambie.
- En el tablero puedes quedarte solo con ellas con el filtro **Origen › GitHub**.
