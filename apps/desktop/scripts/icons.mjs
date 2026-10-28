// Genera los iconos de la app de escritorio (`src-tauri/icons`) a partir del logo, sin dependencias: reutiliza el dibujo
// de la web (`apps/web/scripts/logo.mjs`) y escribe PNG, ICO e ICNS. Uso: pnpm --filter @muninn/desktop icons
// Sustituye a `tauri icon`: mismos nombres, sin crear `icons/android` ni `icons/ios`.
import fs from 'node:fs'
import path from 'node:path'
import { ico, png, render } from '../../web/scripts/logo.mjs'

const out = path.resolve(import.meta.dirname, '../src-tauri/icons')

/** Tile redondeado con esquinas transparentes, como el favicon. */
const tile = (size) => render(size, { rounded: true })
// En macOS el icono ocupa 824 de 1024 px y deja aire alrededor (rejilla de Apple desde Big Sur).
const mac = (size) => render(size, { rounded: true, inset: 100 / 1024 })

/** BMP de icono (DIB de 32 bits de abajo arriba + máscara AND vacía): lo que espera Windows por debajo de 256 px. */
function bmp(size, rgba) {
  const maskRow = Math.ceil(size / 32) * 4
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8) // alto doble: imagen + máscara
  header.writeUInt16LE(1, 12) // planos
  header.writeUInt16LE(32, 14) // bits por píxel
  header.writeUInt32LE(size * size * 4 + maskRow * size, 20)
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = ((size - 1 - y) * size + x) * 4
      pixels[dst] = rgba[src + 2]
      pixels[dst + 1] = rgba[src + 1]
      pixels[dst + 2] = rgba[src]
      pixels[dst + 3] = rgba[src + 3]
    }
  }
  return Buffer.concat([header, pixels, Buffer.alloc(maskRow * size)])
}

/** ICNS con PNG dentro (tipos de macOS 10.7 en adelante). */
function icns(entries) {
  const blocks = entries.map(([type, size]) => {
    const data = png(size, mac(size))
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(data.length + 8, 4)
    return Buffer.concat([head, data])
  })
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(8 + blocks.reduce((n, b) => n + b.length, 0), 4)
  return Buffer.concat([head, ...blocks])
}

const write = (name, data) => {
  fs.writeFileSync(path.join(out, name), data)
  console.log(`  ${name} (${(data.length / 1000).toFixed(1)} kB)`)
}

for (const size of [32, 64, 128]) write(`${size}x${size}.png`, png(size, tile(size)))
write('128x128@2x.png', png(256, tile(256)))
write('icon.png', png(512, tile(512)))
write(
  'icon.ico',
  ico(
    [16, 24, 32, 48, 64, 256].map((size) => ({
      size,
      data: size < 256 ? bmp(size, tile(size)) : png(size, tile(size)),
    })),
  ),
)
write(
  'icon.icns',
  icns([
    ['icp4', 16],
    ['icp5', 32],
    ['ic11', 32],
    ['ic12', 64],
    ['ic07', 128],
    ['ic13', 256],
    ['ic08', 256],
    ['ic14', 512],
    ['ic09', 512],
    ['ic10', 1024],
  ]),
)
// Tiles de la tienda de Windows (MSIX/APPX).
for (const size of [30, 44, 71, 89, 107, 142, 150, 284, 310])
  write(`Square${size}x${size}Logo.png`, png(size, tile(size)))
write('StoreLogo.png', png(50, tile(50)))
