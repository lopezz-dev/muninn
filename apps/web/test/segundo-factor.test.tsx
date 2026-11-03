// @vitest-environment jsdom
import { createMemoryStore, createMuninn, type Muninn } from '@muninn/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Ajustes › Cuenta › Segundo factor con la cuenta simulada del core (ADR-0061, ADR-0075). La demo no enseña esta
// sección, así que se prueba aquí: el alta da los códigos de recuperación y la fila dice cuántos quedan.
let m: Muninn
vi.mock('../src/lib/muninn', () => ({ useMuninn: () => m }))
vi.mock('../src/lib/use-media', () => ({ useIsDesktop: () => true }))
const notify = { info: vi.fn(), error: vi.fn(), success: vi.fn() }
vi.mock('@muninn/ui', async (orig) => ({ ...(await orig<object>()), notify }))

const { SegundoFactor } = await import('../src/screens/ajustes/SegundoFactor')

const verified = {
  id: crypto.randomUUID(),
  name: 'App de códigos',
  status: 'verified' as const,
  createdAt: '2026-10-01T10:00:00Z',
}

function setup(factors = [verified]) {
  m = createMuninn(createMemoryStore(undefined, { account: { factors } }))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <SegundoFactor />
    </QueryClientProvider>,
  )
}

const row = () => document.getElementById('ajuste-codigos-recuperacion') as HTMLElement
/** La fila aparece cuando se sabe que el segundo factor está activado. */
const findRow = () =>
  vi.waitFor(() => {
    const el = row()
    if (!el) throw new Error('Aún no está la fila')
    return el
  })

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('códigos de recuperación en Ajustes', () => {
  it('sin el segundo factor no hay fila de códigos', async () => {
    setup([])
    await screen.findByRole('button', { name: 'Activar' })
    expect(row()).toBeNull()
  })

  it('con el segundo factor, se generan, se enseñan una vez y la fila cuenta los que quedan', async () => {
    setup()
    expect(await within(await findRow()).findByText(/Sin generar/)).toBeTruthy()

    fireEvent.click(within(row()).getByRole('button', { name: 'Generar' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generar' }))
    const list = await within(dialog).findByRole('list', { name: 'Códigos de recuperación' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Los he guardado' }))
    expect(
      await within(row()).findByText('Te quedan 10 de 10. Cada uno vale una vez.'),
    ).toBeTruthy()
    expect(within(row()).getByRole('button', { name: 'Generar nuevos' })).toBeTruthy()
  })

  it('generar otros avisa de que los anteriores dejan de valer', async () => {
    setup()
    await m.account.mfa.recoveryCodes.generate()
    fireEvent.click(await within(await findRow()).findByRole('button', { name: 'Generar nuevos' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/dejarán de valer/)).toBeTruthy()
  })

  it('al activar el segundo factor, el último paso enseña los códigos', async () => {
    setup([])
    fireEvent.click(await screen.findByRole('button', { name: 'Activar' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Siguiente' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    // Un solo campo con las seis casillas pintadas encima: al completarlo, se envía solo.
    fireEvent.change(within(dialog).getByLabelText('Código de la app'), {
      target: { value: '123456' },
    })
    const list = await within(dialog).findByRole('list', { name: 'Códigos de recuperación' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(within(dialog).getByRole('button', { name: 'Los he guardado' })).toBeTruthy()
    expect(await m.account.mfa.recoveryCodes.status()).toEqual({ total: 10, remaining: 10 })
  })
})
