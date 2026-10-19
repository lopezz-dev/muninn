import { colors, palette } from './tokens'

/** Acentos elegibles en Ajustes › Apariencia. */
export const ACCENTS = {
  amber: palette.amber,
  blue: palette.blue,
  violet: palette.violet,
  teal: palette.teal,
  pink: palette.pink,
} as const

export type AccentName = keyof typeof ACCENTS

export interface Appearance {
  /** Cristal: superficies translúcidas con desenfoque en toda la app. */
  glass: boolean
  accent: AccentName
}

export const DEFAULT_APPEARANCE: Appearance = { glass: true, accent: 'amber' }

/** Lo mínimo que necesitamos del elemento raíz (permite testear sin DOM). */
export interface AppearanceRoot {
  dataset: Record<string, string | undefined>
  style: { setProperty(name: string, value: string): void }
}

const hexToRgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

/** Mezcla el color con blanco (`amount` 0–1) para el estado hover. */
export function lighten(hex: string, amount: number): string {
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `#${hexToRgb(hex)
    .map((c) => mix(c).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Aplica la apariencia al documento: `data-glass` y las variables del acento.
 * El ámbar por defecto reutiliza exactamente los tokens del diseño.
 */
export function applyAppearance(appearance: Appearance, root?: AppearanceRoot): void {
  const el = root ?? (document.documentElement as unknown as AppearanceRoot)
  el.dataset.glass = appearance.glass ? 'on' : 'off'
  const base = ACCENTS[appearance.accent] ?? ACCENTS.amber
  const isDefault = appearance.accent === 'amber'
  el.style.setProperty('--mn-color-accent', base)
  el.style.setProperty(
    '--mn-color-accent-hover',
    isDefault ? colors['accent-hover'] : lighten(base, 0.12),
  )
  el.style.setProperty(
    '--mn-color-accent-soft',
    isDefault ? colors['accent-soft'] : withAlpha(base, 0.12),
  )
}

/** El sistema pide menos transparencias (macOS/iOS «Reducir transparencia»). */
export function prefersReducedTransparency(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-transparency: reduce)').matches
  )
}
