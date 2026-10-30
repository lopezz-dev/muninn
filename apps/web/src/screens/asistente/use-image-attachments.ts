import type { ChatProvider } from '@muninn/assistant'
import { notify } from '@muninn/ui'
import {
  type ClipboardEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { imageToDataUrl, MAX_IMAGES } from '../../lib/assistant-images'

interface Options {
  /** Si hay modelo listo: sin él no se aceptan imágenes soltadas ni se pregunta por la visión. */
  ready: boolean
  provider: ChatProvider | null
  /** Tras adjuntar, devuelve el foco a la caja de escribir. */
  onAttached?: () => void
}

/**
 * Imágenes adjuntas al mensaje (ADR-0051): se reducen en el navegador y solo se pueden mandar si el modelo tiene visión.
 * Reúne el clip, arrastrar y soltar, pegar y la comprobación de visión del modelo.
 */
export function useImageAttachments({ ready, provider, onAttached }: Options) {
  const [images, setImages] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  // null mientras no se sabe (o no hay modelo).
  const [vision, setVision] = useState<boolean | null>(null)
  // Lo adjunto ya, para calcular el hueco sin depender del render (dos adjuntos seguidos).
  const current = useRef(images)
  current.current = images
  const attached = useRef(onAttached)
  attached.current = onAttached

  useEffect(() => {
    setVision(null)
    if (!ready || !provider) return
    let live = true
    void (provider.vision?.() ?? Promise.resolve(false)).then((v) => {
      if (live) setVision(v)
    })
    return () => {
      live = false
    }
  }, [ready, provider])

  const add = useCallback(async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    const room = MAX_IMAGES - current.current.length
    if (list.length > room)
      notify.info(`Como mucho ${MAX_IMAGES} imágenes por mensaje`, { icon: 'image' })
    const added: string[] = []
    for (const f of list.slice(0, Math.max(0, room))) {
      try {
        added.push(await imageToDataUrl(f))
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'No se pudo adjuntar la imagen')
      }
    }
    if (added.length) setImages((l) => [...l, ...added].slice(0, MAX_IMAGES))
    attached.current?.()
  }, [])

  const remove = useCallback((i: number) => setImages((l) => l.filter((_, j) => j !== i)), [])
  const clear = useCallback(() => setImages([]), [])

  /** Para la zona donde se sueltan: solo reacciona a archivos y con modelo listo. */
  const dropZone = {
    onDragOver: (e: DragEvent) => {
      if (!ready || !e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      void add(e.dataTransfer.files)
    },
  }

  /** Pegar una imagen en la caja la adjunta; el texto se pega como siempre. */
  const onPaste = (e: ClipboardEvent) => {
    if (e.clipboardData.files.length) {
      e.preventDefault()
      void add(e.clipboardData.files)
    }
  }

  return {
    images,
    vision,
    dragging,
    full: images.length >= MAX_IMAGES,
    /** Con imágenes y un modelo que no las ve (o aún no se sabe), no se puede enviar. */
    blocked: images.length > 0 && !vision,
    add,
    remove,
    clear,
    dropZone,
    onPaste,
  }
}
