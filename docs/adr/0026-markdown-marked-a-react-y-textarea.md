# ADR-0026: Markdown con marked a elementos de React y un editor sobre `textarea`

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web, core

## Contexto

Las notas son Markdown ([ROADMAP](../ROADMAP.md)), y la sección Documentación y la descripción de las tareas lo
necesitarán también. Hay dos problemas distintos: **mostrar** Markdown con seguridad (el texto lo escribe una persona, o
un asistente de IA a través del MCP, y se pinta en la sesión de quien lo lee) y **editarlo**, también en un iPhone. Además,
el JS inicial no puede crecer ([ADR-0020](0020-tanstack-router-carga-diferida.md)): todo esto va en el chunk de la pantalla.

Pesos medidos con esbuild (minificado, kB crudos / gzip):

| Opción | Peso |
|---|---|
| marked (lexer) | 46,9 / 14,3 |
| marked + DOMPurify | 78,5 / 26,7 |
| micromark + DOMPurify | 87 / 29 |
| markdown-it + DOMPurify | 132 / 54 |
| CodeMirror 6 (state + view + commands) | 270 / 89 |
| CodeMirror 6 con `lang-markdown` y resaltado | 504 / 176,5 |

## Decisión

- **Mostrar:** el *lexer* de `marked` (GFM: tablas, tachado, listas de tareas) produce tokens y `markdown/Markdown.tsx`
  los pinta como **elementos de React**, sin pasar por HTML. El saneado es por construcción:
  - React escapa todo el texto. Las entidades (`&amp;`) se decodifican a mano.
  - El HTML que escriba la persona (`<script>`, `<img onerror>`, `<div>`…) se muestra **como texto**, nunca como elementos.
  - Los enlaces solo llevan a `http`, `https`, `mailto` y `tel` (lista cerrada) y se abren aparte con `noopener noreferrer`.
  - Las imágenes **no se cargan** (sería una petición a un servidor ajeno solo por abrir una nota): se ve su texto alternativo.
- **Editar:** un `<textarea>` nativo con una barra de formato (título, negrita, cursiva, lista, tareas, código, enlace),
  funciones puras para cada botón (`markdown/format.ts`, con tests) y Enter dentro de una lista que la continúa. Los cambios se
  aplican con `execCommand('insertText')`, que mantiene el deshacer nativo del campo (`markdown/edit.ts`).
- **Vista previa** con las casillas de tarea marcables sin entrar a editar (reescribe el texto por el número de casilla;
  si la vista y el texto no cuentan las mismas, las casillas quedan de solo lectura).
- **Autoguardado** (`useNoteDraft`): 700 ms tras la última pulsación, al salir del campo, al cambiar de nota y al ocultar la
  pestaña. El estado «Guardado / Guardando…» está en la barra; el autoguardado no usa `notify` (sería un aviso por pausa al escribir).
  Fijar, vincular y archivar sí avisan y se pueden deshacer ([ADR-0019](0019-feedback-con-notificaciones.md)).
- **En el core**, una nota de tarea es siempre del proyecto de esa tarea, y las ediciones de título o texto se anotan en
  `activity` como mucho una cada 10 minutos ([ADR-0007](0007-registro-de-actividad.md)): el autoguardado no llena el registro.

## Alternativas consideradas

- **marked + DOMPurify** (`innerHTML`): permite HTML embebido saneado, pero son dos dependencias, 32 kB más, y un
  `dangerouslySetInnerHTML` que habría que vigilar en cada cambio. No necesitamos HTML embebido.
- **markdown-it:** casi el doble de peso sin ganar nada que usemos.
- **CodeMirror 6:** el mejor editor, pero 90–180 kB gzip y `contenteditable`: en iOS ha dado problemas con la autocorrección,
  la composición y el desplazamiento al abrir el teclado. Para notas, no compensa. Si algún día hace falta resaltado en línea o
  edición colaborativa, este ADR se reemplaza.
- **Editor WYSIWYG** (el diseño parece mostrar la nota ya renderizada y editable): mucho más código y peor con teclado móvil.
  Se resuelve con vista previa y un clic en el texto para editar.

## Consecuencias

- Sin HTML embebido ni imágenes en las notas. Si se quieren imágenes, serán archivos propios (Storage) y otro ADR.
- La barra de formato va **arriba**, no sobre el teclado: en iOS el teclado no avisa a la página de su altura.
- Dos cambios a la vez sobre la misma nota (dos dispositivos): gana el último guardado (sin fusión). Con Realtime
  ([ROADMAP](../ROADMAP.md)), si no hay cambios sin guardar aquí, se adopta la versión de fuera.
- El renderizador (`markdown/`) es reutilizable: Documentación y la descripción de tareas lo importan desde su chunk.
- Relacionado: [gotchas/web](../gotchas/web.md), [gotchas/core](../gotchas/core.md).
