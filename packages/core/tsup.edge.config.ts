import { defineConfig } from 'tsup'

// El core es TS fuente con imports sin extensión, que Deno no resuelve: para las Edge Functions se empaqueta.
// La misma copia va a `github` y a `news` (cada función se despliega con su carpeta).
const edge = (fn: string) => ({
  entry: { muninn: 'src/edge.ts' },
  outDir: `../../supabase/functions/${fn}/_core`,
  format: ['esm' as const],
  platform: 'neutral' as const,
  target: 'es2022',
  clean: true,
  noExternal: [/.*/],
  dts: false,
})

export default defineConfig([edge('github'), edge('news')])
