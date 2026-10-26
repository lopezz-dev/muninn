import { defineConfig } from 'tsup'

// @muninn/core y @muninn/assistant se distribuyen como TS fuente: los empaquetamos dentro del binario del MCP.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  clean: true,
  noExternal: ['@muninn/core', '@muninn/assistant'],
})
