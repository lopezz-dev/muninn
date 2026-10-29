# ADR-0065: Los proyectos archivados se pueden eliminar para siempre, con «Deshacer» diferido, y archivar suelta el repo de GitHub

- **Estado:** Aceptado
- **Fecha:** 2026-10-29
- **Área:** core, web
- **Complementa a:** [ADR-0019](0019-feedback-con-notificaciones.md), [ADR-0009](0009-mcp-stdio-sin-borrados.md), [ADR-0031](0031-sync-github-issues-tareas.md)

## Contexto

Hasta ahora, un proyecto solo se podía archivar. En la fase final (paso 4d, 29 de octubre) salieron dos problemas:

- Los archivados se acumulan («Archivados» con proyectos de pruebas) y no hay forma de quitarlos desde la app.
- Un archivado seguía con su `github_repo`. Como el repo es único por dueño (`projects_owner_repo_uq`), no se podía vincular a otro
  proyecto, el archivado no salía en Integraciones para quitárselo y la sincronización seguía intentándolo («No se pudo sincronizar…»).
  Le pasó a `lopezz-dev/huginnDB`, retenido por un «Muninn» archivado.

[ADR-0019](0019-feedback-con-notificaciones.md) pide «Deshacer» en lugar de diálogos de confirmación, pero un borrado de verdad no se
puede deshacer después.

## Decisión

- **Archivar suelta el repo.** `m.projects.archive` pone `status = 'archived'` y `github_repo = null` en la misma escritura. El aviso
  dice «Ya no está vinculado a …». «Deshacer» devuelve el proyecto y vuelve a intentar vincular el repo; si el servidor lo rechaza (pide
  `aal2`, [ADR-0062](0062-aal2-para-integraciones-sensibles.md)), lo dice y no falla.
- **Eliminar solo archivados.** `m.projects.delete(id)` falla con `ValidationError` si el proyecto no está archivado: archivar es el
  paso que se deshace; eliminar es el segundo. Borra columnas, tareas (con sus subtareas y su cola de GitHub) y su actividad; las notas
  se quedan sin proyecto. Es lo que ya hacen las claves ajenas en Supabase; el store de memoria lo imita. En Supabase, el store borra
  antes las tareas porque `tasks.column_id` es `on delete restrict` y la cascada podría llegar antes a las columnas.
- **«Deshacer» diferido, sin diálogo.** En **Proyectos › Archivados**, la papelera de cada fila y **Eliminar todos** quitan los
  proyectos de la vista y enseñan el aviso con «Deshacer» durante 6 s. Solo al acabar ese tiempo se borran. Si se cierra la app antes,
  no se borra nada. Si algo falla, vuelven a la lista con un aviso de error.
- **El MCP no lo expone**: sigue sin borrados definitivos ([ADR-0009](0009-mcp-stdio-sin-borrados.md)), y el asistente tampoco.
- «Archivados» se ve también cuando no queda ningún proyecto activo (antes se escondía con el estado vacío).

## Alternativas consideradas

- **Diálogo «¿Seguro?»:** va contra ADR-0019 y se acepta sin leer. El retraso con «Deshacer» protege igual sin interrumpir.
- **Papelera con caducidad (borrar a los 30 días):** más segura, pero pide un cron y otra lista que mirar. Archivar ya hace de papelera.
- **Conservar el repo al archivar y solo avisar:** deja el repo bloqueado y la sincronización intentándolo. Soltarlo es lo que el
  usuario espera al archivar.
- **Que la sincronización ignore los archivados:** con el repo suelto ya no hace falta; los archivados que aún lo tengan (de antes de
  este cambio) se arreglan eliminándolos o recuperándolos y quitando el repo.

## Consecuencias

- Positivas: «Archivados» se puede vaciar, y archivar ya no bloquea repos.
- Negativas: si se cierra la pestaña justo tras pulsar, el borrado no ocurre (es lo seguro). Las imágenes del proyecto (logo y portada)
  se quedan en Storage sin dueño visible: no ocupan casi nada y no se pueden ver sin la ruta; limpiarlas queda para más adelante.
- Los archivados de antes de este cambio pueden seguir con repo: la lista lo dice («Sigue vinculado a …»).
- Relacionado: `packages/core/src/service.ts` (`archiveProject`, `deleteProject`), `memory-store.ts`, `supabase-store.ts`,
  `apps/web/src/lib/queries.ts` (`archiveProjectWithUndo`, `deleteArchivedWithUndo`), `apps/web/src/screens/Proyectos.tsx`,
  `docs/user/03-proyectos-y-tablero.md`.
