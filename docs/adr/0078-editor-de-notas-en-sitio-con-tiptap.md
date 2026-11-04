# ADR-0078: Notas editadas en sitio con TipTap, guardando Markdown; en el teléfono, para leer y comentar

- **Estado:** Propuesto
- **Fecha:** 2026-11-04
- **Área:** web, ui
- **Reemplaza a:** [ADR-0026](0026-markdown-marked-a-react-y-textarea.md), en parte (el editor; mostrar Markdown en el resto de la app no cambia)

## Contexto

El [ADR-0026](0026-markdown-marked-a-react-y-textarea.md) separó leer y editar: una vista previa renderizada y un `textarea` con el
Markdown en crudo, con un clic en el texto para pasar de una a otro. Descartó el WYSIWYG por peso y por iOS (autocorrección,
composición y desplazamiento al abrir el teclado con `contenteditable`). En el uso real ha pasado esto:

- Seleccionar un trozo para copiarlo terminaba en un clic que cambiaba a editar (parcheado en la PR #130).
- Editar el Markdown en crudo en el ordenador se queda corto al lado de Claude Docs, la referencia de Alex: allí se lee y se edita el
  mismo texto ya con formato, y se comenta sobre él ([ADR-0079](0079-comentarios-anclados-en-las-notas.md)).
- Alex lo ha acotado el 04-11: en el **ordenador** quiere el editor en sitio; en el **teléfono** las notas son para **leer y
  comentar** (dejar comentarios que Claude atiende por el MCP), con poca edición.

Pesos medidos el 04-11 con esbuild (producción, minificado, gzip), con tablas, listas de tareas y Markdown de entrada y salida:

| Opción | gzip | Markdown |
|---|---|---|
| TipTap 3 (`@tiptap/core`, `starter-kit`, `markdown`, `extension-table`, `extension-list`) | 146 kB sin marked (158 con) | `@tiptap/markdown`, sobre el lexer de **marked** |
| Milkdown 7 (`@milkdown/kit`, commonmark + gfm) | 138 kB | remark |
| Lexical 0.53 (rich-text, list, link, table, markdown) | 167 kB | `@lexical/markdown`, sin tablas |
| CodeMirror 6 con Markdown (ADR-0026, descartado) | 176 kB | — |

## Decisión

- **Editor:** TipTap 3 sobre ProseMirror, en el chunk de la pantalla de Notas (el arranque no cambia, [ADR-0020](0020-tanstack-router-carga-diferida.md)).
  El contenido se sigue **guardando como Markdown** en `notes.content`: el core, el MCP, la búsqueda, ⌘K y las vistas previas de la lista no
  cambian. Entra con `@tiptap/markdown` (lexer de marked, el mismo que pinta el resto de la app) y sale con su serializador.
- **Un solo modo en el ordenador:** la nota se lee y se edita en el mismo sitio, sin vista previa ni botón «Editar». Al seleccionar
  sale una barra flotante (negrita, cursiva, enlace, código, **Comentar**). La barra fija de arriba conserva títulos, listas, tareas y
  tablas. Atajos: ⌘B, ⌘I, ⌘K (enlace), ⌘Z / ⌘⇧Z, ⌘⌥M (comentar) y los de Markdown al escribir (`## `, `- `, `1. `, `[ ] `, `> `, `` ` ``).
- **En el teléfono (y en táctil), lectura por defecto:** el mismo editor con `editable: false`. Desplazarse y seleccionar no abren el
  teclado; el menú de selección del sistema conserva Copiar, y Muninn añade **Comentar** en una barra propia sobre la selección. Un botón
  de lápiz activa la edición en sitio para los retoques (el uso previsto es poco). Así el riesgo de iOS que motivó el ADR-0026 queda
  en la parte que menos se usa.
- **Escape a Markdown:** «⋯ › Editar como Markdown» abre el `textarea` de hoy (con su barra y su deshacer nativo, `markdown/edit.ts`),
  para quien lo prefiera o si algo no se puede hacer en el editor.
- **Saneado por construcción**, como hasta ahora: el esquema del editor no tiene nodo de HTML (el HTML escrito se ve como texto), los
  enlaces pasan por `safeHref` (`http(s)`, `mailto`, `tel`) y las imágenes no se cargan (se ve su texto alternativo).
- **Ida y vuelta sin sorpresas:**
  - Solo se guarda si la persona cambia algo: abrir una nota **nunca** la reescribe con el formato del serializador.
  - Lo que el esquema no entiende se conserva en un nodo «crudo» con su Markdown original, que se guarda tal cual.
  - Tests de ida y vuelta (`parse → serialize → parse` da el mismo documento) con un corpus de notas reales anonimizadas.
- **Guardado:** el de siempre (`useNoteDraft`): 700 ms tras la última tecla, al salir, al cambiar de nota y al ocultar la pestaña, en la
  cola `serial('note:<id>')`. El deshacer es el historial de ProseMirror, por nota, agrupado por pausas.
- **Tiempo real:** si llega una versión de fuera y aquí no hay cambios sin guardar, se adopta (como en el ADR-0026), manteniendo la
  selección si el texto de alrededor sigue igual.

## Alternativas consideradas

- **Arreglar solo el modelo actual** (PR #130): resuelve el salto a editar, pero no da el editor en sitio ni un sitio natural para
  comentar sobre el texto renderizado. Se queda como escape («Editar como Markdown»).
- **Milkdown:** 8 kB menos y remark es más fiel al guardar, pero mete un segundo intérprete de Markdown distinto del que pinta
  Documentación y el asistente, y tiene menos piezas hechas (barra flotante, decoraciones de comentarios) y menos comunidad.
- **Lexical:** el más pesado, sin tablas en su Markdown (habría que escribir el transformador) y con más historia de fallos de
  composición en iOS.
- **CodeMirror con resaltado:** sigue siendo edición de Markdown en crudo, que es justo lo que no se quiere en el ordenador.

## Consecuencias

- Positivas: se lee y se edita lo mismo; los comentarios ([ADR-0079](0079-comentarios-anclados-en-las-notas.md)) se pintan como
  decoraciones del editor; el Markdown sigue siendo el formato de verdad para el MCP y los asistentes.
- Negativas / costes:
  - ~146 kB gzip más al abrir Notas por primera vez (caché después).
  - El serializador puede normalizar detalles del Markdown (`*` por `-`, tablas realineadas) **en las notas que se editan**.
  - `@tiptap/markdown` pide `marked ^17` y la app usa 18.1.1: si no funciona con 18, se aceptan dos copias en el chunk de Notas o se
    fija la versión. Comprobarlo antes de aceptar este ADR.
  - Antes de aceptarlo: probar en un iPhone real la lectura, seleccionar para comentar y un retoque con el lápiz.
- Relacionado: [ADR-0026](0026-markdown-marked-a-react-y-textarea.md), [ADR-0079](0079-comentarios-anclados-en-las-notas.md),
  [ADR-0034](0034-escribir-sin-conexion.md) (la cola sin conexión), [gotchas/web](../gotchas/web.md) («Notas: un editor por nota»).
