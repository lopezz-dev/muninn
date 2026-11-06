import type { NewsSource } from '@muninn/core'
import { Button, Dialog, DialogContent, Icon, icons, SheetContent } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('news')
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
      <p className="text-sm text-fg-muted text-pretty">{t('suggested.intro')}</p>
      {NEWS_CATALOG.map((g) => (
        <section key={g.topic} aria-labelledby={`cat-${g.topic}`} className="flex flex-col">
          <h3
            id={`cat-${g.topic}`}
            className="pb-1.5 text-xs font-semibold tracking-wider text-fg-subtle uppercase"
          >
            {g.label}
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
                      {t('suggested.added')}
                    </span>
                  ) : (
                    <Button
                      size={desktop ? 'sm' : 'md'}
                      aria-label={t('suggested.addNamed', { title: s.title })}
                      disabled={busy !== null}
                      onClick={() => void add(s.url, s.title, g.label)}
                      className="shrink-0"
                    >
                      <icons.plus size={13} />
                      {t('suggested.add')}
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
        <DialogContent title={t('suggested.title')} size="lg" className="max-h-[76vh]">
          {body}
        </DialogContent>
      ) : (
        <SheetContent side="bottom" title={t('suggested.title')}>
          {body}
        </SheetContent>
      )}
    </Dialog>
  )
}

/** Botón que abre el catálogo (por defecto, «Fuentes oficiales»). */
export function SuggestedSourcesButton({
  sources,
  variant = 'secondary',
  label,
}: {
  sources: NewsSource[]
  variant?: 'primary' | 'secondary'
  label?: string
}) {
  const { t } = useTranslation('news')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Icon name="news" />
        {label ?? t('suggested.title')}
      </Button>
      <SuggestedSources open={open} onOpenChange={setOpen} sources={sources} />
    </>
  )
}
