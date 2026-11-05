# ADR-0079: Comentarios en las notas, anclados a una cita del texto, y «Para Claude» como canal hacia el MCP

- **Estado:** Propuesto
- **Fecha:** 2026-11-04
- **Área:** core, db, mcp, web

## Contexto

Alex quiere comentar las notas como en Claude Docs: seleccionar un trozo, dejar un comentario, verlo subrayado, abrir el hilo,
responder y resolverlo. Y, sobre todo desde el **teléfono**, usarlos como encargo: dejar comentarios fuera de casa para que Claude
los lea por el MCP de Muninn (a petición, «revisa los comentarios», o con una guardia programada), haga los cambios en la nota y
conteste en el hilo.

Lo difícil es el ancla. La nota cambia por muchos caminos: el editor en sitio ([ADR-0078](0078-editor-de-notas-en-sitio-con-tiptap.md)),
otro dispositivo, el asistente local o Claude por el MCP, que reescribe el Markdown entero con `update_note`. Un comentario no puede
perderse ni quedarse apuntando al texto equivocado.

## Decisión

### Datos

Tabla nueva `note_comments` (migración nueva, checklist de [gotchas/db](../gotchas/db.md)):

| Columna | |
|---|---|
| `id`, `owner_id` | `owner_id` con RLS y la política restrictiva `require_mfa` ([ADR-0062](0062-aal2-para-integraciones-sensibles.md)) |
| `note_id` | `references notes (id) on delete cascade` |
| `parent_id` | `null` en el comentario que abre el hilo; las respuestas apuntan a él (un nivel, sin anidar más) |
| `body` | texto, 1–10 000 caracteres, Markdown en línea |
| `anchor` | `jsonb`, solo en el primero: `{ quote, prefix, suffix, start, end }` |
| `orphaned` | `boolean`: la cita ya no se encuentra en la nota |
| `for_agent` | `boolean`: «Para Claude», un encargo que debe atender un agente |
| `resolved_at`, `resolved_by` | solo en el primero; `resolved_by` es un `actorKind` |
| `actor` | `actorKind` de quien lo escribe (`user`, `mcp`, `assistant`…), para pintar «Alex» o «Claude» |
| `archived_at` | el «Deshacer» de crear; no hay borrado definitivo desde la app ni el MCP |
| `created_at`, `updated_at` | con el trigger `set_updated_at` |

Índices `(owner_id)` y `(note_id, created_at)`. Entra en `supabase_realtime`, en `SYNC_TABLES` y en `scopesOf` colgando de `['notes', …]`.

### Ancla: una cita, no una posición en el Markdown

- El ancla se guarda sobre el **texto visible** de la nota (`noteText(markdown)` en el core: el texto que se lee, sin marcas de
  Markdown, con un salto de línea entre bloques), al estilo del selector de cita de W3C Web Annotation: la cita (`quote`), hasta 32
  caracteres de contexto a cada lado (`prefix`, `suffix`) y la posición (`start`, `end`) como pista.
- **El Markdown no lleva ninguna marca de comentario.** Lo que escriba el MCP o el asistente no puede romper ni borrar un ancla.
- Crear: la interfaz manda la cita y su contexto tal como se ven en la selección; el core la busca en `noteText` y calcula la posición.
  Si la cita aparece varias veces, desempata el contexto. Desde el MCP basta la cita (y `occurrence` si se repite).

### Cuando la nota cambia, el core vuelve a anclar

Se hace **en el core, en la misma escritura que cambia el contenido** (`notes.update`), así vale igual para la app, el asistente y el
MCP. Para cada hilo abierto, `reanchor(viejo, nuevo, ancla)` (función pura, con tests):

1. Proyecta la posición por la parte común del principio y del final de los dos textos: si el cambio fue en otro sitio, la cita se
   mueve con el texto y se comprueba que sigue ahí.
2. Si no, busca todas las apariciones exactas de la cita y gana la que mejor casa con `prefix` y `suffix` y queda más cerca de la
   posición anterior.
3. Si no hay ninguna, prueba una coincidencia aproximada de la cita (distancia de edición ≤ 20 % de su largo) en la zona esperada.
   Si encaja, actualiza `quote` al texto nuevo.
4. Si nada encaja, el hilo pasa a `orphaned = true`. Se ve en «Sin sitio» con la cita original tachada. **Nunca se borra**, y si
   el texto vuelve (un «Deshacer»), el siguiente guardado lo vuelve a anclar.

En el editor, mientras escribes, los subrayados son decoraciones que ProseMirror mueve con cada cambio. La verdad la escribe el
core al guardar.

### «Para Claude» y el MCP

- Al comentar, un interruptor **Para Claude** marca el hilo como encargo (`for_agent`). Es lo que pide Alex desde el teléfono.
- Herramientas nuevas en el catálogo único (`@muninn/assistant/tools`, [ADR-0041](0041-asistente-local-con-catalogo-unico.md)), sin borrados:
  - `list_note_comments`: los hilos de una nota, o de todas, filtrando por abiertos/resueltos y por `forAgent`. Devuelve la cita,
    si está `orphaned`, el hilo entero y el título y el id de la nota.
  - `comment_on_note`: abrir un hilo sobre una cita (`noteId`, `quote`, `occurrence?`, `body`).
  - `reply_to_comment` y `resolve_comment` (con `resolved: false` para reabrir).
- **Cómo atiende Claude un encargo:** lee los hilos `forAgent` abiertos, cambia la nota con `update_note` (el core reancla), responde
  en el hilo qué ha hecho y lo resuelve. Alex lo ve como «Resuelto por Claude» y puede **Reabrir**. Si no puede o no está claro,
  responde con la pregunta y lo deja abierto.
- **La guardia** (revisar los encargos sola cada cierto tiempo) no es parte de este ADR: puede ser una tarea programada de Claude Code
  en el ordenador (MCP por stdio) o una rutina en la nube con el MCP remoto. La remota depende de que el conector OAuth con el segundo
  factor funcione de forma estable ([gotchas/db](../gotchas/db.md), «Con el segundo factor activado, el MCP remoto no ve nada»).

### Interfaz

- Subrayado en el color de acento (el de Claude, en su tono) que se dibuja de izquierda a derecha en 0,6 s al nacer; se ilumina al
  pasar por encima y al abrir su hilo. Con «menos movimiento», sin animación.
- Ordenador: hilos en el margen derecho, alineados con su texto. Teléfono: un toque en el subrayado abre el hilo en una hoja inferior.
  Un contador en la barra abre la lista de la nota (abiertos, «Sin sitio» y resueltos).
- Feedback con `notify` y «Deshacer» ([ADR-0019](0019-feedback-con-notificaciones.md)): «Comentario añadido», «Resuelto»
  (deshacer = reabrir), «Reabierto». Textos con i18next ([ADR-0077](0077-i18n-ingles-por-defecto-con-i18next.md)).

## Alternativas consideradas

- **Marcas en el Markdown** (`<!-- c:id -->…` o `[texto]{#c1}`): el ancla viaja con el texto, pero ensucia la nota para el MCP, para
  copiar como Markdown y para cualquier otra herramienta, y un `update_note` que no las respete las borra sin aviso.
- **Solo posiciones** (`start`, `end`): cualquier cambio anterior al trozo comentado lo desplaza a otro sitio sin enterarse.
- **Volver a anclar solo en la interfaz:** los cambios del MCP o del asistente con la app cerrada dejarían anclas viejas, y cada
  dispositivo podría llegar a una conclusión distinta.
- **Historial de versiones y transformación operacional (estilo Google Docs):** exacto, pero es un sistema de colaboración entero.
  Si algún día hay edición en tiempo real entre varias personas (Yjs), este ADR se reemplaza.

## Consecuencias

- Positivas: los comentarios sobreviven a cualquier camino de escritura; Claude puede revisar y atender notas sin reescribir el texto de
  Alex por su cuenta; el teléfono gana un uso claro sin tener que ser un buen editor.
- Negativas / costes:
  - `notes.update` hace más trabajo cuando cambia el contenido y hay hilos abiertos (una lectura de los hilos y un `update` por cada
    ancla que cambia). Con decenas de hilos por nota es despreciable.
  - `noteText` debe coincidir con el texto que pinta el editor; si no, una cita creada en la interfaz se buscará en otra proyección.
    Por eso la interfaz manda la **cita**, no posiciones, y hay tests que comparan las dos.
  - Escribir sin conexión ([ADR-0034](0034-escribir-sin-conexion.md)) debe incluir los comentarios en la cola de la nota.
- Relacionado: [ADR-0078](0078-editor-de-notas-en-sitio-con-tiptap.md), [ADR-0009](0009-mcp-stdio-sin-borrados.md),
  [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md), [ADR-0007](0007-registro-de-actividad.md) (actor).
