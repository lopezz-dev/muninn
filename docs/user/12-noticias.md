---
title: Noticias
description: Sigue tus blogs y webs por RSS y recibe cada mañana un resumen hecho en tu ordenador.
order: 12
status: parcial
group: modulos
icon: news
---

# Noticias

**Noticias** junta en un sitio lo que publican los blogs y webs que sigues (por **RSS**) y te prepara cada día un resumen
con lo más importante. Actívala en **Ajustes › Módulos › Noticias**.

> **Estado:** la descarga de artículos ya funciona: cada hora y al pulsar «Actualizar». El **resumen del día** necesita el
> modelo del asistente instalado en tu ordenador; sin él, ves los artículos pero no el resumen.

## Añadir una fuente

Lo más rápido: **Fuentes oficiales** (en el panel **Fuentes**, o en la pantalla vacía) abre una lista de feeds publicados por
el propio medio u organismo, por temas: actualidad (RTVE, El País, Europa Press…), instituciones (BOE, La Moncloa, Banco de
España, OMS), economía, tecnología, IA, desarrollo y ciencia. Pulsa **Añadir** en las que quieras y se guardan con su tema,
así cada tema tiene su pestaña.

Si la que buscas no está, en el panel **Fuentes** pega la dirección del feed (suele terminar en `rss`, `feed` o `atom.xml`) en **Añadir RSS**,
ponle un **tema** si quieres (por ejemplo «Rust» o «IA local») y pulsa **Añadir fuente**. Si te equivocas, **Deshacer**.

- El interruptor **pausa** una fuente: deja de descargarse, pero conservas lo que ya llegó.
- El botón de archivar la **quita**. Sus artículos guardados se quedan. Si la vuelves a añadir, se recupera.
- Si una fuente falla (no existe, no es un feed…), verás el motivo en rojo debajo de su nombre.

## Cómo llegan los artículos

El **servidor de Muninn** descarga tus fuentes **cada hora**, aunque tu ordenador esté apagado. **Actualizar** las descarga
en ese momento. Los artículos se guardan **30 días**; los que marques con **Leer luego**, para siempre.

## Leer

- Arriba, **Lo importante de hoy**: el resumen del día.
- Las pestañas filtran por **tema** y **Guardadas**; el buscador, por texto. También puedes buscar desde **Ctrl K / ⌘ K** con
  **Buscar en Noticias**.
- En **Todas**, si una fuente publica muchos artículos seguidos, ves los 3 primeros y el resto queda en **Ver N más de …**,
  en su sitio. Así las fuentes que publican poco no se pierden debajo.
- Pulsa el **nombre de la fuente** en un artículo para ver solo los suyos; **Solo … ✕** quita el filtro.
- Si un artículo habla de uno de tus proyectos, sale **Relacionada con …**.
- Cada artículo tiene **Crear tarea** (abre «Nueva tarea» con el título y el enlace), **Guardar como nota**, **Leer luego**
  y **Abrir** (en tu navegador, también desde la app de escritorio; queda marcado como leído). El título hace lo mismo.

## El resumen del día

Lo escribe el **modelo de tu ordenador** (el mismo del [Asistente](11-asistente.md)), así que lo que te interesa no sale de
casa. Se hace solo la primera vez que abres Noticias en el día **en el ordenador donde está Ollama**; también puedes pulsar
**Resumir** o **Rehacer** (con «Deshacer» para volver al anterior). Se guarda en tu cuenta, así que en el iPhone lo ves igual.

El resumen reparte su espacio entre tus fuentes: aunque una publique cincuenta artículos al día, las demás también entran.

Si ese día no abres Muninn en el ordenador, no habrá resumen nuevo: verás los artículos igualmente.

> **Próximamente:** escuchar el resumen en voz alta.
