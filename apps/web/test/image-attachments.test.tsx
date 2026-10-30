// @vitest-environment jsdom
import type { ChatProvider } from '@muninn/assistant'
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// En jsdom no hay `createImageBitmap` ni canvas: la reducción se simula y falla con los nombres «roto*».
vi.mock('../src/lib/assistant-images', () => ({
  MAX_IMAGES: 4,
  imageToDataUrl: async (f: File) => {
    if (f.name.startsWith('roto')) throw new Error(`No puedo abrir «${f.name}»`)
    return `data:image/jpeg;base64,${f.name}`
  },
}))
const notify = { info: vi.fn(), error: vi.fn(), success: vi.fn() }
vi.mock('@muninn/ui', async (orig) => ({ ...(await orig<object>()), notify }))

const { useImageAttachments } = await import('../src/screens/asistente/use-image-attachments')
const { Composer } = await import('../src/screens/asistente/Composer')

const img = (name: string) => new File(['x'], name, { type: 'image/png' })
const provider = (vision: boolean): ChatProvider =>
  ({ label: 'prueba', vision: async () => vision }) as unknown as ChatProvider

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useImageAttachments', () => {
  it('adjunta solo imágenes, quita por posición y vacía', async () => {
    const onAttached = vi.fn()
    // El proveedor, fuera del render: en la pantalla va memorizado (si cambia, se vuelve a preguntar por la visión).
    const p = provider(true)
    const { result } = renderHook(() =>
      useImageAttachments({ ready: true, provider: p, onAttached }),
    )
    await act(() =>
      result.current.add([img('a'), new File(['t'], 'b.txt', { type: 'text/plain' }), img('c')]),
    )
    expect(result.current.images).toEqual(['data:image/jpeg;base64,a', 'data:image/jpeg;base64,c'])
    expect(onAttached).toHaveBeenCalledOnce()
    act(() => result.current.remove(0))
    expect(result.current.images).toEqual(['data:image/jpeg;base64,c'])
    act(() => result.current.clear())
    expect(result.current.images).toEqual([])
  })

  it('no pasa del máximo y avisa', async () => {
    const { result } = renderHook(() => useImageAttachments({ ready: true, provider: null }))
    await act(() => result.current.add([img('1'), img('2'), img('3')]))
    await act(() => result.current.add([img('4'), img('5')]))
    expect(result.current.images).toHaveLength(4)
    expect(result.current.full).toBe(true)
    expect(notify.info).toHaveBeenCalledOnce()
  })

  it('si una imagen no se puede leer, avisa y sigue con las demás', async () => {
    const { result } = renderHook(() => useImageAttachments({ ready: true, provider: null }))
    await act(() => result.current.add([img('roto.png'), img('b')]))
    expect(result.current.images).toEqual(['data:image/jpeg;base64,b'])
    expect(notify.error).toHaveBeenCalledWith('No puedo abrir «roto.png»')
  })

  it('pregunta al modelo si ve imágenes; sin visión, con imágenes no se puede enviar', async () => {
    const p = provider(false)
    const { result, rerender } = renderHook(
      ({ ready }) => useImageAttachments({ ready, provider: p }),
      { initialProps: { ready: false } },
    )
    expect(result.current.vision).toBeNull()
    rerender({ ready: true })
    await waitFor(() => expect(result.current.vision).toBe(false))
    expect(result.current.blocked).toBe(false)
    await act(() => result.current.add([img('a')]))
    expect(result.current.blocked).toBe(true)
  })

  it('arrastrar solo reacciona a archivos y con el modelo listo', () => {
    const { result, rerender } = renderHook(
      ({ ready }) => useImageAttachments({ ready, provider: null }),
      { initialProps: { ready: true } },
    )
    const drag = (types: string[]) =>
      ({ preventDefault: vi.fn(), dataTransfer: { types } }) as never
    act(() => result.current.dropZone.onDragOver(drag(['text/plain'])))
    expect(result.current.dragging).toBe(false)
    act(() => result.current.dropZone.onDragOver(drag(['Files'])))
    expect(result.current.dragging).toBe(true)
    act(() => result.current.dropZone.onDragLeave())
    expect(result.current.dragging).toBe(false)
    rerender({ ready: false })
    act(() => result.current.dropZone.onDragOver(drag(['Files'])))
    expect(result.current.dragging).toBe(false)
  })
})

describe('Composer', () => {
  const setup = (over: Partial<Parameters<typeof Composer>[0]> = {}) => {
    const onSend = vi.fn()
    render(
      <Composer
        ready
        running={false}
        provider={provider(true)}
        noVisionMessage="No ve imágenes"
        onSend={onSend}
        onStop={() => {}}
        {...over}
      />,
    )
    return { onSend, box: screen.getByLabelText('Mensaje') as HTMLTextAreaElement }
  }

  it('Intro envía lo escrito y vacía la caja; Mayús+Intro no', () => {
    const { onSend, box } = setup()
    fireEvent.change(box, { target: { value: 'hola' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hola', [])
    expect(box.value).toBe('')
  })

  it('sin modelo listo no envía', () => {
    const { onSend, box } = setup({ ready: false })
    expect(box.disabled).toBe(true)
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('el handle pone la pregunta solo si la caja está vacía, y envía sugerencias', () => {
    const ref = {
      current: null as null | import('../src/screens/asistente/Composer').ComposerHandle,
    }
    const { onSend, box } = setup({ ref })
    act(() => ref.current?.prefill('de la URL'))
    expect(box.value).toBe('de la URL')
    act(() => ref.current?.prefill('otra'))
    expect(box.value).toBe('de la URL')
    act(() => ref.current?.submit('¿Cómo voy hoy?'))
    expect(onSend).toHaveBeenCalledWith('¿Cómo voy hoy?', [])
    expect(box.value).toBe('')
  })

  it('pegar una imagen la adjunta y se manda con el mensaje', async () => {
    const { onSend, box } = setup()
    await waitFor(() => expect(screen.getByLabelText('Enviar')).toBeTruthy())
    fireEvent.paste(box, { clipboardData: { files: [img('foto')] } })
    await screen.findByAltText('Imagen 1')
    fireEvent.change(box, { target: { value: '¿qué es?' } })
    // Espera a saber que el modelo ve imágenes antes de enviar.
    await waitFor(() => {
      fireEvent.keyDown(box, { key: 'Enter' })
      expect(onSend).toHaveBeenCalledWith('¿qué es?', ['data:image/jpeg;base64,foto'])
    })
    expect(screen.queryByAltText('Imagen 1')).toBeNull()
  })
})
