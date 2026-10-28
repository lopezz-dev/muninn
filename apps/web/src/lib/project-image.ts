import type { ProjectImageKind } from '@muninn/core'

/**
 * Logo y portada de proyecto (ADR-0055, ADR-0056): se reducen en el navegador antes de subirlos, como las imágenes del
 * asistente (ADR-0051). Una foto del móvil (4–8 MB) se queda en unos cientos de KB.
 */

/** Lado mayor tras reducir. El logo se ve como mucho a 64 px (128 en retina, con margen); la portada, a lo ancho. */
const MAX_SIDE: Record<ProjectImageKind, number> = { logo: 512, cover: 1200 }

export interface ReducedImage {
  blob: Blob
  /** Color dominante (`#rrggbb`) para ofrecerlo como color del proyecto; solo del logo, y `null` si no tiene uno claro. */
  color: string | null
}

/**
 * Archivo de imagen → imagen reducida. El logo va en PNG (conserva la transparencia: queda sobre el color del
 * proyecto); la portada, en JPEG. Lanza si no es una imagen que el navegador sepa leer.
 */
export async function reduceProjectImage(
  file: File,
  kind: ProjectImageKind,
): Promise<ReducedImage> {
  if (!file.type.startsWith('image/')) throw new Error(`«${file.name}» no es una imagen`)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`No puedo abrir «${file.name}»`)
  }
  const color = kind === 'logo' ? sampleColor(bitmap) : null
  const scale = Math.min(1, MAX_SIDE[kind] / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no deja procesar imágenes')
  if (kind === 'cover') {
    // JPEG no tiene transparencia: lo transparente queda del fondo de las tarjetas, no en negro.
    ctx.fillStyle = '#15181C'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    kind === 'cover'
      ? canvas.toBlob(resolve, 'image/jpeg', 0.85)
      : canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('No se pudo preparar la imagen')
  return { blob, color }
}

/** Color dominante de una imagen, mirando una miniatura de 32 × 32. */
function sampleColor(bitmap: ImageBitmap): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, 32, 32)
  return dominantColor(ctx.getImageData(0, 0, 32, 32).data)
}

type Hsl = [h: number, s: number, l: number]

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === R
      ? ((G - B) / d + (G < B ? 6 : 0)) / 6
      : max === G
        ? ((B - R) / d + 2) / 6
        : ((R - G) / d + 4) / 6
  return [h * 360, s, l]
}

function hslToHex([h, s, l]: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return `#${[f(0), f(8), f(4)]
    .map((x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase()
}

/**
 * Color dominante de unos píxeles RGBA (`ImageData.data`): el tono que más pesa entre los píxeles con color (sin
 * transparentes, grises, casi negros ni casi blancos), llevado a la claridad de los colores de proyecto para que se lea
 * sobre el fondo oscuro. `null` si la imagen no tiene un color claro (un logo en blanco y negro).
 */
export function dominantColor(data: Uint8ClampedArray): string | null {
  // 24 cubos de 15° de tono, cada uno con el peso y la suma de sus colores.
  const buckets = Array.from({ length: 24 }, () => ({ w: 0, h: 0, s: 0 }))
  let colored = 0
  let opaque = 0
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 128) continue
    opaque++
    const [h, s, l] = rgbToHsl(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0)
    if (s < 0.25 || l < 0.12 || l > 0.92) continue
    colored++
    // Pesan más los píxeles saturados y de claridad media: son los que «se ven» como el color del logo.
    const w = s * (1 - Math.abs(l - 0.5))
    const b = buckets[Math.floor(h / 15) % 24] as { w: number; h: number; s: number }
    b.w += w
    b.h += h * w
    b.s += s * w
  }
  // Menos de un 5 % de píxeles con color: no hay un color que represente al logo.
  if (!opaque || colored / opaque < 0.05) return null
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a))
  if (!best.w) return null
  return hslToHex([best.h / best.w, Math.max(0.45, Math.min(0.85, best.s / best.w)), 0.6])
}
