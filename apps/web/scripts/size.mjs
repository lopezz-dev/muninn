// Mide el JS que descarga la app al arrancar: los .js que referencia dist/index.html
// (entrada y modulepreload). Uso: pnpm --filter @muninn/web size
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const dist = path.resolve(import.meta.dirname, '../dist')
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1])

// kB de 1000 bytes, como los informa Vite.
const kb = (n) => `${(n / 1000).toFixed(1)} kB`
let raw = 0
let gz = 0
for (const file of initial) {
  const buf = fs.readFileSync(path.join(dist, file))
  raw += buf.length
  gz += zlib.gzipSync(buf).length
  console.log(`  ${kb(buf.length).padStart(9)}  ${path.basename(file)}`)
}
console.log(`JS inicial: ${kb(raw)} (${kb(gz)} gzip)`)
