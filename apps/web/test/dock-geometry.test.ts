import { describe, expect, it } from 'vitest'
import {
  cubicBezier,
  DOCK_EASE,
  DOCK_GEOMETRY,
  dockPath,
  slotCenter,
  slotWidth,
} from '../src/shell/dock-geometry'

// Generados con la fórmula de Dock.dc.html (lienzo de diseño) para 350 px (iPhone de 390 − 2 × 20).
const DESIGN_350 = [
  'M12 38 L13.8 38 C30.8 38 29.1 56 47.8 56 C66.5 56 64.8 38 81.8 38 L338 38 Q350 38 350 50 L350 88 Q350 100 338 100 L12 100 Q0 100 0 88 L0 50 Q0 38 12 38 Z',
  'M12 38 L141 38 C158 38 156.3 56 175 56 C193.7 56 192 38 209 38 L338 38 Q350 38 350 50 L350 88 Q350 100 338 100 L12 100 Q0 100 0 88 L0 50 Q0 38 12 38 Z',
  'M12 38 L268.2 38 C285.2 38 283.5 56 302.2 56 C320.9 56 319.2 38 336.2 38 L338 38 Q350 38 350 50 L350 88 Q350 100 338 100 L12 100 Q0 100 0 88 L0 50 Q0 38 12 38 Z',
]

describe('geometría del dock', () => {
  it('reproduce exactamente el trazado del diseño', () => {
    expect(dockPath(350, slotCenter(350, 0))).toBe(DESIGN_350[0])
    expect(dockPath(350, slotCenter(350, 2))).toBe(DESIGN_350[1])
    expect(dockPath(350, slotCenter(350, 4))).toBe(DESIGN_350[2])
  })

  it('las pestañas superan la zona táctil mínima de 44 px', () => {
    // El iPhone más estrecho en uso (320 px) deja 280 px de dock.
    expect(slotWidth(280)).toBeGreaterThanOrEqual(44)
    expect(DOCK_GEOMETRY.bar).toBeGreaterThanOrEqual(44)
  })

  it('el menisco queda centrado bajo la burbuja', () => {
    expect(slotCenter(350, 2)).toBe(175)
    expect(dockPath(400, 200)).toContain(`200 ${DOCK_GEOMETRY.top + DOCK_GEOMETRY.depth}`)
  })
})

describe('cubicBezier', () => {
  it('empieza en 0, acaba en 1 y es monótona', () => {
    expect(DOCK_EASE(0)).toBe(0)
    expect(DOCK_EASE(1)).toBe(1)
    let prev = 0
    for (let p = 0.05; p < 1; p += 0.05) {
      const v = DOCK_EASE(p)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('la lineal devuelve lo mismo que recibe', () => {
    const linear = cubicBezier(0.25, 0.25, 0.75, 0.75)
    expect(linear(0.3)).toBeCloseTo(0.3, 4)
  })

  it('ease-out avanza deprisa al principio', () => {
    expect(DOCK_EASE(0.25)).toBeGreaterThan(0.5)
  })
})
