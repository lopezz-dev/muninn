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
