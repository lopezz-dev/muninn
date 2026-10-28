// Genera el favicon y los iconos de la PWA a partir del logo (dibujado en `scripts/logo.mjs`), sin dependencias.
// Uso: pnpm --filter @muninn/web icons. Los de escritorio: pnpm --filter @muninn/desktop icons.
// La imagen social (`og-image.png`) no sale de aquí: necesita texto (ver `scripts/og-image.html`).
import fs from 'node:fs'
import path from 'node:path'
import { ico, png, render, svg } from './logo.mjs'

const out = path.resolve(import.meta.dirname, '../public')

const write = (name, data) => {
  fs.writeFileSync(path.join(out, name), data)
  console.log(`  ${name} (${(data.length / 1000).toFixed(1)} kB)`)
}

write('favicon.svg', svg)
write(
  'favicon.ico',
  ico([16, 32, 48].map((size) => ({ size, data: png(size, render(size, { rounded: true })) }))),
)
write('apple-touch-icon.png', png(180, render(180, { rounded: false })))
for (const size of [192, 512]) {
  write(`icon-${size}.png`, png(size, render(size, { rounded: true })))
  write(`icon-maskable-${size}.png`, png(size, render(size, { rounded: false })))
}
