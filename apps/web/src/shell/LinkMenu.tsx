import { copyText, icons, notify, Popover, PopoverAnchor, PopoverContent } from '@muninn/ui'
import { useEffect } from 'react'
import { openExternal } from '../lib/external-link'
import { closeLinkMenu, type LinkAsk } from '../lib/link-menu'

/** «github.com» de una URL; si no se entiende, la URL tal cual. */
function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

const item =
  'flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-left text-base outline-none hover:bg-surface-hover focus-visible:bg-surface-hover'

/**
 * Menú de un enlace externo en pantallas táctiles (ADR-0073): dice adónde lleva y deja abrirlo o copiarlo. Se coloca
 * junto al enlace tocado y se cierra al tocar fuera, con Escape o al hacer scroll (el enlace ya no estaría ahí).
 */
export function LinkMenu({ ask }: { ask: LinkAsk }) {
  useEffect(() => {
    window.addEventListener('scroll', closeLinkMenu, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', closeLinkMenu, { capture: true })
  }, [])

  const open = () => {
    closeLinkMenu()
    ask.onOpen?.()
    void openExternal(ask.url)
  }
  const copy = async () => {
    closeLinkMenu()
    if (await copyText(ask.url))
      notify.success('Enlace copiado', { icon: 'link', description: ask.url })
    else notify.error('No se pudo copiar el enlace')
  }

  return (
    <Popover open onOpenChange={(o) => !o && closeLinkMenu()}>
      <PopoverAnchor asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed"
          style={{
            left: ask.rect.left,
            top: ask.rect.top,
            width: ask.rect.width,
            height: ask.rect.height,
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="start"
        aria-label="Enlace fuera de Muninn"
        className="w-[min(18rem,calc(100vw-24px))]"
      >
        <p className="px-2.5 pt-1 pb-1.5 text-xs text-fg-subtle">
          Sale de Muninn ·{' '}
          <span className="font-medium break-all text-fg-muted" title={ask.url}>
            {hostOf(ask.url)}
          </span>
        </p>
        <button type="button" className={item} onClick={open}>
          <icons.external size={16} aria-hidden="true" className="text-fg-subtle" />
          Abrir enlace
        </button>
        <button type="button" className={item} onClick={copy}>
          <icons.link size={16} aria-hidden="true" className="text-fg-subtle" />
          Copiar enlace
        </button>
      </PopoverContent>
    </Popover>
  )
}
