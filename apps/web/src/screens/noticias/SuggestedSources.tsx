import type { NewsSource } from '@muninn/core'
import { Button, Dialog, DialogContent, Icon, icons, SheetContent } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useMuninn } from '../../lib/muninn'
import { addSource } from '../../lib/news'
import { NEWS_CATALOG, sameFeed } from '../../lib/news-catalog'
import { useIsDesktop } from '../../lib/use-media'

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')

/**
 * Catálogo de fuentes oficiales (`lib/news-catalog.ts`) por temas, con «Añadir» en cada una. Las que ya sigues salen
 * marcadas. En el móvil, una hoja desde abajo; en escritorio, un diálogo.
 */
export function SuggestedSources({
  open,
  onOpenChange,
  sources,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: NewsSource[]
}) {
  const m = useMuninn()
  const qc = useQueryClient()
  const desktop = useIsDesktop()
  const [busy, setBusy] = useState<string | null>(null)
  const following = (url: string) => sources.some((s) => sameFeed(s.url, url))

  const add = async (url: string, title: string, topic: string) => {
    setBusy(url)
    await addSource(m, qc, { url, title, topic })
    setBusy(null)
  }

  const body = (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-fg-muted text-pretty">
        Feeds RSS publicados por el propio medio, organismo o empresa. Se guardan con su tema, así
        tendrás una pestaña por cada uno.
      </p>
      {NEWS_CATALOG.map((g) => (
        <section key={g.topic} aria-labelledby={`cat-${g.topic}`} className="flex flex-col">
          <h3
            id={`cat-${g.topic}`}
            className="pb-1.5 text-xs font-semibold tracking-wider text-fg-subtle uppercase"
          >
            {g.topic}
          </h3>
          <ul>
            {g.sources.map((s) => {
              const added = following(s.url)
              return (
                <li
                  key={s.url}
                  className="flex items-center gap-3 border-t border-border-subtle py-2.5 first:border-t-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-medium">{s.title}</span>
                    <span className="truncate text-xs text-fg-subtle">
                      {s.about} · {hostOf(s.url)}
                    </span>
                  </div>
                  {added ? (
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 px-2 text-xs font-medium text-fg-subtle">
                      <icons.check size={13} aria-hidden="true" />
                      Añadida
                    </span>
                  ) : (
                    <Button
                      size={desktop ? 'sm' : 'md'}
                      aria-label={`Añadir ${s.title}`}
                      disabled={busy !== null}
                      onClick={() => void add(s.url, s.title, g.topic)}
                      className="shrink-0"
                    >
                      <icons.plus size={13} />
                      Añadir
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {desktop ? (
        <DialogContent title="Fuentes oficiales" size="lg" className="max-h-[76vh]">
          {body}
        </DialogContent>
      ) : (
        <SheetContent side="bottom" title="Fuentes oficiales">
          {body}
        </SheetContent>
      )}
    </Dialog>
  )
}

/** Botón que abre el catálogo. */
export function SuggestedSourcesButton({
  sources,
  variant = 'secondary',
  label = 'Fuentes oficiales',
}: {
  sources: NewsSource[]
  variant?: 'primary' | 'secondary'
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Icon name="news" />
        {label}
      </Button>
      <SuggestedSources open={open} onOpenChange={setOpen} sources={sources} />
    </>
  )
}
