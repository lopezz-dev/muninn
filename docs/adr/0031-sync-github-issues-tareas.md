# ADR-0031: Sync GitHub: issues ↔ tareas con webhook y reconciliación en una Edge Function

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** core, db

## Contexto

La F2 pide que las issues de un repositorio aparezcan como tareas del proyecto vinculado (`projects.github_repo`) y que cerrar
una issue complete su tarea y al revés. El esquema ya lo preveía: `tasks.source = 'github'`, `external_id`/`external_url` y un
índice único `(owner_id, source, external_id)`. Hay que decidir cómo llegan las issues, dónde vive el token, qué campo manda en cada
lado, cómo vuelve a GitHub lo que se hace en Muninn y qué pasa con los conflictos y las issues borradas. Restricciones: todo pasa
por `createMuninn` ([ADR-0002](0002-api-de-dominio-unica.md)), Supabase solo en `supabase-store.ts`, ningún secreto en el cliente
ni en el repo, sin borrados definitivos y un solo usuario hoy (pero sin cerrar la puerta a varios).

## Decisión

**Transporte.** Una Edge Function de Supabase, `github` (`supabase/functions/github`), con dos rutas:
- `POST /github/webhook`: GitHub avisa al momento (evento `issues`). Se comprueba `X-Hub-Signature-256` con `GITHUB_WEBHOOK_SECRET`.
- `POST /github/sync`: la **reconciliación**, que lanza `pg_cron` cada 5 minutos (cabecera `x-muninn-sync-secret`). Vacía la cola de
  salida y repasa las issues abiertas de cada repo vinculado, por si se perdió algún webhook.
Webhook para la inmediatez, sondeo para la fiabilidad: ninguno de los dos solo basta.

**Token y dueño.** Un *fine-grained personal access token* de GitHub (Issues: lectura y escritura; Metadata: lectura; solo los repos
vinculados) como **secreto de la Edge Function** (`GITHUB_TOKEN`), nunca en la base ni en la app. La función usa la service role y
`MUNINN_USER_ID`, como el MCP ([ADR-0009](0009-mcp-stdio-sin-borrados.md)): un usuario por despliegue. Para varios usuarios se
pasará a una **GitHub App** con instalación por usuario; pedirá su propio ADR.

**Mapeo.** Un repo ↔ un proyecto por usuario (el índice `projects_owner_repo_uq` ya lo impone). La tarea de una issue tiene
`source = 'github'`, `external_id = 'owner/repo#123'` (repo en minúsculas) y `external_url` = la de la issue. Los PRs no se importan.

**Quién manda en cada campo.**
- **GitHub:** título y descripción (se sobrescriben cuando cambian; en la app se ven de solo lectura con un aviso).
- **Muninn:** columna, orden, prioridad, fecha, subtareas y notas. Las etiquetas de la issue se copian **solo al crear** la tarea.

**Cerrar ↔ completar.**
- GitHub → Muninn: issue cerrada → la tarea pasa a la primera posición de la columna `done`; reabierta → vuelve a la columna por
  defecto. Una issue nueva que ya está cerrada no se importa (no traemos el historial).
- Muninn → GitHub: el **core** apunta en una cola (`github_outbox`, migración `20261020000000_github_outbox`) cada vez que una tarea
  de GitHub entra en `done` o sale de ahí (también al cambiar el tipo de una columna). No apunta lo que hace la propia sincronización
  (actor `github`): así no hay ida y vuelta. La función relee la tarea al procesar la cola (cuenta el estado de ahora, no el de cada
  clic), solo cambia la issue si no está ya así y reintenta hasta 5 veces guardando el error.

**Conflictos.** Mientras una tarea tiene un envío pendiente en la cola, **manda Muninn**: ni un webhook ni la reconciliación le
cambian el estado (el de la issue es viejo). Sin envío pendiente, el último evento gana.

**Issues borradas o transferidas.** La tarea se **archiva**, nunca se borra. Una tarea archivada en Muninn no se toca: archivar es
«no la quiero ver», y la sincronización no la resucita.

**Dónde vive la lógica.** Reglas de dominio en `createMuninn` (`m.github.*`: `applyIssue`, `removeIssue`, `stateOf`, la cola) y el
cliente REST, la firma del webhook, el vaciado de la cola y la reconciliación en `@muninn/core/github` (`github-sync.ts`), con tests y
`fetch`/`crypto.subtle` inyectables. La Edge Function solo lee secretos y enruta; el core se le empaqueta con
`pnpm --filter @muninn/core build:edge` (Deno no resuelve los imports sin extensión del TS fuente).

## Alternativas consideradas

- **Solo sondeo:** sin URL pública ni secreto de webhook, pero con minutos de retraso y más llamadas a la API.
- **Solo webhook:** un fallo de entrega (función caída, despliegue) pierde el cambio para siempre.
- **GitHub App desde ya:** la buena para varios usuarios, pero exige firmar JWT con una clave privada y gestionar instalaciones,
  para un único usuario hoy. Queda como siguiente paso.
- **Token en una tabla (por usuario):** abre la puerta a varios usuarios, pero un secreto en la base de datos se filtra con cualquier
  error de RLS o copia de seguridad. Como secreto de la función no sale de ahí.
- **Trigger de base de datos para la cola** en lugar del core: no pasaría por los tests del core ni por el store de memoria, y no sabría
  quién hizo el cambio (el actor), que es lo que evita el bucle.
- **Sincronizar también etiquetas y fechas en los dos sentidos:** más conflictos para poco; se puede añadir con este mismo esquema.

## Consecuencias

- Lo de GitHub llega en segundos (webhook) y, si algo falla, en ≤ 5 minutos (reconciliación). Lo de Muninn llega a GitHub en ≤ 5 minutos.
- **Orden de puesta en marcha:** la migración de la cola debe aplicarse antes de que exista ninguna tarea de GitHub; si no, completar
  una fallaría al apuntarla. Pasos en [gotchas/db](../gotchas/db.md#sincronización-con-github-pasos-manuales).
- Renombrar el repo en GitHub cambia su `full_name`: hay que actualizar `github_repo` del proyecto, y las tareas antiguas no casarían con
  los ids nuevos (se crearían otras). Poco frecuente; queda documentado.
- La cola guarda filas procesadas: hará falta limpiarlas de vez en cuando (un `delete` con la service role; ver gotchas/db).
- Relacionado: [ADR-0002](0002-api-de-dominio-unica.md), [ADR-0007](0007-registro-de-actividad.md),
  [ADR-0009](0009-mcp-stdio-sin-borrados.md),
  [gotchas/core](../gotchas/core.md), `packages/core/src/github-sync.ts`, `supabase/functions/github/index.ts`.
