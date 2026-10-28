import { describe, expect, it } from 'vitest'
import { dominantColor } from '../src/lib/project-image'

/** Píxeles RGBA a partir de una lista de [color, cuántos]. */
const pixels = (...parts: [rgba: [number, number, number, number], n: number][]) =>
  new Uint8ClampedArray(parts.flatMap(([rgba, n]) => Array.from({ length: n }, () => rgba).flat()))

const hue = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

describe('color dominante del logo', () => {
  it('elige el tono que más pesa e ignora el fondo oscuro y lo transparente', () => {
    const c = dominantColor(
      pixels([[242, 169, 59, 255], 300], [[12, 13, 16, 255], 600], [[91, 141, 239, 0], 500]),
    )
    expect(c).toMatch(/^#[0-9A-F]{6}$/)
    expect(hue(c as string)).toBeGreaterThan(25)
    expect(hue(c as string)).toBeLessThan(45)
  })

  it('gana el color más abundante entre dos', () => {
    const c = dominantColor(pixels([[91, 141, 239, 255], 400], [[229, 115, 159, 255], 100]))
    expect(hue(c as string)).toBeGreaterThan(205)
    expect(hue(c as string)).toBeLessThan(230)
  })

  it('un logo en blanco y negro no tiene color', () => {
    expect(dominantColor(pixels([[255, 255, 255, 255], 200], [[0, 0, 0, 255], 200]))).toBeNull()
    expect(dominantColor(pixels([[0, 0, 0, 0], 100]))).toBeNull()
  })
})
