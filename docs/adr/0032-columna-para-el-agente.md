# ADR-0032: Columna «Para el agente»: etiqueta en la issue, Claude Code GitHub Action y PR que mueve la tarea

- **Estado:** Propuesto
- **Fecha:** 2026-10-19
- **Área:** ci

## Contexto

El diseño (GitHub.dc.html) tiene una columna «Para el agente»: arrastras una tarea ahí y un agente la resuelve en su repositorio,
abre un PR y la tarea avanza sola. Es solo diseño: no se implementa hasta que la sincronización issues ↔ tareas
([ADR-0031](0031-sync-github-issues-tareas.md)) esté desplegada y probada. Este ADR fija el flujo para no improvisarlo luego.

## Decisión

**La columna.** Una columna normal (tipo `todo`: planificado, sin empezar) que el proyecto marca como la del agente, con una columna
nueva y aditiva `projects.agent_column_id uuid null references board_columns (id) on delete set null`. No hay un `kind` nuevo: el tipo
sigue diciendo qué significa la columna para los resúmenes ([ADR-0005](0005-columnas-con-kind-semantico.md)), y borrar la columna apaga
la función sin dejar nada roto.

**El flujo.**
1. **Arrastras** a esa columna una tarea que viene de una issue. El core apunta en la cola de salida de ADR-0031 una entrada nueva de
   tipo `agent` (la cola gana una columna `kind text not null default 'state'`, aditiva). Una tarea manual no tiene issue: la UI avisa
   («Solo las tareas de GitHub pueden ir al agente») y no la mueve. Crear la issue desde Muninn queda para después.
2. **Se etiqueta la issue:** la Edge Function `github` vacía la entrada poniendo la etiqueta `muninn:agent` (`POST /issues/{n}/labels`).
   Sacar la tarea de la columna antes de que haya PR quita la etiqueta.
3. **Claude Code GitHub Action** (`anthropics/claude-code-action`) en el repo vinculado, con un workflow
   `on: issues: types: [labeled]` que solo corre si la etiqueta es `muninn:agent` **y** quien la puso es el dueño
   (`github.event.sender.login`): así nadie con permiso de *triage* gasta tu cuota. El prompt pide resolver la issue en una rama
   `agent/issue-<n>`, abrir un PR contra la **rama destino** (por defecto `develop`, como [ADR-0010](0010-ramas-y-releases.md)) con
   `Closes #<n>` en la descripción y no fusionar nunca. Límite de turnos y de tiempo en el workflow.
4. **La tarea se actualiza con los webhooks** (la función se suscribe también a `pull_request`):
   - PR abierto que cierra la issue (`Closes|Fixes|Resolves #n` en el cuerpo) → la tarea pasa a la primera columna de tipo `review`, con
     el enlace al PR en la actividad (actor `agent`).
   - PR fusionado → GitHub cierra la issue por el `Closes` → la tarea se completa por la regla de ADR-0031. No hace falta nada más.
   - PR cerrado sin fusionar → la tarea vuelve a la columna del agente sin etiqueta (para reintentar arrastrándola otra vez) y se anota
     «el agente no lo consiguió».
5. **Sin fusiones automáticas.** El PR lo revisas y fusionas tú; la CI del repo corre como en cualquier PR.

**Qué hace falta de ADR-0031 (B).** Webhook ya desplegado y suscrito a `pull_request`; cola de salida con `kind`; en el cliente REST
`addLabels`/`removeLabel`; en el core `m.github.applyPullRequest(repo, pr)` (idempotente, como `applyIssue`) y la columna del agente en
`projects`. El token de B necesita además permiso de *Pull requests: Read*. El secreto de Anthropic (`ANTHROPIC_API_KEY` o
`CLAUDE_CODE_OAUTH_TOKEN`) vive en los secretos del repo de GitHub, no en Muninn.

## Alternativas consideradas

- **Lanzar el agente desde Muninn** (una Edge Function que llama a la API de Claude y escribe en el repo): habría que dar a Muninn permisos
  de escritura de código y resolver ejecución larga, entorno y CI. La Action ya trae todo eso y se ejecuta donde está el código.
- **Un `kind` nuevo `agent`:** cambia un enum que usan los resúmenes, el MCP y los filtros, y no aporta semántica (sigue siendo «por hacer»).
- **Asignar la issue a un usuario bot** en lugar de etiquetar: necesita una cuenta de GitHub más y no funciona igual en todos los repos.
- **Webhook `workflow_run` para el estado de cada ejecución** (pantalla «Ejecuciones recientes» del diseño): útil, pero aparte; se puede
  añadir sin cambiar este flujo.

## Consecuencias

- Cada tarea enviada al agente cuesta una ejecución de Actions (minutos del plan) y uso de la API de Anthropic: el filtro por dueño y el
  límite de turnos lo acotan.
- La columna «Para el agente» solo tiene sentido en proyectos con repo vinculado; en los demás no se ofrece.
- Implementarlo pide: migración (`agent_column_id`, `kind` en la cola), core con tests, la Action de ejemplo en `docs/` y pasos manuales
  (secreto de Anthropic, instalar la GitHub App de Claude o el workflow, permiso de PRs en el token).
- Relacionado: [ADR-0031](0031-sync-github-issues-tareas.md), [ADR-0010](0010-ramas-y-releases.md), [ADR-0005](0005-columnas-con-kind-semantico.md).
