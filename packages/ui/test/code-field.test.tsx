// @vitest-environment jsdom
import './setup-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CodeField } from '../src'

function Harness({ onComplete, error }: { onComplete?: (v: string) => void; error?: string }) {
  const [value, setValue] = useState('')
  return (
    <CodeField
      label="Código de la app"
      value={value}
      onChange={setValue}
      onComplete={onComplete}
      error={error}
    />
  )
}

describe('CodeField', () => {
  it('es un solo campo, con autocompletado de código de una vez', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Código de la app')
    expect(input).toHaveAttribute('autocomplete', 'one-time-code')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })

  it('ignora lo que no son cifras y avisa una vez al completarse', async () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    const input = screen.getByLabelText('Código de la app')
    await userEvent.type(input, '12a3')
    expect(input).toHaveValue('123')
    expect(onComplete).not.toHaveBeenCalled()
    await userEvent.type(input, '4567')
    expect(input).toHaveValue('123456')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('al pegar, limpia espacios y guiones', async () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    const input = screen.getByLabelText('Código de la app')
    await userEvent.click(input)
    await userEvent.paste('123 456')
    expect(input).toHaveValue('123456')
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('con error, marca el campo como inválido y enseña el mensaje', () => {
    render(<Harness error="El código no es correcto" />)
    const input = screen.getByLabelText('Código de la app')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('El código no es correcto')
  })
})
