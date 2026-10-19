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
