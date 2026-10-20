import { defineConfig } from 'tsup'

// El core es TS fuente con imports sin extensión, que Deno no resuelve: para la Edge Function se empaqueta.
export default defineConfig({
  entry: { muninn: 'src/edge.ts' },
  outDir: '../../supabase/functions/github/_core',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  clean: true,
  noExternal: [/.*/],
  dts: false,
})
