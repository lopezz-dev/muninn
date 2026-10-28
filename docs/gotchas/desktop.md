# Gotchas · desktop (`apps/desktop`)

### `cargo build` necesita la web compilada

- **Síntoma:** error de `generate_context!` porque no encuentra `frontendDist`.
- **Causa:** la macro embebe `apps/web/dist` al compilar.
- **Solución:** primero `pnpm --filter @muninn/web build`. `tauri dev` y `tauri build` lo hacen solos
  (`beforeDevCommand` / `beforeBuildCommand`). El CI también lo hace.

### En Windows, compila Rust desde PowerShell y no desde Git Bash

- **Síntoma:** errores raros del linker al compilar desde Git Bash.
- **Causa:** Git Bash pone `C:\Program Files\Git\usr\bin\link.exe` (el `link` de coreutils) antes que el de MSVC en el PATH.
- **Solución:** compila desde PowerShell o desde la terminal de Tauri. En esta máquina hay Visual Studio Build Tools 2022.

### Iconos: salen del logo con `pnpm --filter @muninn/desktop icons`, no con `tauri icon`

- **Síntoma:** la ventana, la barra de tareas o el instalador enseñan un icono distinto del logo de la app.
- **Causa:** `src-tauri/icons/*` son ficheros generados por `scripts/icons.mjs`, que reutiliza el dibujo de la web
  (`apps/web/scripts/logo.mjs`, copia a mano de `shell/Logo.tsx`). No lee el componente.
- **Solución:**
  - Si cambia el logo, cambia la geometría en `apps/web/scripts/logo.mjs` y ejecuta `pnpm --filter @muninn/web icons` y
    `pnpm --filter @muninn/desktop icons`. Ninguno necesita dependencias: escriben PNG, ICO e ICNS con `zlib`.
  - No uses `tauri icon`: pisaría los mismos nombres desde un PNG y crearía `icons/android` e `icons/ios`, que no se usan.
  - `icon.ico` lleva BMP de 32 bits por debajo de 256 px y PNG en 256, como el de `tauri icon`: Windows y el compilador de recursos
    lo entienden en todos los tamaños. (`System.Drawing.Icon` de .NET no lee la entrada PNG; eso no indica que el fichero esté mal).
  - `icon.icns` deja un margen transparente (824 de 1024 px, la rejilla de macOS); los demás llenan el tile. No se ha probado en un Mac.
- **Ojo:** Windows guarda los iconos en caché. Si tras recompilar la barra de tareas o un acceso directo siguen con el viejo, cierra la app
  y ejecuta `ie4uinit.exe -show`, o reinicia el Explorador.

### Los enlaces externos no abren nada en escritorio

- **Síntoma:** en la app de escritorio, el título de una noticia, «Abrir», la issue de una tarea, «Ver el PR» o un enlace del Markdown no
  hacen nada al pulsarlos. En el navegador funcionan.
- **Causa:** en Tauri 2, `<a target="_blank">` y `window.open` no abren el navegador del sistema: el webview no tiene pestañas y Tauri
  no lo hace por su cuenta. Hace falta `tauri-plugin-opener` con su permiso.
- **Solución:** todo enlace externo pasa por `externalLink(url, onOpen?)` o `openExternal(url)` de `apps/web/src/lib/external-link.ts`:
  en escritorio llama a `openUrl` del plugin; en el navegador y la PWA, a `window.open(url, '_blank', 'noopener')`. Si falla, avisa con
  `notify`. El plugin va en `Cargo.toml` y `lib.rs`, y el permiso en `capabilities/default.json`
  (`opener:allow-open-url` + `opener:allow-default-urls`: solo `http(s)`, `mailto` y `tel`).
- **Ojo:** `opener:allow-open-url` a solas no basta: sin `allow-default-urls` (o un `scope` propio) el plugin rechaza toda URL con
  «Not allowed to open url». Las imágenes adjuntas al Asistente son `data:`: en la web se abren como `blob:` (`openImage`) y en
  escritorio no llevan enlace. No pongas un `<a target="_blank">` a pelo en la web: en escritorio no hará nada.

### CSP

- `tauri.conf.json` restringe `connect-src` a `self`, `*.supabase.co` y `localhost`. Si añades otro
  backend (servidor propio, Ollama en `localhost:11434`…), actualiza la CSP o las peticiones se bloquearán sin un error claro.

### Versión

- La versión de `tauri.conf.json` y `Cargo.toml` la actualiza release-please. No la cambies a mano.
  `Cargo.lock` se actualiza en el siguiente build.
- El actualizador compara esa versión con la de `latest.json`: una app compilada a mano con una versión mayor que la publicada no
  verá actualizaciones hasta que salga una versión aún mayor.

### Actualizaciones: no se prueban con `pnpm dev:desktop`

- **Síntoma:** en `tauri dev` nunca aparece «Hay una versión nueva», ni con una release más nueva publicada.
- **Causa:** `main.tsx` solo busca versiones con `TAURI_ENV_PLATFORM` y en producción ([ADR-0047](../adr/0047-actualizaciones-de-escritorio-firmadas.md)).
  En desarrollo no tendría sentido: no hay instalador que sustituir.
- **Solución:** para probarlo, instala una versión publicada anterior (Releases) y ábrela cuando ya exista una más nueva.

### `tauri build` en local no firma ni genera `latest.json`

- **Síntoma:** tu build local no trae `.sig` ni `latest.json`; o, si activas `createUpdaterArtifacts`, falla pidiendo
  `TAURI_SIGNING_PRIVATE_KEY`.
- **Causa:** `bundle.createUpdaterArtifacts` no está en `tauri.conf.json`: lo activa `release.yml` solo en CI, que es quien tiene la
  clave privada.
- **Solución:** no lo actives en el fichero. Para generar artefactos firmados en local (no hace falta para nada habitual), exporta la
  clave en la terminal (`$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $HOME\.tauri\muninn.key -Raw`) y añade
  `--config '{\"bundle\":{\"createUpdaterArtifacts\":true}}'`.
- **Ojo:** mientras `plugins.updater.pubkey` tenga el texto provisional, la app comprueba versiones pero no puede verificar ninguna
  descarga: falla en silencio y no avisa. Las apps compiladas así no se actualizan nunca; reinstálalas tras la primera versión firmada.

### Instalar Ollama y el modelo del asistente (pasos manuales, fase final)

- **Síntoma:** la pantalla Asistente dice «No encuentro Ollama en este ordenador» o «Falta el modelo».
- **Causa:** el asistente habla con Ollama en `http://localhost:11434` desde la app ([ADR-0041](../adr/0041-asistente-local-con-catalogo-unico.md)),
  y en este equipo no está instalado. Ni el repo ni la app lo instalan.
- **Solución** (en tu equipo, Windows 11; necesita el controlador de NVIDIA 551.61 o posterior):
  1. Descarga `OllamaSetup.exe` de https://ollama.com/download e instálalo (no pide administrador; queda en tu carpeta de usuario y
     arranca con Windows, con un icono en la bandeja).
  2. **Orígenes permitidos.** Ollama solo acepta peticiones del navegador desde orígenes conocidos. En PowerShell:
     ```powershell
     [Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://tauri.localhost,https://tauri.localhost,tauri://localhost', 'User')
     ```
     Sal de Ollama desde la bandeja y vuelve a abrirlo (lee las variables al arrancar). `tauri.localhost` es el origen de la app de
     escritorio en Windows; `5173`/`5174`, el de `pnpm dev`. Cuando la web esté publicada, añade su URL (y en Chrome acepta el permiso de
     «acceso a la red local» si lo pide).
  3. **Modelo:** `ollama pull qwen3:8b` (5,2 GB, en `%USERPROFILE%\.ollama\models`). Opcional, para comparar: `ollama pull qwen3:14b` (9,3 GB).
  4. **Comprobar:** `curl http://localhost:11434/api/tags` lista el modelo, y `ollama run qwen3:8b "hola"` contesta.
  5. **Banco de pruebas** (datos de ejemplo en memoria, no toca tu cuenta): `pnpm --filter @muninn/assistant bench -- --model qwen3:8b`.
     Apunta el resultado en el ROADMAP; si falla mucho, prueba `--model qwen3:14b` y cambia el modelo en Ajustes › Asistente e IA.
- **Ojo:** el contexto (16384 tokens) lo pide la app en cada llamada (`num_ctx`): no hace falta `OLLAMA_CONTEXT_LENGTH`. El modelo se queda
  10 minutos en la VRAM tras usarlo (`keep_alive`); si un juego necesita la GPU, `ollama stop qwen3:8b`. Los registros están en
  `%LOCALAPPDATA%\Ollama\server.log`.

### Instalar la voz: whisper.cpp y Piper (pasos manuales, cuando se implemente)

- **Síntoma:** no hay botón de micrófono, o Ajustes › Voz dice «No encuentro el dictado en este ordenador».
- **Causa:** la voz es local y va en dos servicios aparte que no vienen con Muninn ([ADR-0044](../adr/0044-voz-local-whisper-y-piper.md),
  **propuesto**: aún no implementado). Nada de esto está instalado.
- **Solución** (Windows 11; carpeta de trabajo `%USERPROFILE%\.muninn\voz`, fuera del repo):
  1. **Dictado (whisper.cpp).** Descarga `whisper-bin-win-cuda-12.4.0-x64.zip` de https://github.com/ggml-org/whisper.cpp/releases (v1.9.5 el
     26-10-2026) y descomprímelo en `%USERPROFILE%\.muninn\voz\whisper`. Modelo (574 MB):
     ```powershell
     Invoke-WebRequest https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin -OutFile $env:USERPROFILE\.muninn\voz\ggml-large-v3-turbo-q5_0.bin
     ```
     Arranca: `& "$env:USERPROFILE\.muninn\voz\whisper\whisper-server.exe" -m "$env:USERPROFILE\.muninn\voz\ggml-large-v3-turbo-q5_0.bin" -l es --host 127.0.0.1 --port 8178`.
     Prueba: `curl.exe -F file=@prueba.wav -F response_format=json http://127.0.0.1:8178/inference`.
  2. **Si la GPU falla** (la RTX 5070 es Blackwell y la build de CUDA 12.4 puede no traer su código): usa `whisper-bin-x64.zip` (CPU) con
     `ggml-small.bin` (488 MB, misma URL cambiando el nombre), que para frases cortas va bien en CPU.
  3. **Python** (para Piper): `winget install -e --id Python.Python.3.12` y abre una terminal nueva.
  4. **Voz (Piper):** `python -m pip install "piper-tts[http]"`, `python -m piper.download_voices es_ES-davefx-medium --data-dir "$env:USERPROFILE\.muninn\voz\piper"`
     y arranca `python -m piper.http_server -m es_ES-davefx-medium --data-dir "$env:USERPROFILE\.muninn\voz\piper" --host 127.0.0.1 --port 5002`.
     Prueba: `curl.exe -X POST -H "Content-Type: application/json" -d '{\"text\":\"Hola, soy Muninn\"}' -o hola.wav http://127.0.0.1:5002/synthesize`.
     Escucha otras voces en https://rhasspy.github.io/piper-samples antes de elegir.
  5. **Que arranquen solos:** un acceso directo a cada comando en `shell:startup` (Win + R) o una tarea programada «Al iniciar sesión».
- **Ojo:** la GPU la comparten Ollama y Whisper. Con `qwen3:8b` y large-v3-turbo-q5_0 cabe en 12 GB; con `qwen3:14b`, pasa Whisper a CPU.
  Piper va en CPU y es GPL-3.0: úsalo como programa aparte, no lo metas en el instalador sin revisar la licencia.
