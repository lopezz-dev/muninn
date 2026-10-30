# ADR-0067: Las tareas archivadas se pueden eliminar para siempre desde «Tareas archivadas», con «Deshacer» diferido

- **Estado:** Aceptado
- **Fecha:** 2026-10-30
- **Área:** core, web
- **Complementa a:** [ADR-0065](0065-eliminar-proyectos-archivados.md), [ADR-0025](0025-escrituras-optimistas-y-deshacer.md),
  [ADR-0009](0009-mcp-stdio-sin-borrados.md), [ADR-0031](0031-sync-github-issues-tareas.md)

## Contexto

Las tareas solo se podían archivar, y una tarea archivada no se veía en ningún sitio de la app: ni para recuperarla (más allá del
«Deshacer» del momento) ni para quitarla del todo. El core tenía un `tasks.delete` sin reglas que nadie usaba.

[ADR-0065](0065-eliminar-proyectos-archivados.md) ya resolvió lo mismo para proyectos: eliminar solo lo archivado, sin diálogo y con
«Deshacer» diferido. Las tareas tienen dos cosas que los proyectos no: notas vinculadas a la tarea y, si vienen de GitHub, una issue
que la sincronización vuelve a leer.

## Decisión

- **Mismo patrón que los proyectos.** `m.tasks.delete(id)` falla con `ValidationError` si la tarea no está archivada. En la UI se
  elimina desde **⋯ › Tareas archivadas** del tablero (papelera por fila y **Eliminar todas**): las quita de la vista, enseña el aviso
  con «Deshacer» durante 6 s y solo entonces borra (`deleteArchivedTasksWithUndo`). Si se cierra la app antes, no se borra nada; si
  algo falla, vuelven a la lista con un aviso de error. La misma lista ofrece **Recuperar** (`tasks.restore`).
- **Qué se va con la tarea:** sus subtareas y su cola de GitHub (`on delete cascade`). Sus notas **se quedan**, sin tarea
  (`on delete set null`): en un proyecto borrado las notas también sobreviven. El store de memoria lo imita (`dropTask`), y el
  borrado de proyectos lo reutiliza.
- **La actividad se conserva.** `activity` no tiene clave ajena a la tarea y es de solo inserción ([ADR-0007](0007-registro-de-actividad.md)):
  queda el historial, con un evento `deleted` («eliminaste la tarea»). Con un proyecto sí se va, porque cuelga de él.
- **No se toca la issue de GitHub.** Eliminar es «no la quiero en Muninn», no cerrar nada en GitHub. Si la issue sigue abierta y el
  proyecto vinculado, la sincronización la vuelve a traer como **tarea nueva**; el aviso lo dice cuando alguna de las eliminadas viene
  de GitHub. Para que no vuelva, se archiva (y se deja archivada) o se cierra la issue.
- **Sin migración.** La política `tasks_owner` es `for all` (cubre `delete`) y las cascadas ya existían. La prueba SQL
  `supabase/tests/borrar_tareas.sql` lo comprueba sin dejar nada.
- **El MCP y el asistente no lo exponen** ([ADR-0009](0009-mcp-stdio-sin-borrados.md)); los tests de ambos catálogos ya lo vigilan.
- «Deshacer» de una tarea recién creada sigue **archivándola** ([ADR-0025](0025-escrituras-optimistas-y-deshacer.md)): eliminar es
  siempre un segundo paso, a mano.

## Alternativas consideradas

- **Eliminar desde el detalle de cualquier tarea:** salta el paso reversible y obligaría a un diálogo o a una espera más larga.
  Archivar ya es el «quitar de en medio» del día a día.
- **Guardar una «lápida» para que la issue no vuelva:** otra tabla o columna, y un estado más que explicar. Archivar ya hace de lápida.
- **Cerrar la issue al eliminar:** cambiaría GitHub desde un gesto que se lee como «borrar de Muninn», y pediría `aal2` y la cola.
- **Borrar también la actividad de la tarea:** `activity` no admite borrados del usuario y el historial sirve para los resúmenes.
- **Lista de archivadas a pie del tablero (como en Proyectos):** el tablero ocupa toda la altura; un diálogo desde el menú del
  proyecto no le quita sitio.

## Consecuencias

- Positivas: las tareas archivadas se ven, se recuperan y se pueden quitar del todo, con el mismo gesto que los proyectos.
- Negativas: una tarea de GitHub eliminada con la issue abierta reaparece (lo avisa la app y la guía). Como en ADR-0065, si se cierra
  la pestaña justo tras pulsar, no se borra. La lista solo se pide al abrirla, así que el menú no dice cuántas hay.
- Relacionado: `packages/core/src/service.ts` (`deleteTask`), `memory-store.ts` (`dropTask`), `supabase-store.ts`,
  `apps/web/src/lib/task-actions.ts` (`restoreArchivedTask`, `deleteArchivedTasksWithUndo`),
  `apps/web/src/screens/tablero/ArchivedTasks.tsx`, `docs/user/04-tareas.md`, `supabase/tests/borrar_tareas.sql`.
