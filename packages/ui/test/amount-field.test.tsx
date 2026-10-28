// @vitest-environment jsdom
import './setup-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { AmountField, formatAmount, parseAmount } from '../src'

describe('parseAmount / formatAmount', () => {
  it('convierte a céntimos sin coma flotante', () => {
    expect(parseAmount('24,90')).toBe(2490)
    expect(parseAmount('24.9')).toBe(2490)
    expect(parseAmount('24,')).toBe(2400)
    expect(parseAmount(',5')).toBe(50)
    expect(parseAmount('0,07')).toBe(7)
    expect(parseAmount('')).toBeNull()
  })

  it('rechaza letras, signos y más de 2 decimales', () => {
    for (const bad of ['12a', '-5', '1e3', '12,345', '1,2,3', '+3'])
      expect(parseAmount(bad)).toBeNull()
  })

  it('formatea en es-ES agrupando también los miles de 4 cifras', () => {
    expect(formatAmount(128430)).toBe('1.284,30')
    expect(formatAmount(2490)).toBe('24,90')
    expect(formatAmount(5)).toBe('0,05')
  })
})

function Demo({ initial = null as number | null, onValue = (_: number | null) => {} }) {
  const [cents, setCents] = useState<number | null>(initial)
  return (
    <>
      <AmountField
        label="Importe"
        valueCents={cents}
        onValueChange={(c) => {
          setCents(c)
          onValue(c)
        }}
      />
      <output>{cents === null ? 'vacío' : String(cents)}</output>
    </>
  )
}

describe('AmountField', () => {
  it('ignora letras y caracteres no válidos al teclear', async () => {
    render(<Demo />)
    const input = screen.getByLabelText('Importe')
    await userEvent.type(input, '2a4b,9x€-')
    expect(input).toHaveValue('24,9')
    expect(screen.getByRole('status')).toHaveTextContent('2490')
  })

  it('no admite un tercer decimal', async () => {
    render(<Demo />)
    const input = screen.getByLabelText('Importe')
    await userEvent.type(input, '3,141')
    expect(input).toHaveValue('3,14')
  })

  it('ignora un pegado inválido', async () => {
    render(<Demo />)
    const input = screen.getByLabelText('Importe')
    await userEvent.click(input)
    await userEvent.paste('doce euros')
    expect(input).toHaveValue('')
  })

  it('formatea al salir y vuelve al texto editable al entrar', async () => {
    render(<Demo initial={128430} />)
    const input = screen.getByLabelText('Importe')
    expect(input).toHaveValue('1.284,30')
    await userEvent.click(input)
    expect(input).toHaveValue('1284,30')
    await userEvent.tab()
    expect(input).toHaveValue('1.284,30')
  })

  it('usa el teclado decimal en móvil', () => {
    render(<Demo />)
    expect(screen.getByLabelText('Importe')).toHaveAttribute('inputmode', 'decimal')
  })
})
