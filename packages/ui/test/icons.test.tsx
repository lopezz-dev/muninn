// @vitest-environment jsdom
import './setup-dom'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Icon, icons } from '../src/icons'

describe('iconos', () => {
  it('pinta el trazo del grosor pedido y cae al regular si no está generado', () => {
    const svg = (el: ReactElement) => render(el).container.querySelector('svg')?.innerHTML
    const regular = svg(<Icon name="home" />)
    expect(regular).toContain('<path')
    expect(svg(<Icon name="home" weight="bold" />)).not.toBe(regular)
    expect(svg(<icons.pin weight="fill" />)).not.toBe(svg(<icons.pin />))
    expect(svg(<Icon name="home" weight="thin" />)).toBe(regular)
  })
})
