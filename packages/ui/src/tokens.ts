/**
 * Tokens de diseño de Muninn: fuente única de verdad.
 * `pnpm --filter @muninn/ui tokens` genera `tokens.css` (variables `--mn-*`) a partir de este fichero.
 * Valores sacados del lienzo de diseño (página Fundamentos).
 */

export const colors = {
  bg: '#0C0D10',
  sidebar: '#101215',
  surface: '#15181C',
  'surface-raised': '#1D2026',
  'surface-hover': '#181B20',
  'surface-sunken': '#111316',
  border: '#23272E',
  'border-strong': '#2C3139',
  'border-subtle': '#1F2329',
  fg: '#ECEDEF',
  'fg-muted': '#A3A9B2',
  'fg-subtle': '#8A9099',
  'fg-faint': '#818892',
  accent: '#F2A93B',
  'accent-hover': '#F5B856',
  'accent-fg': '#1A1206',
  'accent-soft': 'rgba(242, 169, 59, 0.12)',
  success: '#5CC08A',
  'success-soft': 'rgba(92, 192, 138, 0.12)',
  danger: '#F0705F',
  'danger-soft': 'rgba(240, 112, 95, 0.12)',
  overlay: 'rgba(8, 9, 11, 0.55)',
} as const

/** Colores de proyecto y categoría. Las claves coinciden con `projects.color` en la base de datos. */
export const palette = {
  blue: '#5B8DEF',
  violet: '#9C7CF4',
  teal: '#35B8A6',
  pink: '#E5739F',
  green: '#62BF7E',
  amber: '#F2A93B',
  gray: '#6B7280',
} as const

/** Color de cada tipo de columna del Kanban (`column_kind`). */
export const columnKinds = {
  backlog: '#3A3F48',
  todo: '#6B7280',
  in_progress: '#F2A93B',
  review: '#9C7CF4',
  done: '#5CC08A',
} as const

/**
 * Series de los gráficos de Finanzas (ingresos frente a gastos). Validados con la skill `dataviz` sobre `surface` en
 * oscuro: banda de luminosidad, croma y separación para daltonismo (ΔE 26,8). No los cambies sin volver a validarlos.
 */
export const chart = {
  income: '#5B8DEF',
  expense: '#CF7A2E',
} as const

/**
 * Modo cristal (`<html data-glass="on">`): superficies translúcidas + desenfoque.
 * Sobrescribe solo lo necesario; con el cristal apagado la app es sólida.
 */
export const glass = {
  colors: {
    sidebar: 'rgba(16, 18, 21, 0.62)',
    surface: 'rgba(21, 24, 28, 0.66)',
    'surface-raised': 'rgba(29, 32, 38, 0.74)',
    'surface-hover': 'rgba(255, 255, 255, 0.04)',
    'surface-sunken': 'rgba(17, 19, 22, 0.5)',
    border: 'rgba(255, 255, 255, 0.07)',
    'border-subtle': 'rgba(255, 255, 255, 0.05)',
  },
  backdrop: 'blur(18px) saturate(140%)',
  /** Algo que desenfocar: sin fondo con matices, el blur no se nota. */
  wallpaper:
    'radial-gradient(1200px 640px at 12% -12%, rgba(242, 169, 59, 0.10), transparent 60%), radial-gradient(900px 640px at 100% 110%, rgba(91, 141, 239, 0.09), transparent 60%)',
} as const

export const radius = {
  xs: '2px',
  sm: '4px',
  md: '5px',
  lg: '6px',
  xl: '8px',
  dock: '12px',
} as const

export const fonts = {
  sans: "'Geist Variable', 'Geist', ui-sans-serif, system-ui, sans-serif",
  mono: "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace",
} as const

export const fontSize = {
  '2xs': '11px',
  xs: '12px',
  sm: '13px',
  base: '14px',
  md: '15px',
  lg: '17px',
  xl: '22px',
  '2xl': '28px',
  '3xl': '34px',
} as const

export const shadow = {
  popover: '0 16px 48px rgba(0, 0, 0, 0.5)',
  drag: '0 18px 40px rgba(0, 0, 0, 0.55)',
  panel: '-24px 0 60px rgba(0, 0, 0, 0.45)',
} as const

export const motion = {
  'ease-out': 'cubic-bezier(0.3, 0.7, 0.2, 1)',
  /** Salida enérgica para micro-interacciones (iconos, pulsaciones). */
  'ease-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
  /** Movimiento en pantalla (ida y vuelta). */
  'ease-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
  fast: '120ms',
  base: '200ms',
  slow: '450ms',
} as const

export const layout = {
  sidebar: '240px',
  'gutter-desktop': '32px',
  'gutter-mobile': '20px',
  touch: '44px',
} as const

export type ColorToken = keyof typeof colors
export type PaletteColor = keyof typeof palette
export type ColumnKindColor = keyof typeof columnKinds

/** Color de un proyecto a partir del valor guardado (`'blue'`, `'violet'`…); desconocido → gris. */
export const projectColor = (name: string): string => palette[name as PaletteColor] ?? palette.gray

// ─── Generación de CSS ───────────────────────────────────────────────────────

const decl = (prefix: string, obj: Record<string, string>) =>
  Object.entries(obj).map(([k, v]) => `  --mn-${prefix}${k}: ${v};`)

export function tokensToCss(): string {
  const root = [
    '  color-scheme: dark;',
    ...decl('color-', colors),
    ...decl('project-', palette),
    ...decl('kind-', columnKinds),
    ...decl('chart-', chart),
    ...decl('radius-', radius),
    ...decl('font-', fonts),
    ...decl('text-', fontSize),
    ...decl('shadow-', shadow),
    ...decl('motion-', motion),
    ...decl('layout-', layout),
    '  --mn-backdrop: none;',
    '  --mn-wallpaper: none;',
  ]
  const glassOn = [
    ...decl('color-', glass.colors),
    `  --mn-backdrop: ${glass.backdrop};`,
    `  --mn-wallpaper: ${glass.wallpaper};`,
  ]
  return [
    '/* Generado por packages/ui/scripts/build-tokens.ts a partir de src/tokens.ts. No editar a mano. */',
    '',
    ':root {',
    ...root,
    '}',
    '',
    ':root[data-glass="on"] {',
    ...glassOn,
    '}',
    '',
  ].join('\n')
}
