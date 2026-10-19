import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyAppearance, lighten, withAlpha } from '../src/appearance'
import { colors, columnKinds, projectColor, tokensToCss } from '../src/tokens'

/** Contraste WCAG 2.x entre dos colores hex opacos. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16)
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (bl as number)
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('tokens', () => {
  it('tokens.css está sincronizado con tokens.ts', () => {
    const file = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8')
    expect(file.replace(/\r\n/g, '\n')).toBe(tokensToCss())
  })

  it('todos los textos cumplen 4.5:1 sobre fondo, superficie y superficie elevada', () => {
    const texts = ['fg', 'fg-muted', 'fg-subtle', 'fg-faint'] as const
    const grounds = ['bg', 'surface', 'surface-raised'] as const
    for (const t of texts) {
      for (const g of grounds) {
        expect(contrast(colors[t], colors[g]), `${t} sobre ${g}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('el texto sobre el acento es legible', () => {
    expect(contrast(colors['accent-fg'], colors.accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('los tipos de columna "en curso" y "hecho" se distinguen también por luminosidad', () => {
    expect(contrast(columnKinds.backlog, columnKinds.done)).toBeGreaterThan(1.5)
  })

  it('projectColor cae en gris si el color no existe', () => {
    expect(projectColor('blue')).toBe('#5B8DEF')
    expect(projectColor('inventado')).toBe('#6B7280')
  })
})

describe('apariencia', () => {
  const fakeRoot = () => {
    const props = new Map<string, string>()
    return {
      dataset: {} as Record<string, string | undefined>,
      style: { setProperty: (k: string, v: string) => props.set(k, v) },
      props,
    }
  }

  it('activa y desactiva el cristal', () => {
    const root = fakeRoot()
    applyAppearance({ glass: true, accent: 'amber' }, root)
    expect(root.dataset.glass).toBe('on')
    applyAppearance({ glass: false, accent: 'amber' }, root)
    expect(root.dataset.glass).toBe('off')
  })

  it('cambia el acento y deriva hover y soft', () => {
    const root = fakeRoot()
    applyAppearance({ glass: false, accent: 'blue' }, root)
    expect(root.props.get('--mn-color-accent')).toBe('#5B8DEF')
    expect(root.props.get('--mn-color-accent-hover')).toBe(lighten('#5B8DEF', 0.12))
    expect(root.props.get('--mn-color-accent-soft')).toBe(withAlpha('#5B8DEF', 0.12))
  })

  it('el ámbar usa los tokens exactos del diseño', () => {
    const root = fakeRoot()
    applyAppearance({ glass: true, accent: 'amber' }, root)
    expect(root.props.get('--mn-color-accent-hover')).toBe(colors['accent-hover'])
  })
})
