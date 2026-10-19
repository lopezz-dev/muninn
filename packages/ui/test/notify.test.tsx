// @vitest-environment jsdom
import './setup-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, NotificationPill, notify, Toaster } from '../src'

afterEach(() => {
  act(() => {
    notify.dismiss()
  })
})

describe('notify', () => {
  it('muestra la píldora con título y descripción', async () => {
    render(<Toaster />)
    act(() => {
      notify.success('Enlace copiado', { description: 'MUN-23' })
    })
    expect(await screen.findByText('Enlace copiado')).toBeInTheDocument()
    expect(screen.getByText(/MUN-23/)).toBeInTheDocument()
  })

  it('la acción «Deshacer» se ejecuta y cierra la notificación', async () => {
    const undo = vi.fn()
    render(<Toaster />)
    act(() => {
      notify.success('Movida a En curso', { action: { label: 'Deshacer', onClick: undo } })
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Deshacer' }))
    expect(undo).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByText('Movida a En curso')).not.toBeInTheDocument())
  })

  it('los errores se pueden cerrar a mano', async () => {
    render(<Toaster />)
    act(() => {
      notify.error('No se pudo sincronizar')
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar notificación' }))
    await waitFor(() =>
      expect(screen.queryByText('No se pudo sincronizar')).not.toBeInTheDocument(),
    )
  })

  it('promise: cargando y después éxito con el valor', async () => {
    render(<Toaster />)
    let resolve!: (v: string) => void
    const p = new Promise<string>((r) => {
      resolve = r
    })
    let done!: Promise<string>
    act(() => {
      done = notify.promise(p, {
        loading: 'Sincronizando…',
        success: (repo) => `${repo} sincronizado`,
        error: 'Falló',
      })
    })
    expect(await screen.findByText('Sincronizando…')).toBeInTheDocument()
    await act(async () => {
      resolve('huginndb')
      await done
    })
    expect(await screen.findByText('huginndb sincronizado')).toBeInTheDocument()
    expect(screen.queryByText('Sincronizando…')).not.toBeInTheDocument()
  })

  it('las notificaciones se anuncian en una región para lectores de pantalla', () => {
    render(<Toaster />)
    expect(screen.getByLabelText(/Notificaciones/)).toBeInTheDocument()
  })
})

describe('NotificationPill', () => {
  it('el icono es decorativo: el texto lleva el mensaje', () => {
    const { container } = render(<NotificationPill tone="success" title="Proyecto creado" />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(screen.getByText('Proyecto creado')).toBeInTheDocument()
  })
})

describe('copyText', () => {
  it('usa la API del portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    expect(await copyText('https://muninn/t/MUN-23')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://muninn/t/MUN-23')
  })
})
