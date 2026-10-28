# ADR-0047: Actualizaciones de escritorio firmadas, publicadas en la GitHub Release y aplicadas con «Reiniciar»

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Área:** desktop, ci
- **Reemplaza a:** la consecuencia de [ADR-0010](0010-ramas-y-releases.md) que dejaba el auto-updater pendiente

## Contexto

Una app de escritorio instalada no sabe que hay versión nueva: habría que entrar en Releases y reinstalar a mano. Tauri 2 trae
`tauri-plugin-updater`, que lee un `latest.json`, descarga el instalador y comprueba su firma con una clave pública embebida en la
app. Faltaba un sitio público donde dejar ese `latest.json`; con el repo público ([ADR-0046](0046-repo-publico-con-licencia-mit.md))
lo es su propia GitHub Release. El flujo de versiones ya existe: release-please en `main` crea el tag y la release, y
`tauri-action` compila (ADR-0010).

## Decisión

- **Plugins:** `tauri-plugin-updater` (solo escritorio) y `tauri-plugin-process` (para reiniciar). Permisos `updater:default` y
  `process:allow-restart`.
- **Dónde:** `plugins.updater.endpoints` apunta a
  `https://github.com/lopezz-dev/muninn/releases/latest/download/latest.json`. `latest` es la última release publicada, así que
  solo cuentan las de `main`; `develop` nunca genera actualizaciones.
- **Firma:** una clave de `tauri signer generate`. La pública va en `plugins.updater.pubkey`; la privada y su contraseña, en los
  secretos `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. `release.yml` activa
  `bundle.createUpdaterArtifacts` solo en CI y se niega a compilar sin el secreto o con la clave pública provisional.
- **Instaladores:** en Windows solo NSIS (`-setup.exe`, sin administrador). Nada de MSI: lo genera WiX v3, abandonado, que dejó de
  funcionar en el `windows-latest` de 2026 (lo vivimos en huginnDB). En macOS, `.app` (su `.app.tar.gz` es lo que se actualiza) y
  `.dmg`; en Linux, AppImage (se actualiza sola), `.deb` y `.rpm` (no).
- **En la app** (`apps/web/src/lib/desktop-update.ts`, cargado desde `main.tsx` solo con `TAURI_ENV_PLATFORM` y en producción):
  al abrir, `check()`; si hay versión, la descarga en segundo plano y avisa con `notify` «Hay una versión nueva · Reiniciar», sin
  caducar. «Reiniciar» instala y vuelve a abrir. Sin red, sin `latest.json` o con la firma mal, calla; se vuelve a mirar al abrir.
- **Versiones:** no cambia nada. release-please sube la misma versión en `package.json`, `tauri.conf.json` y `Cargo.toml`;
  `__APP_VERSION__` (lo que se ve en la barra lateral) sale de esa versión, y el plugin compara la de la app con la de `latest.json`.

## Alternativas consideradas

- **Comprobar también cada pocas horas:** Muninn se abre y cierra a diario; con mirar al abrir basta, y evita avisos a media tarea.
- **Instalar sin preguntar al cerrar:** cómodo, pero en Windows el instalador cierra la app; mejor que reiniciar sea decisión tuya.
- **Endpoint propio o repo aparte solo de binarios:** innecesario con el repo público (ver ADR-0046).
- **MSI además de NSIS:** dos instaladores para lo mismo y el MSI roto en los runners actuales.

## Consecuencias

- Las instalaciones se actualizan solas desde la primera versión publicada con la clave real. Las compiladas a mano antes de poner
  la clave no pueden verificar nada y hay que reinstalarlas una vez.
- **Perder la clave privada** impide firmar actualizaciones que las instalaciones acepten: habría que generar otra y reinstalar en
  todos los equipos. Guárdala en el gestor de contraseñas.
- Entre que release-please publica la release y `tauri-action` sube `latest.json` (unos minutos) la comprobación da 404 y calla.
- Los instaladores no llevan firma de Microsoft ni (sin los secretos `APPLE_*`) de Apple: el sistema avisa la primera vez.
- Relacionado: [gotchas/desktop](../gotchas/desktop.md), [gotchas/ci](../gotchas/ci.md), `.github/workflows/release.yml`,
  `apps/desktop/src-tauri/tauri.conf.json`, [docs/user/02-instalacion.md](../user/02-instalacion.md).
