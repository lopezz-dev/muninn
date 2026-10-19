/**
 * Geometría del dock con menisco (lienzo de diseño, Dock.dc.html). Una barra redondeada cuyo borde
 * superior se hunde en curva bajo la burbuja de la pestaña activa.
 *
 *   0 ─ burbuja (48 px, top 3) ─────────────
 *  38 ─ borde superior de la barra ─╮  ╭────
 *  56                               ╰──╯  ← menisco (profundidad 18, semiancho 34)
 * 100 ─ borde inferior ─────────────────────
 */
export const DOCK_GEOMETRY = {
  height: 100,
  /** y del borde superior de la barra. */
  top: 38,
  /** Alto de la barra. */
  bar: 62,
  radius: 12,
  /** Semiancho del menisco. */
  scoop: 34,
  /** Profundidad del menisco. */
  depth: 18,
  /** Margen lateral dentro de la barra antes de la primera pestaña. */
  pad: 16,
  bead: 48,
  beadTop: 3,
} as const

/** Ancho de cada pestaña. */
export const slotWidth = (width: number, count = 5) => (width - DOCK_GEOMETRY.pad * 2) / count

/** Centro horizontal de la pestaña `index`. */
export const slotCenter = (width: number, index: number, count = 5) =>
  DOCK_GEOMETRY.pad + slotWidth(width, count) * (index + 0.5)

const r1 = (n: number) => Math.round(n * 10) / 10

/** Trazado SVG de la barra con el menisco centrado en `cx`. Mismo trazado que el diseño. */
export function dockPath(width: number, cx: number): string {
  const { top: T, bar: H, radius: rc, scoop: s, depth: d } = DOCK_GEOMETRY
  const W = width
  const a = cx - s
  const b = cx + s
  return (
    `M${rc} ${T} L${r1(a)} ${T}` +
    ` C${r1(a + s * 0.5)} ${T} ${r1(cx - s * 0.55)} ${T + d} ${r1(cx)} ${T + d}` +
    ` C${r1(cx + s * 0.55)} ${T + d} ${r1(b - s * 0.5)} ${T} ${r1(b)} ${T}` +
    ` L${r1(W - rc)} ${T} Q${r1(W)} ${T} ${r1(W)} ${T + rc}` +
    ` L${r1(W)} ${T + H - rc} Q${r1(W)} ${T + H} ${r1(W - rc)} ${T + H}` +
    ` L${rc} ${T + H} Q0 ${T + H} 0 ${T + H - rc}` +
    ` L0 ${T + rc} Q0 ${T} ${rc} ${T} Z`
  )
}

/**
 * `cubic-bezier(x1, y1, x2, y2)` como función de JS. El dock anima en JS (no con CSS `d: path()`)
 * porque Safari/WebKit no transiciona `d`, y el móvil objetivo es un iPhone.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const x = (t: number) => ((ax * t + bx) * t + cx) * t
  const y = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (p: number) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    // Newton-Raphson y, si no converge, bisección.
    let t = p
    for (let i = 0; i < 8; i++) {
      const err = x(t) - p
      if (Math.abs(err) < 1e-6) return y(t)
      const slope = dx(t)
      if (Math.abs(slope) < 1e-6) break
      t -= err / slope
    }
    let lo = 0
    let hi = 1
    t = p
    while (hi - lo > 1e-6) {
      if (x(t) < p) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return y(t)
  }
}

/** Curva y duración del diseño (`--mn-motion-ease-out`, `--mn-motion-slow`). */
export const DOCK_EASE = cubicBezier(0.3, 0.7, 0.2, 1)
export const DOCK_DURATION = 450
