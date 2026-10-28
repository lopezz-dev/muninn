# Gotchas · ci (GitHub Actions, ramas, releases)

### release-please necesita permiso para crear PRs

- **Síntoma:** el job falla con `GitHub Actions is not permitted to create or approve pull requests`.
- **Causa:** es un ajuste del repositorio (Settings → Actions → Workflow permissions).
- **Solución:** ya está activado en `lopezz-dev/muninn`. En un fork o un repo nuevo:
  `gh api -X PUT repos/<owner>/<repo>/actions/permissions/workflow -f default_workflow_permissions=write -F can_approve_pull_request_reviews=true`

### macOS cuesta ×10 minutos en repos privados

- El plan gratuito incluye unos 2000 minutos al mes, y cada minuto de macOS cuenta como 10. Por eso macOS
  solo se compila en `release.yml`, nunca en los PRs. No lo añadas a `ci.yml`.
- Con el repo público ([ADR-0046](../adr/0046-repo-publico-con-licencia-mit.md)) los minutos no cuentan, pero compilar macOS
  sigue tardando: mantenlo solo al publicar.

### Secretos de Apple vacíos

- **Síntoma:** el bundle de macOS falla al importar el certificado.
- **Causa:** si `APPLE_CERTIFICATE` existe pero está vacío, Tauri intenta importarlo igualmente.
- **Solución:** `release.yml` solo exporta las variables `APPLE_*` si el secreto tiene valor. Mantén ese patrón.

### El Release PR falla en `pnpm lint` por `tauri.conf.json`

- **Síntoma:** CI del Release PR de release-please en rojo en `biome check`: «Formatter would have printed…» en
  `apps/desktop/src-tauri/tauri.conf.json`, con las listas `endpoints` y `targets` en una línea.
- **Causa:** release-please sube la versión reescribiendo el JSON entero con una lista por línea; Biome, en cambio, junta en una
  línea las listas que caben en 100 columnas.
- **Solución:** `biome.json` formatea `tauri.conf.json` con `expand: "always"`, igual que lo escribe release-please. No quites ese
  `override`.

### El back-merge a `develop` puede fallar

- **Síntoma:** el job `back-merge` falla tras una release.
- **Causa:** hay conflictos, o `develop` tiene una protección que impide el push de `github-actions[bot]`.
- **Solución:** hazlo a mano con `git checkout develop && git merge origin/main`. Si se protege `develop`,
  permite el bypass al bot.

### El actualizador solo funciona con el repo público

- **Síntoma:** las apps instaladas nunca ven la versión nueva, aunque la release tenga `latest.json`.
- **Causa:** el endpoint es `github.com/lopezz-dev/muninn/releases/latest/download/latest.json` ([ADR-0047](../adr/0047-actualizaciones-de-escritorio-firmadas.md)).
  Mientras el repo sea privado, GitHub contesta 404 sin token, y la app calla.
- **Solución:** hacer público el repo ([ADR-0046](../adr/0046-repo-publico-con-licencia-mit.md)) antes de la primera release.

### La release falla en «Comprobar la clave de firma del actualizador»

- **Síntoma:** el job `desktop` de `release.yml` para en ese paso, sin compilar nada.
- **Causa:** falta el secreto `TAURI_SIGNING_PRIVATE_KEY`, o `plugins.updater.pubkey` de `tauri.conf.json` sigue con el texto
  `PENDIENTE_CLAVE_PUBLICA…`. Es a propósito: sin firma, las apps instaladas rechazarían la versión.
- **Solución:** los pasos de la [fase final](../fase-final.md#10-repo-público-y-primera-versión-de-escritorio). Después, relanza los
  jobs fallidos de esa ejecución (**Re-run failed jobs**): release-please no vuelve a crear la release.
- **Ojo:** la clave privada y su contraseña solo existen en tu gestor de contraseñas y en los secretos. Si se pierden, ninguna
  instalación aceptará actualizaciones firmadas con una clave nueva: habrá que reinstalar a mano en cada equipo.

### `latest.json` tarda unos minutos en aparecer

- **Síntoma:** justo tras fusionar el Release PR, la release ya está publicada pero sin instaladores ni `latest.json`.
- **Causa:** release-please publica la release en cuanto se fusiona y `tauri-action` sube los ficheros cuando acaba de compilar
  cada plataforma (macOS es la más lenta). Las tres fusionan sus entradas en el mismo `latest.json`; `retryAttempts: 3` cubre la carrera.
- **Solución:** nada; mientras, la app recibe un 404 y no avisa. Si un job falla, la release se queda con las plataformas que sí
  acabaron: relanza el que falló.

### Windows: solo NSIS, sin MSI

- **Síntoma** (si vuelves a `"targets": "all"`): el bundle de Windows falla al generar el `.msi` con errores de WiX o VBScript.
- **Causa:** el MSI lo hace WiX v3, abandonado desde febrero de 2025, y el `windows-latest` de 2026 (Windows Server 2025) lo rompe.
  Le pasó a huginnDB.
- **Solución:** `bundle.targets` lista los formatos y en Windows solo hay `nsis`. Es también lo que usa el actualizador.

### `ubuntu-22.04` tiene fecha de caducidad

- `release.yml` y `desktop-ci.yml` compilan Linux en `ubuntu-22.04` para que el AppImage arranque en distribuciones con glibc 2.35.
  GitHub la retira: apagones programados desde finales de marzo de 2027 y fuera de servicio el 17 de abril de 2027
  (actions/runner-images#14254). Pásalas a `ubuntu-24.04` antes; el AppImage pedirá glibc 2.39 o más.

### Los commits deben seguir Conventional Commits

- Un commit sin el formato `tipo(área): mensaje` no aparece en el CHANGELOG ni sube versión.
  `feat` sube la *minor* (mientras sea `0.x`), `fix` la *patch*, y `feat!` o `BREAKING CHANGE` la *major*.

### Columna «Para el agente» (pasos manuales)

- **Síntoma:** mueves una tarea de GitHub a la columna del agente y no pasa nada en el repo, o la etiqueta `muninn:agent` aparece
  pero ningún workflow arranca, o el PR se abre y la tarea no pasa a «Revisión».
- **Causa:** el flujo ([ADR-0032](../adr/0032-columna-para-el-agente.md)) necesita piezas que no están en el código de Muninn: la
  migración, la función desplegada, el webhook suscrito a `pull_request` y, en el repo vinculado, la GitHub App de Claude, su secreto y
  el workflow.
- **Solución**, en este orden (además de la [puesta en marcha de la sincronización](db.md#sincronización-con-github-pasos-manuales)):
  1. **Migración** `supabase/migrations/20261020133907_agent_column.sql` (columna `agent_column_id` y `kind` en la cola). Si usas
     `apply_migration` del MCP de Supabase, alinea la versión (ver gotchas/db).
  2. **Desplegar la función:** `pnpm --filter @muninn/core build:edge` y
     `supabase functions deploy github --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt`.
  3. **Webhook:** en el repo, **Settings › Webhooks** › el de Muninn › *Let me select individual events* › marca **Pull requests**
     además de *Issues*. O con `gh`: `gh api -X PATCH repos/<owner>/<repo>/hooks/<id> -f 'events[]=issues' -f 'events[]=pull_request'`.
  4. **En el repo:** instala la [GitHub App de Claude](https://github.com/apps/claude) solo en ese repo, y guarda el secreto:
     `claude setup-token` y `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R <owner>/<repo>` (o `ANTHROPIC_API_KEY`).
  5. **El workflow:** copia [`docs/agente/muninn-agent.yml`](../agente/muninn-agent.yml) en `.github/workflows/muninn-agent.yml` y
     llévalo a la **rama por defecto** del repo (ver el ojo de abajo).
  6. **En Muninn:** menú de la columna › **Usar para el agente**.
- **Verificar:** mueve una tarea de GitHub a la columna: la issue gana `muninn:agent` en segundos y arranca «Muninn · agente» en
  **Actions**. Si abre PR, la tarea pasa a «Revisión» con «Ver el PR» en su actividad; fusionarlo la completa y cierra la issue.
- **Ojo:** los workflows que lanza un evento `issues` se leen de la **rama por defecto**. Si el repo trabaja en `develop` y su rama por
  defecto es `main` (como `huginnDB`), el workflow tiene que estar en `main` o no arranca nunca, aunque esté en `develop`.
- **Ojo:** la etiqueta la pone el token de la sincronización, que es tuyo: por eso el workflow filtra por
  `github.event.sender.login == github.repository_owner`. Si el repo es de una organización, cambia esa condición por tu usuario.

### El agente falla en segundos sin decir por qué

- **Síntoma:** «Muninn · agente» acaba en rojo en 2–3 s, con `is_error: true`, `num_turns: 1`, `total_cost_usd: 0` y
  `modelUsage: {}`; la tarea vuelve a «Por hacer» sin PR.
- **Causa:** Claude no llega al modelo (token mal pegado o caducado, cuota, modelo…), pero la Action oculta su salida, también
  en modo debug. `show_full_output: true` lo enseña todo, y en un repo público eso queda a la vista.
- **Solución:** el workflow tiene el paso «Mostrar el error de Claude», que solo al fallar imprime el mensaje final (`result`).
  Para probar el token en local: `$env:CLAUDE_CODE_OAUTH_TOKEN = "<token>"` y `claude -p "di hola" --model sonnet` (el `--model`
  evita que un modelo roto en tu `~/.claude/settings.json` falle antes de probar el token).

### Sacar la tarea no siempre cancela a tiempo

- **Síntoma:** sacas la tarea de la columna del agente con la ejecución en marcha y aun así aparece un PR del agente; la ejecución sale
  «cancelled» pero todos sus pasos en verde, y la tarea salta a «Revisión».
- **Causa:** el job `stop` cancela por `concurrency`, pero solo cuando consigue runner (~30 s el 21 de octubre). Una issue sencilla se
  resuelve en menos (52 s, y el PR se abrió 10 s antes de la cancelación). Muninn mueve a «Revisión» cualquier PR abierto del agente.
- **Solución:** el paso «Cerrar el PR si sacaste la tarea» del workflow: antes de quitar la etiqueta, si ya no está (la quitó Muninn), cierra
  los PRs abiertos de `agent/issue-<n>`, y el webhook devuelve la tarea a «Por hacer». La rama se queda; bórrala a mano si quieres.

### `tauri-action` va fijada a un commit

- **Por qué:** recibe `TAURI_SIGNING_PRIVATE_KEY`. Con `@v0`, quien controlase esa etiqueta podría cambiar el código que ve la clave.
- **Cómo subirla:** busca el commit de la nueva versión (`gh api repos/tauri-apps/tauri-action/git/ref/tags/action-vX.Y.Z`), revisa
  sus cambios y sustituye el SHA y el comentario `# action-vX.Y.Z` en `release.yml`. La 1.0 cambia entradas: léete sus notas antes.
