import { defineConfig } from 'tsup'

// Para la Edge Function `mcp` (Deno): un solo fichero, sin imports sin extensión ni dependencias de npm sueltas.
export default defineConfig({
  entry: { mcp: 'src/edge.ts' },
  outDir: '../../supabase/functions/mcp/_mcp',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  clean: true,
  noExternal: [/.*/],
  external: ['@supabase/supabase-js'],
  dts: false,
})
