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
