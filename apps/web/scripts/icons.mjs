// Genera el favicon y los iconos de la PWA a partir del logo (`src/shell/Logo.tsx`), sin dependencias:
// dibuja la geometría con supermuestreo y codifica PNG e ICO con `zlib`. Uso: pnpm --filter @muninn/web icons
// La imagen social (`og-image.png`) no sale de aquí: necesita texto (ver `scripts/og-image.html`).
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const out = path.resolve(import.meta.dirname, '../public')

// Misma geometría que `Logo.tsx` (viewBox 26×26). Si cambia el logo, cambia esto y vuelve a generar.
const VIEW = 26
const RADIUS = 5
const BIRD = [
  [6, 17.5],
  [11.5, 8.5],
  [19.5, 10.1],
  [15.9, 12.7],
  [19.5, 17.5],
]
const EYE = { cx: 13.6, cy: 11.4, r: 1.3 }
// Colores por defecto del tema (`accent` y `accent-fg` en @muninn/ui); en la app siguen al acento elegido.
const ACCENT = [0xf2, 0xa9, 0x3b]
const INK = [0x1a, 0x12, 0x06]
const hex = (c) =>
  `#${c
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`

function insideRoundRect(x, y, r) {
  if (x < 0 || y < 0 || x > VIEW || y > VIEW) return false
  if (r === 0) return true
  const cx = Math.min(Math.max(x, r), VIEW - r)
  const cy = Math.min(Math.max(y, r), VIEW - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function insidePolygon(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Color del logo en un punto (coordenadas del viewBox) o `null` si es transparente. */
function sample(x, y, radius) {
  if (!insideRoundRect(x, y, radius)) return null
  if ((x - EYE.cx) ** 2 + (y - EYE.cy) ** 2 <= EYE.r ** 2) return ACCENT
  return insidePolygon(x, y, BIRD) ? INK : ACCENT
}

/**
 * RGBA de `size`×`size`. `rounded: false` llena el cuadrado entero: sin transparencia (iOS) y con el pájaro
 * dentro de la zona segura de los iconos `maskable` (círculo de radio 40 % del lado; el pájaro llega al 32 %).
 */
function render(size, { rounded }) {
  const radius = rounded ? RADIUS : 0
  const ss = 8
  const px = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((pxl + (sx + 0.5) / ss) / size) * VIEW
          const y = ((py + (sy + 0.5) / ss) / size) * VIEW
          const c = sample(x, y, radius)
          if (!c) continue
          r += c[0]
          g += c[1]
          b += c[2]
          a++
        }
      }
      const i = (py * size + pxl) * 4
      if (a > 0) {
        px[i] = Math.round(r / a)
        px[i + 1] = Math.round(g / a)
        px[i + 2] = Math.round(b / a)
      }
      px[i + 3] = Math.round((a / (ss * ss)) * 255)
    }
  }
  return px
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++)
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** ICO con PNG dentro (lo entienden todos los navegadores actuales). */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e[0] = size % 256
    e[1] = size % 256
    e.writeUInt16LE(1, 4) // planos
    e.writeUInt16LE(32, 6) // bits por píxel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}">
  <title>Muninn</title>
  <rect width="${VIEW}" height="${VIEW}" rx="${RADIUS}" fill="${hex(ACCENT)}"/>
  <path d="M${BIRD.map((p) => p.join(' ')).join('L')}z" fill="${hex(INK)}"/>
  <circle cx="${EYE.cx}" cy="${EYE.cy}" r="${EYE.r}" fill="${hex(ACCENT)}"/>
</svg>
`

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
