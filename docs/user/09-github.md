---
title: GitHub
description: Las issues de tus repositorios, como tareas de su proyecto.
order: 9
status: parcial
---

# GitHub

> **Estado:** la sincronización está en marcha y probada con issues reales. La pantalla **GitHub** (repositorios y agentes) llegará
> después.

## Vincular un repositorio

En **Ajustes › Integraciones** verás tus proyectos, cada uno con un selector para su repositorio. Ábrelo y elige uno de la lista. Te lo
confirma un aviso con **Deshacer**. Para desvincularlo, elige **Sin repositorio**.

En la lista salen tus repositorios privados a los que la sincronización tiene acceso y **todos** tus repositorios públicos. Al elegir uno
público, Muninn comprueba en un momento que la sincronización pueda usarlo; si no puede, te avisa y no lo vincula.

Cada repositorio va con un solo proyecto: si ya está con otro, sale en gris y te dice con cuál («en Huginn»).

¿No sale el repositorio que buscas, o te dice que no tiene acceso? La sincronización solo puede usar los repositorios a los que le diste
acceso al configurarla. Dale acceso a ese repositorio en GitHub y vuelve a elegirlo.

Si la lista no puede cargarse (por ejemplo, en el modo demo), en su lugar verás un campo: escribe `usuario/repositorio` o pega la
dirección de GitHub y pulsa **Intro**.

En esa misma pantalla ves si el módulo **GitHub** está activado y si ya ha llegado alguna issue.

## Qué hace la sincronización

- Cada **issue abierta** del repositorio aparece como tarea del proyecto, en la primera columna de tipo **Por hacer** («Pendiente» en un
  tablero nuevo), con sus etiquetas. Las issues que ya estaban cerradas no se traen, ni las *pull requests*.
- **Cerrar la issue completa la tarea**, y reabrirla la devuelve a esa columna. Al revés también: **completar la tarea cierra la issue**,
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
