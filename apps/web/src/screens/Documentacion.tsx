import { cn, icons } from '@muninn/ui'
import { Link, Navigate, Outlet, useMatch } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Page } from '../components/Page'
import { searchDocs } from '../lib/docs'
import { useIsDesktop } from '../lib/use-media'
import { DOCS } from './docs/content'
import { StatusBadge } from './docs/StatusBadge'

/**
 * Documentación (Documentacion.dc.html): las guías de `docs/user` con menú, buscador y marca de estado. El
 * menú sale del front matter de cada guía. En móvil, abrir una guía la pone a pantalla completa.
 */
export function Documentacion() {
  const desktop = useIsDesktop()
  const open = useMatch({ from: '/_app/documentacion/$pagina', shouldThrow: false })?.params.pagina
  const [query, setQuery] = useState('')
  const hits = useMemo(() => searchDocs(DOCS, query), [query])

  if (open && !desktop) return <Outlet />
  // En escritorio no hay «lista sin guía»: se abre la primera.
  const first = DOCS[0]
  if (!open && desktop && first) {
    return <Navigate to="/documentacion/$pagina" params={{ pagina: first.slug }} replace />
  }

  return (
    <Page className="max-w-none">
      <div className="md:grid md:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] md:gap-8">
        <nav
          aria-label="Páginas de ayuda"
          className="flex min-w-0 flex-col gap-3 md:sticky md:top-7 md:max-h-[calc(100dvh-3.5rem)] md:self-start md:overflow-y-auto"
        >
          <header className="flex items-center gap-3">
            <Link
              to="/mas"
              aria-label="Volver"
              className="grid size-11 place-items-center rounded-md border border-border bg-surface text-fg md:hidden"
            >
              <icons.chevronLeft size={18} />
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight md:text-xl">Documentación</h1>
          </header>

          <label className="flex h-11 items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 text-fg-subtle focus-within:border-accent md:h-8 md:rounded-md md:bg-transparent md:px-2.5">
            <icons.search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar en la ayuda"
              placeholder="Buscar en la ayuda"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-faint md:text-sm"
            />
          </label>

          {hits.length === 0 ? (
            <p className="px-1 py-4 text-sm text-fg-subtle">
              Ninguna guía menciona «{query.trim()}».
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface md:gap-0.5 md:divide-y-0 md:border-0 md:bg-transparent">
              {hits.map(({ doc, snippet }) => (
                <li key={doc.slug}>
                  <Link
                    to="/documentacion/$pagina"
                    params={{ pagina: doc.slug }}
                    className={cn(
                      'flex flex-col gap-1 px-3.5 py-3 text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:rounded-md md:px-2.5 md:py-1.5',
                      'data-[status=active]:bg-fg/[0.07] data-[status=active]:text-fg',
                    )}
                  >
                    <span className="flex items-center gap-2 text-md md:text-base">
                      <span className="w-4 shrink-0 font-mono text-xs text-fg-faint tabular">
                        {doc.order}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                      <StatusBadge status={doc.status} />
                    </span>
                    {snippet ? (
                      <span className="line-clamp-2 pl-6 text-xs leading-snug text-fg-subtle">
                        {snippet}
                      </span>
                    ) : (
                      <span className="pl-6 text-sm leading-snug text-fg-subtle md:hidden">
                        {doc.description}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="px-1 pt-2 text-xs leading-relaxed text-fg-faint md:mt-4">
            Versión {__APP_VERSION__} · generada desde <span className="font-mono">docs/user</span>
          </p>
        </nav>

        {desktop ? <Outlet /> : null}
      </div>
    </Page>
  )
}
