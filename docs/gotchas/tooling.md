# Gotchas · tooling (monorepo, TypeScript, lint, entorno)

### `biome migrate` puede dejar el linter sin reglas

- **Síntoma:** `pnpm lint` pasa sin avisos, sospechosamente limpio.
- **Causa:** al migrar de `"recommended": true` a la sintaxis nueva, `biome migrate` escribió `"preset": "none"`.
- **Solución:** comprueba que `biome.json` tiene `"rules": { "preset": "recommended" }` tras cada migración.

### pnpm 10 bloquea los scripts de instalación

- **Síntoma:** aviso `Ignored build scripts: …` y un binario nativo que no funciona.
- **Solución:** añade el paquete a `onlyBuiltDependencies` en `pnpm-workspace.yaml`. Ahora mismo solo `esbuild`.

### TypeScript 7

- El proyecto usa TypeScript 7 (compilador nativo). Ya no existen opciones antiguas (`moduleResolution: node10`,
  `target: es5`…). Usa `module: preserve` + `moduleResolution: bundler` (ya en `tsconfig.base.json`).

### tsup: las opciones de bundling van en `tsup.config.ts`

- `--no-external` no existe como opción del CLI. Usa `noExternal` en `packages/mcp/tsup.config.ts`.

### Entorno de desarrollo (Windows)

- No hay Python instalado: los scripts auxiliares se escriben en Node o PowerShell.
- No hay Docker ni Ollama todavía: `supabase start` (stack local) y Jarvis necesitan instalarlos.
- `ffmpeg` está disponible (scoop) para generar o convertir imágenes y vídeo.
- Cuenta de GitHub: **`lopezz-dev`**. `gh auth status` aún puede mostrar el nombre antiguo (`Alexfp28`) por la
  caché del keyring; `gh api user` devuelve el real.
- Compilar Rust: ver [gotchas/desktop](desktop.md).

### Playwright MCP en Windows: regístralo desde PowerShell

- **Síntoma:** `claude mcp list` dice que `playwright` no conecta (*Failed to connect*), o el navegador no abre: *Browser
  "chrome-for-testing" is not installed*.
- **Causa:** en Windows `npx` es un `.cmd` y hay que lanzarlo con `cmd /c`. Desde **Git Bash**, la conversión de rutas de MSYS
  cambia `/c` por `C:/` y el servidor nunca arranca. Además, `@playwright/mcp` no trae el navegador: lo descarga aparte.
- **Solución:** desde **PowerShell** (no Git Bash), en la raíz del repo y con ámbito local (no entra en `.mcp.json`):
  ```powershell
  claude mcp add playwright --scope local -- cmd /c npx -y @playwright/mcp@0.0.83 --browser chromium --user-data-dir C:\Users\<tú>\.muninn\playwright-profile
  npx -y @playwright/mcp@0.0.83 install-browser chrome-for-testing
  ```
  El perfil persistente (fuera del repo) guarda la sesión de Muninn: solo hay que entrar con el código del correo la primera vez.
- **Ojo:** las capturas, instantáneas y registros de la consola van a `.playwright-mcp/` en la raíz del repo; está en `.gitignore`.
  `pnpm dev` debe estar corriendo (http://localhost:5173) y necesita `apps/web/.env.local` (ver [gotchas/web](web.md)).

### Vite no ve un cambio hecho con `sed -i` (Windows)

- **Síntoma:** la app falla con un error que el código ya no tiene (`dueLabel is not defined` con el `import` puesto), y `pnpm typecheck` pasa.
- **Causa:** `sed -i` reemplaza el fichero renombrando uno temporal; en Windows el vigilante de Vite a veces no recibe el cambio y sigue
  sirviendo la transformación anterior, aunque recargues.
- **Solución:** `curl -s http://localhost:<puerto>/src/<ruta>.ts | grep …` para ver lo que sirve; `touch <fichero>` lo fuerza a releerlo. Mejor
  editar con el editor o con un script de Node (`fs.writeFileSync`), que escribe en el mismo fichero.

### `pnpm lint` falla con «Found a nested root configuration» (worktrees de Claude Code)

- **Síntoma:** `pnpm lint` (`biome check .`) falla una vez por cada `.claude/worktrees/<id>/biome.json`, `pnpm format` no formatea
  y `git status` lista `.claude/worktrees/` como sin seguimiento.
- **Causa:** Claude Code crea copias completas del repo en `.claude/worktrees/<id>/`. Cada una trae su `biome.json` raíz, y Biome
  rechaza raíces anidadas. Ignorarlo solo en `.gitignore` no basta: Biome sigue descubriendo esas configuraciones.
- **Solución:** `.claude/worktrees/` en `.gitignore` y `"!!.claude/worktrees"` en `files.includes` de `biome.json`. El doble `!!`
  (Biome 2.2+) excluye la carpeta entera, sin entrar en ella; un `!` simple la sigue recorriendo.
