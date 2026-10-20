# ADR-0032: Columna «Para el agente»: etiqueta en la issue, Claude Code GitHub Action y PR que mueve la tarea

- **Estado:** Aceptado
- **Fecha:** 2026-10-19 (propuesto) · 2026-10-20 (aceptado, revisado tras poner en marcha la sincronización)
- **Área:** ci, core, db

## Contexto

El diseño (GitHub.dc.html) tiene una columna «Para el agente»: arrastras una tarea ahí y un agente la resuelve en su repositorio,
abre un PR y la tarea avanza sola. Se propuso el 19 de octubre y se revisó el 20, con la sincronización issues ↔ tareas
([ADR-0031](0031-sync-github-issues-tareas.md)) ya en marcha y probada. La revisión encontró cuatro huecos en la propuesta:

- `Closes #n` solo cierra la issue al fusionar en la **rama por defecto**; los PRs del agente van a `develop` (en `huginnDB`, la rama
  por defecto es `main`), así que «PR fusionado → la issue se cierra → la tarea se completa» no pasaba nunca.
- `claude-code-action` **no abre PRs por defecto**: sube la rama y deja un enlace para crearlo a mano.
- Si el agente terminaba **sin PR**, la tarea se quedaba en la columna para siempre.
- Sacar la tarea de la columna no paraba una ejecución ya empezada.

## Decisión

**La columna.** Una columna normal (cualquier tipo menos `done`) que el proyecto marca como la del agente:
`projects.agent_column_id uuid null references board_columns (id) on delete set null` (migración `20261020133907_agent_column`, con
un trigger que exige que sea del mismo proyecto y dueño). No hay un `kind` nuevo ([ADR-0005](0005-columnas-con-kind-semantico.md)).
Se marca desde el menú de la columna («Usar para el agente»), solo en proyectos con repo y con el módulo GitHub activado. No cuenta
como columna por defecto: ni las issues nuevas ni las tareas reabiertas caen ahí aunque sea la primera «Por hacer».

**Una regla: estar en la columna del agente ⇔ la issue tiene la etiqueta `muninn:agent`.**
1. **Mover** una tarea de GitHub a la columna apunta en la cola de salida ([ADR-0031](0031-sync-github-issues-tareas.md)) una entrada
   `kind = 'agent'` (columna nueva y aditiva de `github_outbox`). Sacarla, también. Una tarea manual no tiene issue: el core lo rechaza
   («Solo las tareas de GitHub pueden ir al agente») y la UI avisa antes de moverla. Lo que mueven la sincronización (actor `github`) o
   el flujo del agente (actor `agent`) no se apunta: la etiqueta ya está como debe.
2. **La Edge Function** vacía la entrada releyendo la tarea, como las de estado: si está en la columna (sin archivar), pone la
   etiqueta; si no, la quita. Solo toca la issue si no está ya así.
3. **La Action** (`anthropics/claude-code-action@v1`, ejemplo en [`docs/agente/muninn-agent.yml`](../agente/muninn-agent.yml)) corre con
   `on: issues: [labeled]`, solo con `muninn:agent`, en una issue abierta y si la puso el dueño del repo (`github.event.sender.login`).
   Con `prompt` y `--allowedTools` limitado a editar, `git`, `gh pr create`, `gh issue view/comment` y las herramientas del repo:
   resuelve en `agent/issue-<n>` desde `develop` y abre el PR contra `develop` con `Closes #<n>`. Nunca fusiona. Usa la **GitHub App
   de Claude**: sus PRs lanzan la CI del repo (los de `GITHUB_TOKEN` no). Límite de turnos y de tiempo.
4. **Al terminar, el workflow quita la etiqueta** (paso `if: always()`, con `GITHUB_TOKEN`, que no lanza otros workflows). Si para
   entonces no hubo PR, el webhook (`issues` › `unlabeled`) encuentra la tarea aún en la columna y la devuelve a «Por hacer» con la nota
   «terminó sin abrir un PR» (`agent_stopped`). Para reintentarlo, se vuelve a mover a la columna.
5. **Sacar la tarea a mano cancela la ejecución:** Muninn quita la etiqueta con su token, y un job `stop` del mismo workflow
   (`issues` › `unlabeled`) entra en el `concurrency` de la issue con `cancel-in-progress`.

**Los PRs del agente mueven la tarea** (`m.github.applyPullRequest`, idempotente, actor `agent`; el webhook se suscribe también a
`pull_request`). Un PR es del agente si su rama es `agent/issue-<n>`; en otra rama `agent/…`, el número sale de
`Closes|Fixes|Resolves #n` en la descripción. Los demás PRs se ignoran.
- **Abierto** (no en borrador) → la tarea pasa a la primera columna `review` (`agent_pr_opened`, con el enlace al PR).
- **Fusionado** → la tarea se completa (`agent_pr_merged`), lo que apunta cerrar la issue por la regla de ADR-0031. Funciona con
  cualquier rama destino; si GitHub ya la cerró (fusión en la rama por defecto), la cola ve que no hay nada que hacer.
- **Cerrado sin fusionar** → vuelve a «Por hacer» (`agent_pr_closed`).

**Que no espere al cron.** `POST /github/sync` acepta también la sesión del dueño (como `/repos`, [ADR-0035](0035-repos-de-github-desde-la-funcion.md))
y un `scope`: `outbox` solo vacía la cola, `all` hace la reconciliación entera. La app pide `outbox` justo después de mover una tarea
de GitHub (agrupando los cambios seguidos y sin esperar respuesta): la etiqueta y el cierre de la issue llegan en segundos. Si falla, el
cron lo lleva igual en ≤ 5 minutos. `all` es lo que usará «Sincronizar ahora» en la pantalla GitHub.

**Lo que no hace falta.** El token de la sincronización no necesita permisos nuevos: poner y quitar etiquetas entra en *Issues: write*,
y lo de los PRs llega en el webhook. No hay reconciliación de PRs: si se pierde un webhook de PR, se ve en GitHub y la tarea se mueve
a mano. El secreto de Anthropic vive en el repo de GitHub, no en Muninn.

## Alternativas consideradas

- **La tarea se queda en la columna cuando el agente falla** (la propuesta original): parece que sigue trabajando, y para reintentar
  había que sacarla y volver a meterla. Con la regla «columna ⇔ etiqueta» el estado se lee de un vistazo.
- **Confiar en `Closes #n`:** no cierra nada si el PR no va a la rama por defecto. Por eso la fusión la trata Muninn.
- **Dejar que la Action solo suba la rama** (su comportamiento por defecto): el PR lo tendrías que abrir tú, y la tarea no sabría nada.
- **Lanzar el agente desde Muninn** (una Edge Function que llama a la API de Claude y escribe en el repo): habría que dar a Muninn
  permisos de escritura de código y resolver ejecución larga, entorno y CI. La Action ya trae todo eso y se ejecuta donde está el código.
- **Un `kind` nuevo `agent`:** cambia un enum que usan los resúmenes, el MCP y los filtros, y no aporta semántica.
- **Asignar la issue a un usuario bot** en lugar de etiquetar: necesita una cuenta de GitHub más.
- **Reconciliar también los PRs y las etiquetas** en el cron: más llamadas y más casos para un fallo raro (perder un webhook).
- **Webhook `workflow_run`** para el estado de cada ejecución (pantalla «Ejecuciones recientes» del diseño): útil, pero aparte.

## Consecuencias

- Cada tarea enviada al agente cuesta una ejecución de Actions y uso de Anthropic: el filtro por dueño, el límite de turnos y de tiempo y
  la cancelación al sacarla lo acotan.
- **Ojo con las issues de terceros** en un repo público: el agente lee la issue entera y una issue puede intentar darle instrucciones.
  Lo acotan las herramientas permitidas, que nunca fusiona y que el PR lo revisas tú; mueve al agente solo issues que hayas leído.
- Si la columna del agente se borra, `agent_column_id` vuelve a `null` y las tareas que tenía se mueven (y pierden la etiqueta).
- Puesta en marcha: migración, desplegar la función, suscribir el webhook a `pull_request`, y en el repo: la GitHub App de Claude, el
  secreto y el workflow. Pasos en [gotchas/ci](../gotchas/ci.md#columna-para-el-agente-pasos-manuales).
- Relacionado: [ADR-0031](0031-sync-github-issues-tareas.md), [ADR-0035](0035-repos-de-github-desde-la-funcion.md),
  [ADR-0010](0010-ramas-y-releases.md), [ADR-0005](0005-columnas-con-kind-semantico.md), `packages/core/src/github-sync.ts`.
