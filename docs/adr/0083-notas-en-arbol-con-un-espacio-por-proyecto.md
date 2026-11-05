# ADR-0083: Notas en árbol (páginas con hijas, carpetas incluidas) y un espacio por proyecto

- **Estado:** Aceptado
- **Fecha:** 2026-11-05
- **Área:** db, core, web, mcp
- **Complementa a:** [ADR-0078](0078-editor-de-notas-en-sitio-con-tiptap.md), [ADR-0079](0079-comentarios-anclados-en-las-notas.md)

## Contexto

Las notas son planas: cada una puede ir ligada a un proyecto (`project_id`) o a una tarea (`task_id`), y la pantalla de Notas es una
lista con buscador y filtros. Alex pidió el 05-11 poder **crear carpetas y, dentro, páginas con sus hijas**, para repartir el texto. Su
ejemplo: la tabla de la planificación es la nota padre y, debajo, en hijas, los ajustes y el contexto que se han ido documentando. Hoy
eso acaba todo en una sola nota cada vez más larga (la de planificación ya pasa de 20.000 caracteres).

Decisiones de Alex del 05-11:
- **Un solo árbol**: carpetas y páginas son la misma cosa. Una carpeta es una página que agrupa (puede no tener texto), y cualquier
  página puede tener hijas a cualquier nivel, como en Notion o Confluence.
- **Cada proyecto es un espacio**, como un espacio de Confluence: la raíz de su propio árbol. Las notas sin proyecto van a un
  espacio **General**.
- Va **lo primero en la 0.11**, antes del editor en sitio y de los comentarios, porque cambia el modelo y la pantalla en la que se
  apoyan los dos.

Restricciones: todo pasa por el core ([ADR-0002](0002-api-de-dominio-unica.md)); el orden, con *fractional indexing*
y `collate "C"` ([ADR-0006](0006-orden-con-fractional-indexing.md)); lo que cambia o destruye datos, con «Deshacer»; el MCP no borra.

## Decisión

- **Modelo** (migración nueva, solo aditiva):
  - `notes.parent_id uuid references notes (id)`: la madre, o `null` en la raíz de su espacio.
  - `notes.position text collate "C"`: el orden entre hermanas, con *fractional indexing* como columnas y tareas.
  - `notes.kind text check (kind in ('page', 'folder')) default 'page'`. Una **carpeta** es una página que se pinta con icono de
    carpeta y abre su lista de hijas en lugar de un texto vacío. Si se escribe en ella, sigue siendo carpeta: el tipo es solo cómo se
    presenta, y se puede cambiar.
  - Índice `(owner_id, project_id, parent_id, position)` para pintar un nivel.
- **Espacio = proyecto.** El espacio de una nota es su `project_id`; `null` es «General». Una hija **siempre está en el espacio de su
  madre**: lo comprueba el core y, como última barrera, un *trigger* (`enforce_note_tree`), igual que `enforce_task_consistency` con
  las tareas. El *trigger* también impide ciclos (una nota no puede colgar de sí misma ni de una de sus descendientes).
- **Mover** (`m.notes.move`): a otra madre, a otra posición o a otro espacio. Mover a otro espacio se lleva **todo el subárbol** (las
  hijas cambian de `project_id` con ella), con «Deshacer». Una nota ligada a una tarea (`task_id`) vive en el espacio del proyecto de la
  tarea y no puede salir de él.
- **Archivar una página archiva sus descendientes**, en la misma operación y con un solo «Deshacer» que lo restaura todo. Restaurar una
  hija cuya madre está archivada la pone en la raíz de su espacio.
- **Pantalla de Notas:** a la izquierda (en el móvil, en una hoja), los espacios y, en cada uno, el árbol plegable, con arrastrar para
  mover y ordenar (dnd-kit, [ADR-0023](0023-drag-and-drop-con-dnd-kit.md)) y «Nueva página aquí» / «Nueva carpeta» en cada nivel. En la
  nota, una **ruta de migas** (Espacio › Carpeta › Página) y, al pie, sus hijas. El buscador y las fijadas siguen igual y buscan en
  todo el árbol.
- **MCP** (catálogo único, [ADR-0041](0041-asistente-local-con-catalogo-unico.md)): `create_note` acepta `parentId` y `kind`;
  `list_notes` puede devolver un nivel (`parentId`) o el árbol de un espacio; nueva `move_note`. Sin borrados. Así Claude puede
  documentar el contexto como hijas de una nota, que es justo el ejemplo de Alex.
- **Migración de lo que hay:** las notas actuales quedan en la raíz de su espacio (`parent_id = null`), con `position` por fecha de
  actualización, de la más reciente a la más antigua. Nada se mueve solo.

## Alternativas consideradas

- **Carpetas como entidad aparte** (tabla `note_folders`, que solo contienen páginas): queda más ordenado, pero son dos conceptos, dos
  formas de mover y dos tipos en el MCP. Alex eligió un solo árbol.
- **Árbol libre, sin espacios** (el proyecto como simple etiqueta): más flexible, pero una carpeta podría mezclar notas de varios
  proyectos y el árbol no casaría con cómo se trabaja por proyecto. Alex eligió un espacio por proyecto.
- **Ruta materializada** (`path` tipo `a.b.c`) o `ltree`: leer un subárbol sería más rápido, pero mover obliga a reescribir los caminos
  de todos los descendientes. Con `parent_id` y una consulta recursiva para archivar o mover un subárbol basta para el tamaño de esto.
- **Límite de profundidad:** no hay en el modelo. La interfaz deja de sangrar a partir del sexto nivel y lo enseña con la ruta de migas.

## Consecuencias

- Las notas largas se pueden partir en una madre y sus hijas, y Claude puede colgar el contexto donde toca.
- Mover una nota de proyecto pasa a ser una operación de árbol (con sus hijas). El tablero y la tarea siguen viendo sus notas igual.
- «Escribir sin conexión» ([ADR-0034](0034-escribir-sin-conexion.md), 0.12) tendrá que contar con `move` y con archivar
  un subárbol en su cola.
- Los comentarios ([ADR-0079](0079-comentarios-anclados-en-las-notas.md)) no cambian: van con su nota, se mueva donde se mueva.
- La 0.11 se carga: si no cabe todo, los comentarios pasan a la 0.12 y se reajusta la planificación.
- Relacionado: `supabase/migrations` (nueva), `packages/core/src/service.ts` (`notes`), `schemas.ts`, `supabase-store.ts`,
  `memory-store.ts`, `@muninn/assistant/tools`, `apps/web/src/screens/Notas.tsx`, `NotaDetalle.tsx`, `docs/user/05-notas.md`.
