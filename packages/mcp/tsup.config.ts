import { defineConfig } from 'tsup'

// @muninn/core se distribuye como TS fuente: lo empaquetamos dentro del binario del MCP.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  clean: true,
  noExternal: ['@muninn/core'],
})
