---
title: GitHub
description: Las issues de tus repositorios, como tareas de su proyecto.
order: 9
status: parcial
group: modulos
icon: github
---

# GitHub

> **Estado:** la sincronización está en marcha y probada con issues reales. El agente necesita una preparación en cada repositorio
> (más abajo).

## La pantalla GitHub

En **GitHub** (en la barra lateral o, en el móvil, en **Ir a** de la hoja de tu cuenta) tienes todo junto:

- **Tus repositorios.** Primero los vinculados, con su proyecto, cuántas issues siguen abiertas y cuándo cambió algo por última vez.
  Debajo, los demás repositorios a los que llega la sincronización, como «Sin vincular» (si son muchos, **Ver más**).
- **Vincular desde aquí.** En la columna **Proyecto en Muninn** elige el proyecto de un repositorio, o **Sin vincular** para soltarlo.
  Si eliges otro proyecto para un repositorio que ya está vinculado, se pasa a ese proyecto. Siempre con **Deshacer**.
- **Sincronizar ahora.** Muninn repasa en ese momento todos los repositorios vinculados, sin esperar a los 5 minutos, y te dice qué ha
  cambiado («2 issues nuevas y 1 cambiada»). Si un repositorio falla, lo verás en rojo en su fila.
- **La columna del agente** de cada proyecto vinculado, para elegirla o quitarla sin ir al tablero.
- **Ejecuciones recientes:** qué está haciendo el agente. **Trabajando** si la tarea está en su columna; **PR abierto**, **Fusionado**
  o **PR cerrado** según su *pull request* (con enlace); **Sin PR** si terminó sin abrir ninguna.

El diseño tiene también un interruptor para pausar un repositorio. Todavía no existe: para que deje de sincronizar, desvincúlalo.

## Vincular un repositorio

Además de en la pantalla **GitHub**, en **Ajustes › GitHub** verás tus proyectos, cada uno con un selector para su repositorio.
Ábrelo y elige uno de la lista. Te lo confirma un aviso con **Deshacer**. Para desvincularlo, elige **Sin repositorio**.

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
- Si la **eliminas** (desde [Tareas archivadas](04-tareas.md#tareas-archivadas)) y la issue sigue abierta, vuelve como tarea nueva en
  la próxima sincronización: eliminar no cierra la issue. Para que no vuelva, déjala archivada o cierra la issue.
- En el tablero puedes quedarte solo con ellas con el filtro **Origen › GitHub**.

## Para el agente

Puedes pedirle a un agente (Claude Code) que resuelva una issue por ti: mueve su tarea a la columna del agente y él trabaja en el
repositorio, abre una *pull request* y la tarea avanza sola.

> **Estado:** recién llegado. Necesita una preparación en el repositorio de GitHub que todavía no se hace desde Muninn (instalar la
> app de Claude, una clave y un fichero de flujo de trabajo). Mientras no esté hecha, mover una tarea a la columna solo le pone una
> etiqueta a la issue.

- **Elige la columna.** En el menú de una columna (los tres puntos), **Usar para el agente**. Sale con un pequeño robot junto al nombre.
  Solo se ofrece si el proyecto tiene repositorio y el módulo GitHub está activado, y nunca en una columna «Hecho». Para quitarla,
  **Dejar de usarla para el agente**.
- **Mueve una tarea de GitHub ahí.** Muninn etiqueta su issue con `muninn:agent` en unos segundos y el agente empieza. Las tareas que
  creas en Muninn no tienen issue: no se pueden mover ahí y te lo dice.
- **Cuando el agente abre su PR**, la tarea pasa a «Revisión». En su actividad verás «Ver el PR».
- **Tú revisas y fusionas.** El agente nunca fusiona. Al fusionar el PR, la tarea se completa y la issue se cierra. Si cierras el PR sin
  fusionarlo, la tarea vuelve a «Por hacer».
- **Si el agente termina sin PR** (no lo consiguió o le faltaba información), la tarea vuelve a «Por hacer» y su actividad lo cuenta.
  Para reintentarlo, muévela otra vez a la columna.
- **¿Te arrepientes?** Saca la tarea de la columna: se quita la etiqueta y el agente se detiene.

Cada vez que mandas una tarea al agente se gasta una ejecución de GitHub Actions y uso de Claude. Manda solo issues que hayas leído:
el agente lee la issue entera, y en un repositorio público cualquiera puede escribir en ella.
