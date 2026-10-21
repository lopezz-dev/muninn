# Gotchas · ci (GitHub Actions, ramas, releases)

### release-please necesita permiso para crear PRs

- **Síntoma:** el job falla con `GitHub Actions is not permitted to create or approve pull requests`.
- **Causa:** es un ajuste del repositorio (Settings → Actions → Workflow permissions).
- **Solución:** ya está activado en `lopezz-dev/muninn`. En un fork o un repo nuevo:
  `gh api -X PUT repos/<owner>/<repo>/actions/permissions/workflow -f default_workflow_permissions=write -F can_approve_pull_request_reviews=true`

### macOS cuesta ×10 minutos en repos privados

- El plan gratuito incluye unos 2000 minutos al mes, y cada minuto de macOS cuenta como 10. Por eso macOS
  solo se compila en `release.yml`, nunca en los PRs. No lo añadas a `ci.yml`.

### Secretos de Apple vacíos

- **Síntoma:** el bundle de macOS falla al importar el certificado.
- **Causa:** si `APPLE_CERTIFICATE` existe pero está vacío, Tauri intenta importarlo igualmente.
- **Solución:** `release.yml` solo exporta las variables `APPLE_*` si el secreto tiene valor. Mantén ese patrón.

### El back-merge a `develop` puede fallar

- **Síntoma:** el job `back-merge` falla tras una release.
- **Causa:** hay conflictos, o `develop` tiene una protección que impide el push de `github-actions[bot]`.
- **Solución:** hazlo a mano con `git checkout develop && git merge origin/main`. Si se protege `develop`,
  permite el bypass al bot.

### El auto-updater no funciona con releases privadas

- Las releases de un repo privado no son descargables sin token. Para el updater de Tauri hará falta un
  repo público solo de binarios o un endpoint propio. Está en el backlog del roadmap.

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
