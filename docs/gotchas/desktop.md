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

### Iconos

- Se generan con `pnpm --filter @muninn/desktop tauri icon <png de 1024×1024>`. El comando también
  crea `icons/android` e `icons/ios`, que borramos porque no se usan. Los iconos actuales son
  provisionales hasta tener el sistema de diseño.
- La PWA usa `apps/web/public/icon-192.png` e `icon-512.png`: regéneralos a la vez.

### CSP

- `tauri.conf.json` restringe `connect-src` a `self`, `*.supabase.co` y `localhost`. Si añades otro
  backend (servidor propio, Ollama en `localhost:11434`…), actualiza la CSP o las peticiones se bloquearán sin un error claro.

### Versión

- La versión de `tauri.conf.json` y `Cargo.toml` la actualiza release-please. No la cambies a mano.
  `Cargo.lock` se actualiza en el siguiente build.

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
