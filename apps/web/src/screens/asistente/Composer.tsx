import type { ChatProvider } from '@muninn/assistant'
import { cn, Icon, IconButton, icons } from '@muninn/ui'
import { type KeyboardEvent, type Ref, useImperativeHandle, useRef, useState } from 'react'
import { useImageAttachments } from './use-image-attachments'

/** Lo que la pantalla puede pedirle a la caja de escribir sin tener el borrador en su estado. */
export interface ComposerHandle {
  focus: () => void
  /** Envía `text` (una sugerencia) o, sin argumento, lo escrito con sus imágenes. */
  submit: (text?: string) => void
  /** Pone `text` si la caja está vacía (la pregunta de `?q=` mientras el modelo no está listo). */
  prefill: (text: string) => void
  clear: () => void
}

interface ComposerProps {
  ref?: Ref<ComposerHandle>
  ready: boolean
  running: boolean
  provider: ChatProvider | null
  /** Aviso cuando hay imágenes y el modelo no las ve. */
  noVisionMessage: string
  onSend: (text: string, images: string[]) => void
  onStop: () => void
}

/**
 * Caja de escribir del asistente con su propio borrador e imágenes (ADR-0051): así cada tecla repinta solo esto y no la
 * conversación entera.
 */
export function Composer({
  ref,
  ready,
  running,
  provider,
  noVisionMessage,
  onSend,
  onStop,
}: ComposerProps) {
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const att = useImageAttachments({ ready, provider, onAttached: () => input.current?.focus() })

  const canSend =
    ready && !running && (draft.trim() !== '' || att.images.length > 0) && !att.blocked
  const submit = (text = draft) => {
    if (!ready || running) return
    // Las sugerencias se mandan sin imágenes; lo escrito, con las adjuntas (si el modelo las ve).
    const withImages = text === draft && att.images.length > 0
    if (withImages && !att.vision) return
    if (!text.trim() && !withImages) return
    onSend(text, withImages ? att.images : [])
    setDraft('')
    if (withImages) att.clear()
    input.current?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    submit,
    prefill: (text) => setDraft((d) => d || text),
    clear: () => setDraft(''),
  }))

  return (
    <div
      className={cn(
        // mt-auto: con pocos mensajes, la caja de escribir baja al pie de la pantalla.
        'glass sticky z-10 -mx-2 mt-auto flex flex-col gap-2 rounded-xl px-2 pt-2 pb-2',
        'bottom-[calc(env(safe-area-inset-bottom)+96px)] md:bottom-4',
      )}
    >
      {/* Soltar o pegar imágenes es un atajo: el clip hace lo mismo. */}
      <div
        {...att.dropZone}
        className={cn(
          'flex flex-col gap-2 rounded-xl border bg-surface-sunken p-2 transition-colors focus-within:border-accent',
          att.dragging ? 'border-accent bg-accent-soft' : 'border-border-strong',
        )}
      >
        {att.images.length ? (
          <ul aria-label="Imágenes adjuntas" className="flex flex-wrap gap-2 px-1 pt-1">
            {att.images.map((src, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: se quitan por posición
              <li key={i} className="relative">
                <img
                  src={src}
                  alt={`Imagen ${i + 1}`}
                  className="size-16 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  aria-label={`Quitar la imagen ${i + 1}`}
                  onClick={() => att.remove(i)}
                  className="absolute -top-1.5 -right-1.5 grid size-5 cursor-pointer place-items-center rounded-full border border-border-strong bg-surface-raised text-fg-muted hover:text-fg"
                >
                  <icons.close size={11} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-end gap-1.5">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void att.add(e.target.files)
              e.target.value = ''
            }}
          />
          <IconButton
            aria-label="Adjuntar imágenes"
            icon={<Icon name="attach" size={18} />}
            size="lg"
            disabled={!ready || running || att.full}
            onClick={() => fileInput.current?.click()}
            className="text-fg-subtle"
          />
          <label htmlFor="asistente-mensaje" className="sr-only">
            Mensaje
          </label>
          <textarea
            id="asistente-mensaje"
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onPaste={att.onPaste}
            disabled={!ready}
            placeholder={ready ? 'Pregunta o pide algo…' : 'Aquí no está disponible'}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base leading-normal text-fg outline-none [field-sizing:content] placeholder:text-fg-faint disabled:cursor-not-allowed"
          />
          {running ? (
            <IconButton
              aria-label="Detener"
              icon={<Icon name="close" size={17} />}
              variant="secondary"
              size="lg"
              onClick={onStop}
            />
          ) : (
            <IconButton
              aria-label="Enviar"
              icon={<Icon name="send" size={17} />}
              variant="primary"
              size="lg"
              disabled={!canSend}
              onClick={() => submit()}
            />
          )}
        </div>
      </div>
      {att.images.length && att.vision === false ? (
        <p role="status" className="flex items-start gap-2 px-1 text-xs text-fg-muted">
          <Icon name="warning" size={14} className="mt-px shrink-0 text-accent" />
          {noVisionMessage}
        </p>
      ) : (
        <span className="hidden text-center text-xs text-fg-faint md:block">
          Muninn puede crear, mover y archivar, pero nunca borra. Todo queda en la actividad.
        </span>
      )}
    </div>
  )
}
