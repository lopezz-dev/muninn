# ADR-0010: Ramas `main`/`develop`, Conventional Commits y release-please

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** ci

## Contexto

El autor trabaja con `main` como rama principal (producción) y `develop` como rama de desarrollo,
y quiere publicar versiones con GitHub Actions y GitHub Releases. El repositorio es privado.

## Decisión

- `main` = producción (rama por defecto). `develop` = integración. El trabajo va en ramas
  `feat/*`, `fix/*` o `docs/*`, con PR a `develop`.
- Commits con **Conventional Commits**.
- Al hacer push a `main`, **release-please** abre o actualiza un Release PR con la versión
  (semver, mientras `0.x` un `feat` sube la *minor*) y el CHANGELOG. Al mergearlo:
  - se crea el tag y la GitHub Release;
  - **tauri-action** compila Windows, Linux y macOS (universal) y adjunta los instaladores;
  - un job hace back-merge de `main` a `develop`.
- La versión se sincroniza en `package.json` (raíz, web y desktop), `tauri.conf.json` y `Cargo.toml` (`extra-files`).
- La firma de macOS es opcional mediante los secretos `APPLE_*`.

## Alternativas consideradas

- **Changesets:** pensado para publicar varios paquetes; aquí solo se versiona la app.
- **Tags manuales:** propenso a errores y sin CHANGELOG.

## Consecuencias

- Los minutos de macOS en repos privados cuentan ×10: solo se compila al publicar.
- Requiere que Actions pueda crear PRs (ajuste del repositorio ya aplicado).
- El auto-updater de escritorio no puede descargar desde releases privadas: queda pendiente.
  Ver [gotchas/ci](../gotchas/ci.md).
